/*
  Store Collection Book — treasury stored procedures
  Deploy via: npm run migrate:71-store-collection-book
*/
USE [CosmosERP];
GO

CREATE OR ALTER PROCEDURE dbo.sp_Treasury_GetSummary
  @store_id     INT,
  @engine_mode  NVARCHAR(10) = N'shared'
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @orders_table   NVARCHAR(128);
  DECLARE @payments_table NVARCHAR(128);
  DECLARE @today          DATE = CONVERT(DATE, DATEADD(MINUTE, 330, SYSUTCDATETIME()));
  DECLARE @sql            NVARCHAR(MAX);

  IF LOWER(LTRIM(RTRIM(@engine_mode))) = N'legacy'
  BEGIN
    SET @orders_table = N'dbo.pos_orders';
    SET @payments_table = N'dbo.pos_payments';
  END
  ELSE
  BEGIN
    SET @orders_table = N'dbo.oe_orders';
    SET @payments_table = N'dbo.oe_payments';
  END;

  SET @sql = N'
;WITH pay AS (
  SELECT
    p.amount,
    UPPER(LTRIM(RTRIM(p.method))) AS method,
    CONVERT(DATE, p.created_at) AS pay_date
  FROM ' + @payments_table + N' p
  INNER JOIN ' + @orders_table + N' o ON o.order_id = p.order_id
  WHERE o.store_id = @store_id
    AND ISNULL(o.status, N'''') <> N''CANCELLED''
    AND UPPER(LTRIM(RTRIM(ISNULL(o.order_kind, N'''')))) <> N''MEMBERSHIP''
),
mem_pay AS (
  SELECT
    mp.amount,
    UPPER(LTRIM(RTRIM(mp.method))) AS method,
    CONVERT(DATE, mp.created_at) AS pay_date
  FROM dbo.pos_membership_payments mp
  INNER JOIN dbo.pos_membership_sales ms ON ms.membership_sale_id = mp.membership_sale_id
  WHERE ms.store_id = @store_id
    AND ISNULL(ms.status, N'''') = N''PAID''
),
settled_dates AS (
  SELECT period_from, period_to
  FROM dbo.store_treasury_transfers
  WHERE store_id = @store_id
    AND transfer_type = N''machine_settlement''
    AND status = N''posted''
)
SELECT
  @store_id AS store_id,
  ISNULL((SELECT SUM(amount) FROM pay WHERE method = N''CASH''), 0)
    - ISNULL((
        SELECT SUM(gross_amount) FROM dbo.store_treasury_transfers
        WHERE store_id = @store_id AND transfer_type = N''cash_deposit'' AND status = N''posted''
      ), 0) AS store_cash_balance,
  ISNULL((
    SELECT SUM(p.amount) FROM pay p
    WHERE p.method = N''UPI''
      AND NOT EXISTS (SELECT 1 FROM settled_dates s WHERE p.pay_date BETWEEN s.period_from AND s.period_to)
  ), 0) AS machine_upi_pending,
  ISNULL((
    SELECT SUM(p.amount) FROM pay p
    WHERE p.method = N''CARD''
      AND NOT EXISTS (SELECT 1 FROM settled_dates s WHERE p.pay_date BETWEEN s.period_from AND s.period_to)
  ), 0) AS machine_card_pending,
  ISNULL((
    SELECT SUM(p.amount) FROM pay p
    WHERE p.method IN (N''UPI'', N''CARD'')
      AND NOT EXISTS (SELECT 1 FROM settled_dates s WHERE p.pay_date BETWEEN s.period_from AND s.period_to)
  ), 0) AS machine_total_pending,
  (SELECT MIN(p.pay_date) FROM pay p
    WHERE p.method IN (N''UPI'', N''CARD'')
      AND NOT EXISTS (SELECT 1 FROM settled_dates s WHERE p.pay_date BETWEEN s.period_from AND s.period_to)
  ) AS unsettled_machine_from,
  (SELECT MAX(p.pay_date) FROM pay p
    WHERE p.method IN (N''UPI'', N''CARD'')
      AND NOT EXISTS (SELECT 1 FROM settled_dates s WHERE p.pay_date BETWEEN s.period_from AND s.period_to)
  ) AS unsettled_machine_to,
  ISNULL((
    SELECT SUM(net_amount) FROM dbo.store_treasury_transfers
    WHERE store_id = @store_id AND status = N''posted''
  ), 0) AS store_bank_balance,
  ISNULL((SELECT SUM(amount) FROM pay WHERE method = N''CASH'' AND pay_date = @today), 0) AS collected_today_cash,
  ISNULL((SELECT SUM(amount) FROM pay WHERE method = N''UPI'' AND pay_date = @today), 0) AS collected_today_upi,
  ISNULL((SELECT SUM(amount) FROM pay WHERE method = N''CARD'' AND pay_date = @today), 0) AS collected_today_card,
  ISNULL((SELECT SUM(amount) FROM pay WHERE method = N''CASH''), 0) AS collected_all_cash,
  ISNULL((SELECT SUM(amount) FROM pay WHERE method = N''UPI''), 0) AS collected_all_upi,
  ISNULL((SELECT SUM(amount) FROM pay WHERE method = N''CARD''), 0) AS collected_all_card,
  ISNULL((SELECT SUM(amount) FROM mem_pay WHERE method = N''CASH''), 0) AS membership_store_cash_balance,
  ISNULL((SELECT SUM(amount) FROM mem_pay WHERE method IN (N''UPI'', N''CARD'')), 0) AS membership_machine_total_pending,
  ISNULL((SELECT SUM(amount) FROM mem_pay WHERE method = N''UPI''), 0) AS membership_machine_upi_pending,
  ISNULL((SELECT SUM(amount) FROM mem_pay WHERE method = N''CARD''), 0) AS membership_machine_card_pending,
  ISNULL((SELECT SUM(amount) FROM mem_pay WHERE method = N''CASH'' AND pay_date = @today), 0) AS membership_collected_today_cash,
  ISNULL((SELECT SUM(amount) FROM mem_pay WHERE method = N''UPI'' AND pay_date = @today), 0) AS membership_collected_today_upi,
  ISNULL((SELECT SUM(amount) FROM mem_pay WHERE method = N''CARD'' AND pay_date = @today), 0) AS membership_collected_today_card,
  CAST(0 AS DECIMAL(12,2)) AS membership_store_bank_balance
';

  EXEC sp_executesql @sql,
    N'@store_id INT, @today DATE',
    @store_id = @store_id,
    @today = @today;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Treasury_SuggestMachineGross
  @store_id     INT,
  @period_from  DATE,
  @period_to    DATE,
  @engine_mode  NVARCHAR(10) = N'shared'
AS
BEGIN
  SET NOCOUNT ON;

  IF @period_from IS NULL OR @period_to IS NULL OR @period_from > @period_to
  BEGIN
    RAISERROR(N'Invalid settlement period.', 16, 1);
    RETURN;
  END;

  DECLARE @orders_table   NVARCHAR(128);
  DECLARE @payments_table NVARCHAR(128);
  DECLARE @sql            NVARCHAR(MAX);

  IF LOWER(LTRIM(RTRIM(@engine_mode))) = N'legacy'
  BEGIN
    SET @orders_table = N'dbo.pos_orders';
    SET @payments_table = N'dbo.pos_payments';
  END
  ELSE
  BEGIN
    SET @orders_table = N'dbo.oe_orders';
    SET @payments_table = N'dbo.oe_payments';
  END;

  SET @sql = N'
;WITH pay AS (
  SELECT
    p.amount,
    UPPER(LTRIM(RTRIM(p.method))) AS method,
    CONVERT(DATE, p.created_at) AS pay_date
  FROM ' + @payments_table + N' p
  INNER JOIN ' + @orders_table + N' o ON o.order_id = p.order_id
  WHERE o.store_id = @store_id
    AND ISNULL(o.status, N'''') <> N''CANCELLED''
    AND UPPER(LTRIM(RTRIM(ISNULL(o.order_kind, N'''')))) <> N''MEMBERSHIP''
    AND UPPER(LTRIM(RTRIM(p.method))) IN (N''UPI'', N''CARD'')
),
settled_dates AS (
  SELECT period_from, period_to
  FROM dbo.store_treasury_transfers
  WHERE store_id = @store_id
    AND transfer_type = N''machine_settlement''
    AND status = N''posted''
)
SELECT
  ISNULL(SUM(CASE WHEN p.method = N''UPI'' THEN p.amount ELSE 0 END), 0) AS upi_gross,
  ISNULL(SUM(CASE WHEN p.method = N''CARD'' THEN p.amount ELSE 0 END), 0) AS card_gross,
  ISNULL(SUM(p.amount), 0) AS total_gross
FROM pay p
WHERE p.pay_date BETWEEN @period_from AND @period_to
  AND NOT EXISTS (
    SELECT 1 FROM settled_dates s
    WHERE p.pay_date BETWEEN s.period_from AND s.period_to
  )
';

  EXEC sp_executesql @sql,
    N'@store_id INT, @period_from DATE, @period_to DATE',
    @store_id = @store_id,
    @period_from = @period_from,
    @period_to = @period_to;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Treasury_GetLedger
  @store_id     INT,
  @engine_mode  NVARCHAR(10) = N'shared',
  @ledger_key   NVARCHAR(30) = NULL,
  @from_date    DATE = NULL,
  @to_date      DATE = NULL,
  @offset       INT = 0,
  @limit        INT = 100
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @orders_table   NVARCHAR(128);
  DECLARE @payments_table NVARCHAR(128);
  DECLARE @sql            NVARCHAR(MAX);

  IF @offset < 0 SET @offset = 0;
  IF @limit < 1 SET @limit = 100;
  IF @limit > 500 SET @limit = 500;

  IF LOWER(LTRIM(RTRIM(@engine_mode))) = N'legacy'
  BEGIN
    SET @orders_table = N'dbo.pos_orders';
    SET @payments_table = N'dbo.pos_payments';
  END
  ELSE
  BEGIN
    SET @orders_table = N'dbo.oe_orders';
    SET @payments_table = N'dbo.oe_payments';
  END;

  SET @sql = N'
;WITH collections AS (
  SELECT
    N''collection'' AS row_type,
    p.payment_id AS source_id,
    o.order_id,
    o.order_no,
    CONVERT(DATE, p.created_at) AS entry_date,
    p.created_at AS entry_at,
    CASE UPPER(LTRIM(RTRIM(p.method)))
      WHEN N''CASH'' THEN N''store_cash''
      ELSE N''payment_machine''
    END AS ledger_key,
    UPPER(LTRIM(RTRIM(p.method))) AS sub_method,
    N''in'' AS direction,
    p.amount,
    NULL AS charges_amount,
    NULL AS net_amount,
    p.external_ref,
    NULL AS bank_ref,
    p.stage AS payment_stage
  FROM ' + @payments_table + N' p
  INNER JOIN ' + @orders_table + N' o ON o.order_id = p.order_id
  WHERE o.store_id = @store_id
    AND ISNULL(o.status, N'''') <> N''CANCELLED''
    AND UPPER(LTRIM(RTRIM(ISNULL(o.order_kind, N'''')))) <> N''MEMBERSHIP''
),
mem_collections AS (
  SELECT
    N''membership_collection'' AS row_type,
    mp.payment_id AS source_id,
    ms.membership_sale_id AS order_id,
    ms.invoice_no AS order_no,
    CONVERT(DATE, mp.created_at) AS entry_date,
    mp.created_at AS entry_at,
    CASE UPPER(LTRIM(RTRIM(mp.method)))
      WHEN N''CASH'' THEN N''membership_store_cash''
      ELSE N''membership_payment_machine''
    END AS ledger_key,
    UPPER(LTRIM(RTRIM(mp.method))) AS sub_method,
    N''in'' AS direction,
    mp.amount,
    NULL AS charges_amount,
    NULL AS net_amount,
    mp.external_ref,
    NULL AS bank_ref,
    mp.stage AS payment_stage
  FROM dbo.pos_membership_payments mp
  INNER JOIN dbo.pos_membership_sales ms ON ms.membership_sale_id = mp.membership_sale_id
  WHERE ms.store_id = @store_id
    AND ISNULL(ms.status, N'''') = N''PAID''
),
transfers AS (
  SELECT
    CASE WHEN t.transfer_type = N''cash_deposit'' THEN N''cash_deposit'' ELSE N''machine_settlement'' END AS row_type,
    t.transfer_id AS source_id,
    NULL AS order_id,
    NULL AS order_no,
    t.transfer_date AS entry_date,
    t.created_at AS entry_at,
    t.from_ledger_key AS ledger_key,
    CASE WHEN t.transfer_type = N''machine_settlement'' THEN N''MACHINE'' ELSE N''CASH'' END AS sub_method,
    N''out'' AS direction,
    t.gross_amount AS amount,
    t.charges_amount,
    t.net_amount,
    NULL AS external_ref,
    t.bank_ref,
    NULL AS payment_stage
  FROM dbo.store_treasury_transfers t
  WHERE t.store_id = @store_id
    AND t.status = N''posted''
  UNION ALL
  SELECT
    N''bank_credit'' AS row_type,
    t.transfer_id AS source_id,
    NULL, NULL,
    t.transfer_date,
    t.created_at,
    t.to_ledger_key,
    CASE WHEN t.transfer_type = N''machine_settlement'' THEN N''MACHINE'' ELSE N''CASH'' END,
    N''in'',
    t.net_amount,
    t.charges_amount,
    t.net_amount,
    NULL,
    t.bank_ref,
    NULL
  FROM dbo.store_treasury_transfers t
  WHERE t.store_id = @store_id
    AND t.status = N''posted''
),
combined AS (
  SELECT * FROM collections
  UNION ALL
  SELECT * FROM mem_collections
  UNION ALL
  SELECT * FROM transfers
)
SELECT *
FROM combined c
WHERE (@ledger_key IS NULL OR c.ledger_key = @ledger_key)
  AND (@from_date IS NULL OR c.entry_date >= @from_date)
  AND (@to_date IS NULL OR c.entry_date <= @to_date)
ORDER BY c.entry_at DESC, c.source_id DESC
OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
';

  EXEC sp_executesql @sql,
    N'@store_id INT, @ledger_key NVARCHAR(30), @from_date DATE, @to_date DATE, @offset INT, @limit INT',
    @store_id = @store_id,
    @ledger_key = @ledger_key,
    @from_date = @from_date,
    @to_date = @to_date,
    @offset = @offset,
    @limit = @limit;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Treasury_GetStoresSummary
  @engine_mode NVARCHAR(10) = N'shared'
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @stores TABLE (store_id INT PRIMARY KEY, store_name NVARCHAR(200), store_code NVARCHAR(20));

  INSERT INTO @stores (store_id, store_name, store_code)
  SELECT s.store_id, s.store_name, s.store_code
  FROM dbo.stores s
  WHERE s.is_active = 1;

  DECLARE @sid INT;
  DECLARE @results TABLE (
    store_id INT,
    store_name NVARCHAR(200),
    store_code NVARCHAR(20),
    store_cash_balance DECIMAL(12,2),
    machine_upi_pending DECIMAL(12,2),
    machine_card_pending DECIMAL(12,2),
    machine_total_pending DECIMAL(12,2),
    store_bank_balance DECIMAL(12,2),
    machine_provider_key NVARCHAR(50),
    has_bank_account BIT
  );

  DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT store_id FROM @stores;
  OPEN cur;
  FETCH NEXT FROM cur INTO @sid;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    DECLARE @cash DECIMAL(12,2), @upi DECIMAL(12,2), @card DECIMAL(12,2), @mtot DECIMAL(12,2), @bank DECIMAL(12,2);
    DECLARE @prov NVARCHAR(50);
    DECLARE @hasBank BIT = 0;

    CREATE TABLE #sum (
      store_id INT,
      store_cash_balance DECIMAL(12,2),
      machine_upi_pending DECIMAL(12,2),
      machine_card_pending DECIMAL(12,2),
      machine_total_pending DECIMAL(12,2),
      unsettled_machine_from DATE,
      unsettled_machine_to DATE,
      store_bank_balance DECIMAL(12,2),
      collected_today_cash DECIMAL(12,2),
      collected_today_upi DECIMAL(12,2),
      collected_today_card DECIMAL(12,2),
      collected_all_cash DECIMAL(12,2),
      collected_all_upi DECIMAL(12,2),
      collected_all_card DECIMAL(12,2),
      membership_store_cash_balance DECIMAL(12,2),
      membership_machine_total_pending DECIMAL(12,2),
      membership_machine_upi_pending DECIMAL(12,2),
      membership_machine_card_pending DECIMAL(12,2),
      membership_collected_today_cash DECIMAL(12,2),
      membership_collected_today_upi DECIMAL(12,2),
      membership_collected_today_card DECIMAL(12,2),
      membership_store_bank_balance DECIMAL(12,2)
    );

    INSERT INTO #sum
    EXEC dbo.sp_Treasury_GetSummary @store_id = @sid, @engine_mode = @engine_mode;

    SELECT TOP 1
      @cash = store_cash_balance,
      @upi = machine_upi_pending,
      @card = machine_card_pending,
      @mtot = machine_total_pending,
      @bank = store_bank_balance
    FROM #sum;

    SELECT TOP 1 @prov = provider_key FROM dbo.store_payment_machines WHERE store_id = @sid AND is_active = 1;
    IF EXISTS (SELECT 1 FROM dbo.store_bank_accounts WHERE store_id = @sid AND is_active = 1 AND is_primary = 1)
      SET @hasBank = 1;

    INSERT INTO @results
    SELECT st.store_id, st.store_name, st.store_code, @cash, @upi, @card, @mtot, @bank, @prov, @hasBank
    FROM @stores st WHERE st.store_id = @sid;

    DROP TABLE #sum;
    FETCH NEXT FROM cur INTO @sid;
  END
  CLOSE cur;
  DEALLOCATE cur;

  SELECT * FROM @results ORDER BY store_name;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Treasury_UpsertBankAccount
  @store_id                 INT,
  @bank_name                NVARCHAR(200),
  @account_no               NVARCHAR(50),
  @ifsc                     NVARCHAR(20) = NULL,
  @account_holder           NVARCHAR(200) = NULL,
  @existing_bank_account_id INT = NULL,
  @bank_account_id          INT OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

  IF @bank_name IS NULL OR LTRIM(RTRIM(@bank_name)) = N'' OR @account_no IS NULL OR LTRIM(RTRIM(@account_no)) = N''
  BEGIN
    RAISERROR(N'Bank name and account number are required.', 16, 1);
    RETURN;
  END;

  UPDATE dbo.store_bank_accounts SET is_primary = 0, updated_at = @now WHERE store_id = @store_id;

  IF @existing_bank_account_id IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.store_bank_accounts WHERE bank_account_id = @existing_bank_account_id AND store_id = @store_id)
  BEGIN
    UPDATE dbo.store_bank_accounts
    SET bank_name = @bank_name, account_no = @account_no, ifsc = @ifsc, account_holder = @account_holder,
        is_primary = 1, is_active = 1, updated_at = @now
    WHERE bank_account_id = @existing_bank_account_id;
    SET @bank_account_id = @existing_bank_account_id;
  END
  ELSE
  BEGIN
    INSERT INTO dbo.store_bank_accounts (store_id, bank_name, account_no, ifsc, account_holder, is_primary, is_active, created_at, updated_at)
    VALUES (@store_id, @bank_name, @account_no, @ifsc, @account_holder, 1, 1, @now, @now);
    SET @bank_account_id = SCOPE_IDENTITY();
  END;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Treasury_UpsertPaymentMachine
  @store_id       INT,
  @provider_key   NVARCHAR(50),
  @merchant_id    NVARCHAR(100) = NULL,
  @terminal_label NVARCHAR(200) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

  IF @provider_key IS NULL OR LTRIM(RTRIM(@provider_key)) = N''
  BEGIN
    RAISERROR(N'Payment machine provider is required.', 16, 1);
    RETURN;
  END;

  IF EXISTS (SELECT 1 FROM dbo.store_payment_machines WHERE store_id = @store_id)
  BEGIN
    UPDATE dbo.store_payment_machines
    SET provider_key = LOWER(LTRIM(RTRIM(@provider_key))),
        merchant_id = @merchant_id,
        terminal_label = @terminal_label,
        is_active = 1,
        updated_at = @now
    WHERE store_id = @store_id;
  END
  ELSE
  BEGIN
    INSERT INTO dbo.store_payment_machines (store_id, provider_key, merchant_id, terminal_label, is_active, created_at, updated_at)
    VALUES (@store_id, LOWER(LTRIM(RTRIM(@provider_key))), @merchant_id, @terminal_label, 1, @now, @now);
  END;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Treasury_GetBankAccount
  @store_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT TOP 1 *
  FROM dbo.store_bank_accounts
  WHERE store_id = @store_id AND is_active = 1 AND is_primary = 1
  ORDER BY bank_account_id DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Treasury_GetPaymentMachine
  @store_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT TOP 1 *
  FROM dbo.store_payment_machines
  WHERE store_id = @store_id AND is_active = 1;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Treasury_CreateTransfer
  @store_id         INT,
  @transfer_type    NVARCHAR(30),
  @period_from      DATE = NULL,
  @period_to        DATE = NULL,
  @gross_amount     DECIMAL(12,2),
  @charges_amount   DECIMAL(12,2) = 0,
  @net_amount       DECIMAL(12,2),
  @bank_account_id  INT = NULL,
  @bank_ref         NVARCHAR(200) = NULL,
  @transfer_date    DATE,
  @notes            NVARCHAR(500) = NULL,
  @created_by       INT = NULL,
  @engine_mode      NVARCHAR(10) = N'shared',
  @transfer_id      INT = NULL OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());
  DECLARE @from_ledger NVARCHAR(30);
  DECLARE @to_ledger NVARCHAR(30) = N'store_bank';
  DECLARE @cash_bal DECIMAL(12,2);
  DECLARE @suggest_total DECIMAL(12,2);

  IF @transfer_type NOT IN (N'cash_deposit', N'machine_settlement')
  BEGIN
    RAISERROR(N'Invalid transfer type.', 16, 1);
    RETURN;
  END;

  IF @gross_amount IS NULL OR @gross_amount <= 0
  BEGIN
    RAISERROR(N'Gross amount must be greater than zero.', 16, 1);
    RETURN;
  END;

  IF @net_amount IS NULL OR @net_amount < 0
  BEGIN
    RAISERROR(N'Net amount is invalid.', 16, 1);
    RETURN;
  END;

  IF @transfer_date IS NULL
    SET @transfer_date = CONVERT(DATE, @now);

  IF @bank_account_id IS NULL
  BEGIN
    SELECT TOP 1 @bank_account_id = bank_account_id
    FROM dbo.store_bank_accounts
    WHERE store_id = @store_id AND is_active = 1 AND is_primary = 1;
  END;

  IF @bank_account_id IS NULL
  BEGIN
    RAISERROR(N'Store bank account is not configured.', 16, 1);
    RETURN;
  END;

  IF @transfer_type = N'cash_deposit'
  BEGIN
    SET @from_ledger = N'store_cash';
    SET @charges_amount = 0;
    SET @net_amount = @gross_amount;

    CREATE TABLE #cashsum (
      store_id INT,
      store_cash_balance DECIMAL(12,2),
      machine_upi_pending DECIMAL(12,2),
      machine_card_pending DECIMAL(12,2),
      machine_total_pending DECIMAL(12,2),
      unsettled_machine_from DATE,
      unsettled_machine_to DATE,
      store_bank_balance DECIMAL(12,2),
      collected_today_cash DECIMAL(12,2),
      collected_today_upi DECIMAL(12,2),
      collected_today_card DECIMAL(12,2),
      collected_all_cash DECIMAL(12,2),
      collected_all_upi DECIMAL(12,2),
      collected_all_card DECIMAL(12,2),
      membership_store_cash_balance DECIMAL(12,2),
      membership_machine_total_pending DECIMAL(12,2),
      membership_machine_upi_pending DECIMAL(12,2),
      membership_machine_card_pending DECIMAL(12,2),
      membership_collected_today_cash DECIMAL(12,2),
      membership_collected_today_upi DECIMAL(12,2),
      membership_collected_today_card DECIMAL(12,2),
      membership_store_bank_balance DECIMAL(12,2)
    );
    INSERT INTO #cashsum EXEC dbo.sp_Treasury_GetSummary @store_id = @store_id, @engine_mode = @engine_mode;
    SELECT TOP 1 @cash_bal = store_cash_balance + ISNULL(membership_store_cash_balance, 0) FROM #cashsum;
    DROP TABLE #cashsum;

    IF @gross_amount > @cash_bal + 0.02
    BEGIN
      RAISERROR(N'Cash deposit exceeds Store Cash balance.', 16, 1);
      RETURN;
    END;
  END
  ELSE
  BEGIN
    SET @from_ledger = N'payment_machine';

    IF @period_from IS NULL OR @period_to IS NULL OR @period_from > @period_to
    BEGIN
      RAISERROR(N'Settlement period is required.', 16, 1);
      RETURN;
    END;

    IF EXISTS (
      SELECT 1 FROM dbo.store_treasury_transfers
      WHERE store_id = @store_id AND transfer_type = N'machine_settlement' AND status = N'posted'
        AND NOT (@period_to < period_from OR @period_from > period_to)
    )
    BEGIN
      RAISERROR(N'A machine settlement already exists for an overlapping period.', 16, 1);
      RETURN;
    END;

    CREATE TABLE #suggest (upi_gross DECIMAL(12,2), card_gross DECIMAL(12,2), total_gross DECIMAL(12,2));
    INSERT INTO #suggest EXEC dbo.sp_Treasury_SuggestMachineGross
      @store_id = @store_id, @period_from = @period_from, @period_to = @period_to, @engine_mode = @engine_mode;
    SELECT TOP 1 @suggest_total = total_gross FROM #suggest;
    DROP TABLE #suggest;

    IF @gross_amount > @suggest_total + 0.02
    BEGIN
      DECLARE @errMsg NVARCHAR(300) = N'Settlement gross exceeds unsettled machine collections for this period. Available for selected dates: '
        + CONVERT(NVARCHAR(20), @suggest_total);
      RAISERROR(@errMsg, 16, 1);
      RETURN;
    END;

    IF ABS(@gross_amount - @charges_amount - @net_amount) > 0.02
    BEGIN
      RAISERROR(N'Net amount must equal gross minus charges.', 16, 1);
      RETURN;
    END;
  END;

  INSERT INTO dbo.store_treasury_transfers (
    store_id, transfer_type, period_from, period_to,
    gross_amount, charges_amount, net_amount,
    from_ledger_key, to_ledger_key,
    bank_account_id, bank_ref, transfer_date, notes,
    status, created_by, created_at, updated_at
  )
  VALUES (
    @store_id, @transfer_type, @period_from, @period_to,
    @gross_amount, ISNULL(@charges_amount, 0), @net_amount,
    @from_ledger, @to_ledger,
    @bank_account_id, @bank_ref, @transfer_date, @notes,
    N'posted', @created_by, @now, @now
  );

  SET @transfer_id = SCOPE_IDENTITY();
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Treasury_VoidTransfer
  @transfer_id  INT,
  @void_reason  NVARCHAR(300) = NULL,
  @voided_by    INT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

  IF NOT EXISTS (SELECT 1 FROM dbo.store_treasury_transfers WHERE transfer_id = @transfer_id AND status = N'posted')
  BEGIN
    RAISERROR(N'Transfer not found or already void.', 16, 1);
    RETURN;
  END;

  UPDATE dbo.store_treasury_transfers
  SET status = N'void',
      void_reason = @void_reason,
      voided_by = @voided_by,
      voided_at = @now,
      updated_at = @now
  WHERE transfer_id = @transfer_id;
END;
GO
