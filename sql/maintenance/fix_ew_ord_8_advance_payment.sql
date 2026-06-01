-- Fix EW-ORD-8: wrongly recorded FULL ₹2,300 → ADVANCE ₹800 (balance ₹1,500 still due).
-- Idempotent when already corrected. Review preflight output before running the fix block.
-- Run against CosmosERP on SQL Server (SSMS or sqlcmd).

SET NOCOUNT ON;

DECLARE @order_no NVARCHAR(50) = N'EW-ORD-8';
DECLARE @advance_amt DECIMAL(12, 2) = 800.00;
DECLARE @order_id INT;
DECLARE @store_id INT;
DECLARE @payment_id INT;
DECLARE @payment_count INT;
DECLARE @total_amount DECIMAL(12, 2);
DECLARE @subtotal_amount DECIMAL(12, 2);
DECLARE @discount_amount DECIMAL(12, 2);
DECLARE @membership_amt DECIMAL(12, 2);
DECLARE @lab_part DECIMAL(12, 2);
DECLARE @product_sub DECIMAL(12, 2);
DECLARE @lab_base DECIMAL(12, 2);
DECLARE @new_pct DECIMAL(9, 2);
DECLARE @mode NVARCHAR(20);
DECLARE @orders_table SYSNAME;
DECLARE @payments_table SYSNAME;
DECLARE @sub_orders_table SYSNAME;
DECLARE @items_table SYSNAME;

SELECT @mode = LOWER(LTRIM(RTRIM(ISNULL(setting_value, N'legacy'))))
FROM dbo.app_settings
WHERE setting_key = N'orders_engine_mode';

IF @mode = N'shared'
BEGIN
  SET @orders_table = N'dbo.oe_orders';
  SET @payments_table = N'dbo.oe_payments';
  SET @sub_orders_table = N'dbo.oe_sub_orders';
  SET @items_table = N'dbo.oe_order_items';
END
ELSE
BEGIN
  SET @orders_table = N'dbo.pos_orders';
  SET @payments_table = N'dbo.pos_payments';
  SET @sub_orders_table = N'dbo.pos_sub_orders';
  SET @items_table = N'dbo.pos_order_items';
END;

PRINT N'orders_engine_mode: ' + ISNULL(@mode, N'legacy');
PRINT N'Using tables: ' + @orders_table + N', ' + @payments_table;

-- ── Preflight ────────────────────────────────────────────────────────────────
SELECT @order_id = o.order_id,
       @store_id = o.store_id,
       @total_amount = o.total_amount,
       @subtotal_amount = o.subtotal_amount,
       @discount_amount = ISNULL(o.discount_amount, 0),
       @membership_amt = ISNULL(o.sold_membership_amount, 0)
FROM dbo.pos_orders o
WHERE o.order_no = @order_no;

IF @order_id IS NULL AND @mode = N'shared' AND OBJECT_ID(N'dbo.oe_orders', N'U') IS NOT NULL
BEGIN
  SELECT @order_id = o.order_id,
         @store_id = o.store_id,
         @total_amount = o.total_amount,
         @subtotal_amount = o.subtotal_amount,
         @discount_amount = ISNULL(o.discount_amount, 0),
         @membership_amt = ISNULL(o.sold_membership_amount, 0)
  FROM dbo.oe_orders o
  WHERE o.order_no = @order_no;
END

IF @order_id IS NULL
BEGIN
  RAISERROR(N'Order %s not found.', 16, 1, @order_no);
  RETURN;
END

PRINT N'--- Preflight: order ---';
SELECT order_id, order_no, status, order_kind, total_amount, subtotal_amount,
       discount_amount, lab_advance_pct_snapshot, sold_membership_amount
FROM dbo.pos_orders WHERE order_id = @order_id;

PRINT N'--- Preflight: payments ---';
SELECT payment_id, order_id, stage, method, amount, tendered, change_given, created_at
FROM dbo.pos_payments WHERE order_id = @order_id ORDER BY payment_id;

SELECT @payment_count = COUNT(*), @payment_id = MIN(payment_id)
FROM dbo.pos_payments WHERE order_id = @order_id;

IF @payment_count <> 1
BEGIN
  RAISERROR(N'Expected exactly 1 payment row for %s; found %d. Abort.', 16, 1, @order_no, @payment_count);
  RETURN;
END

PRINT N'--- Preflight: invoice / lab / membership ---';
IF OBJECT_ID(N'dbo.pos_invoices', N'U') IS NOT NULL
  SELECT invoice_id, invoice_no, total_amount FROM dbo.pos_invoices WHERE order_id = @order_id;

SELECT sub_order_id, fulfillment, lab_workflow_status, handover_status
FROM dbo.pos_sub_orders WHERE order_id = @order_id;

