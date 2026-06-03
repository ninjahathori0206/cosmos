/*
  CX loyalty engine — schedule earn, process pending, resolve coin owner
  Deploy: npm run deploy:cx-sps
*/
USE [CosmosERP];
GO

CREATE OR ALTER PROCEDURE dbo.usp_cx_ResolveCoinOwnerCustomerId
  @purchaser_customer_id INT,
  @owner_customer_id     INT OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @owner_customer_id = @purchaser_customer_id;

  /* Dependent buddy → credit primary membership holder */
  SELECT TOP 1 @owner_customer_id = cm.customer_id
  FROM dbo.customer_membership_dependents cmd
  INNER JOIN dbo.customer_memberships cm
    ON cm.membership_id = cmd.membership_id
   AND cm.is_active = 1
   AND cm.expires_at > DATEADD(MINUTE, 330, SYSUTCDATETIME())
  WHERE cmd.customer_id = @purchaser_customer_id
  ORDER BY cm.expires_at DESC;

  IF @owner_customer_id IS NULL SET @owner_customer_id = @purchaser_customer_id;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_cx_ScheduleLoyaltyCredit
  @purchaser_customer_id INT,
  @order_id              INT,
  @invoice_id            INT = NULL,
  @invoice_total         DECIMAL(12,2),
  @actor_user_id         INT = NULL
AS
BEGIN
  SET NOCOUNT ON;

  IF @purchaser_customer_id IS NULL OR @invoice_total IS NULL OR @invoice_total <= 0
    RETURN;

  IF @invoice_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM dbo.loyalty_ledger
    WHERE invoice_id = @invoice_id AND entry_type = N'EARN'
  )
    RETURN;

  DECLARE @owner_id INT;
  EXEC dbo.usp_cx_ResolveCoinOwnerCustomerId @purchaser_customer_id, @owner_id OUTPUT;

  DECLARE @earn_pct DECIMAL(5,2);
  DECLARE @delay_days INT;

  SELECT @earn_pct = earn_percent, @delay_days = credit_delay_days
  FROM dbo.loyalty_settings WHERE settings_id = 1;

  IF @earn_pct IS NULL SET @earn_pct = 5;
  IF @delay_days IS NULL SET @delay_days = 7;

  DECLARE @coins INT = FLOOR(@invoice_total * @earn_pct / 100.0);
  IF @coins <= 0 RETURN;

  DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());
  DECLARE @available DATETIME2(0) = DATEADD(DAY, @delay_days, @now);

  DECLARE @live_bal INT = ISNULL((
    SELECT TOP 1 balance_after FROM dbo.loyalty_ledger
    WHERE customer_id = @owner_id AND status = N'LIVE'
    ORDER BY ledger_id DESC
  ), 0);

  INSERT INTO dbo.loyalty_ledger (
    customer_id, triggered_by_customer_id, order_id, invoice_id,
    entry_type, status, coins_delta, balance_after,
    reason, available_at, created_by_user_id
  )
  VALUES (
    @owner_id,
    CASE WHEN @owner_id <> @purchaser_customer_id THEN @purchaser_customer_id ELSE NULL END,
    @order_id,
    @invoice_id,
    N'EARN',
    N'PENDING',
    @coins,
    @live_bal,
    N'Earn ' + CAST(@earn_pct AS NVARCHAR(10)) + N'% on invoice',
    @available,
    @actor_user_id
  );

  SELECT SCOPE_IDENTITY() AS ledger_id, @owner_id AS owner_customer_id, @coins AS coins_scheduled;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_cx_ProcessPendingLoyalty
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());
  DECLARE @processed INT = 0;

  DECLARE @ledger_id BIGINT;
  DECLARE @customer_id INT;
  DECLARE @coins_delta INT;

  DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT ledger_id, customer_id, coins_delta
    FROM dbo.loyalty_ledger
    WHERE status = N'PENDING'
      AND available_at IS NOT NULL
      AND available_at <= @now
    ORDER BY customer_id, ledger_id;

  OPEN cur;
  FETCH NEXT FROM cur INTO @ledger_id, @customer_id, @coins_delta;

  WHILE @@FETCH_STATUS = 0
  BEGIN
    DECLARE @live INT = ISNULL((
      SELECT TOP 1 balance_after FROM dbo.loyalty_ledger
      WHERE customer_id = @customer_id AND status = N'LIVE'
      ORDER BY ledger_id DESC
    ), 0);

    DECLARE @new_bal INT = @live + @coins_delta;

    UPDATE dbo.loyalty_ledger
    SET status = N'LIVE',
        balance_after = @new_bal
    WHERE ledger_id = @ledger_id AND status = N'PENDING';

    IF @@ROWCOUNT > 0 SET @processed = @processed + 1;

    FETCH NEXT FROM cur INTO @ledger_id, @customer_id, @coins_delta;
  END

  CLOSE cur;
  DEALLOCATE cur;

  SELECT @processed AS rows_promoted;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_cx_RedeemLoyaltyCoins
  @customer_id       INT,
  @order_id          INT,
  @coins_to_redeem   INT,
  @reason            NVARCHAR(200) = NULL,
  @actor_user_id     INT = NULL
AS
BEGIN
  SET NOCOUNT ON;

  IF @coins_to_redeem <= 0
  BEGIN
    RAISERROR(N'coins_to_redeem must be positive.', 16, 1);
    RETURN;
  END

  DECLARE @live INT = ISNULL((
    SELECT TOP 1 balance_after FROM dbo.loyalty_ledger
    WHERE customer_id = @customer_id AND status = N'LIVE'
    ORDER BY ledger_id DESC
  ), 0);

  IF @live < @coins_to_redeem
  BEGIN
    RAISERROR(N'Insufficient live coin balance.', 16, 1);
    RETURN;
  END

  DECLARE @new_bal INT = @live - @coins_to_redeem;
  DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());
  DECLARE @r NVARCHAR(200) = COALESCE(@reason, N'POS redemption');

  INSERT INTO dbo.loyalty_ledger (
    customer_id, order_id, entry_type, status, coins_delta, balance_after,
    reason, available_at, created_by_user_id
  )
  VALUES (
    @customer_id, @order_id, N'REDEEM', N'LIVE', -@coins_to_redeem, @new_bal,
    @r, @now, @actor_user_id
  );

  SELECT SCOPE_IDENTITY() AS ledger_id, @new_bal AS balance_after;
END;
GO