IF OBJECT_ID(N'dbo.customer_memberships', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.customer_memberships', N'pos_order_id') IS NOT NULL
  SELECT membership_id, customer_id, plan_key, pos_order_id
  FROM dbo.customer_memberships WHERE pos_order_id = @order_id;

-- Lab base for advance pct (pro-rate order discount onto LAB lines)
SELECT @lab_part = ISNULL(SUM(CAST(i.line_total AS DECIMAL(12, 2))), 0)
FROM dbo.pos_order_items i
INNER JOIN dbo.pos_sub_orders s ON s.sub_order_id = i.sub_order_id
WHERE s.order_id = @order_id AND s.fulfillment = N'LAB';

SET @product_sub = CASE WHEN @subtotal_amount - @membership_amt > 0
  THEN @subtotal_amount - @membership_amt ELSE @subtotal_amount END;

IF @product_sub > 0.009 AND @discount_amount > 0.009 AND @lab_part > 0.009
  SET @lab_base = ROUND((@lab_part / @product_sub) * (@product_sub - @discount_amount), 2);
ELSE
  SET @lab_base = @lab_part;

IF @lab_base <= 0.009
BEGIN
  RAISERROR(N'Cannot compute lab base for advance pct on order %s.', 16, 1, @order_no);
  RETURN;
END

SET @new_pct = ROUND(@advance_amt / @lab_base * 100.0, 2);

PRINT N'Computed lab_base=' + CAST(@lab_base AS NVARCHAR(20))
  + N' new lab_advance_pct_snapshot=' + CAST(@new_pct AS NVARCHAR(20))
  + N' (advance target ₹800)';

-- Skip fix if already corrected
DECLARE @cur_stage NVARCHAR(20);
DECLARE @cur_amt DECIMAL(12, 2);
SELECT @cur_stage = stage, @cur_amt = amount FROM dbo.pos_payments WHERE payment_id = @payment_id;

IF @cur_stage = N'ADVANCE' AND ABS(@cur_amt - @advance_amt) < 0.01
BEGIN
  PRINT N'Already corrected — payment is ADVANCE ₹800. Skipping updates.';
  GOTO post_fix;
END

-- ── Fix (transaction) ────────────────────────────────────────────────────────
BEGIN TRANSACTION;

BEGIN TRY
  UPDATE dbo.pos_payments
  SET stage = N'ADVANCE',
      amount = @advance_amt,
      tendered = CASE WHEN method = N'CASH' THEN @advance_amt ELSE tendered END
  WHERE payment_id = @payment_id AND order_id = @order_id;

  IF @@ROWCOUNT <> 1
    RAISERROR(N'pos_payments update failed.', 16, 1);

  IF OBJECT_ID(N'dbo.oe_payments', N'U') IS NOT NULL
  BEGIN
    UPDATE dbo.oe_payments
    SET stage = N'ADVANCE',
        amount = @advance_amt,
        tendered = CASE WHEN method = N'CASH' THEN @advance_amt ELSE tendered END
    WHERE legacy_pos_payment_id = @payment_id;
  END

  UPDATE dbo.pos_orders
  SET lab_advance_pct_snapshot = @new_pct
  WHERE order_id = @order_id;

  IF OBJECT_ID(N'dbo.oe_orders', N'U') IS NOT NULL
  BEGIN
    UPDATE oe
    SET lab_advance_pct_snapshot = @new_pct
    FROM dbo.oe_orders oe
    INNER JOIN dbo.pos_orders po ON po.order_id = oe.legacy_pos_order_id
    WHERE po.order_id = @order_id;
  END

  IF EXISTS (SELECT 1 FROM dbo.pos_orders WHERE order_id = @order_id AND status = N'COMPLETED')
    UPDATE dbo.pos_orders SET status = N'OPEN' WHERE order_id = @order_id;

  IF OBJECT_ID(N'dbo.oe_orders', N'U') IS NOT NULL
  BEGIN
    UPDATE oe SET status = N'OPEN'
    FROM dbo.oe_orders oe
    INNER JOIN dbo.pos_orders po ON po.order_id = oe.legacy_pos_order_id
    WHERE po.order_id = @order_id AND oe.status = N'COMPLETED';
  END

  IF OBJECT_ID(N'dbo.pos_invoices', N'U') IS NOT NULL
    DELETE FROM dbo.pos_invoices WHERE order_id = @order_id;

  UPDATE dbo.pos_sub_orders
  SET lab_workflow_status = N'ORDER_PLACED'
  WHERE order_id = @order_id
    AND fulfillment = N'LAB'
    AND lab_workflow_status IN (N'DELIVERED', N'BALANCE_COLLECTED', N'INVOICED', N'READY_FOR_DELIVERY');

  COMMIT TRANSACTION;
  PRINT N'Fix applied successfully.';
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH

post_fix:
PRINT N'--- Post-fix: payments ---';
SELECT payment_id, stage, method, amount, tendered FROM dbo.pos_payments WHERE order_id = @order_id;

PRINT N'--- Post-fix: order ---';
SELECT order_id, order_no, status, total_amount, lab_advance_pct_snapshot FROM dbo.pos_orders WHERE order_id = @order_id;

DECLARE @paid DECIMAL(12, 2);
SELECT @paid = ISNULL(SUM(amount), 0) FROM dbo.pos_payments WHERE order_id = @order_id;
PRINT N'Paid total: ' + CAST(@paid AS NVARCHAR(20)) + N' | Balance due: ' + CAST(@total_amount - @paid AS NVARCHAR(20));
