/*
  StorePilot — Day Store Report (single-store daily snapshot)
  Deploy: npm run migrate:82-storepilot-day-store-report
*/
USE [CosmosERP];
GO

CREATE OR ALTER PROCEDURE dbo.sp_StorePilot_DayStoreReport
  @store_id     INT,
  @report_date  DATE         = NULL,
  @engine_mode  NVARCHAR(10) = N'shared'
AS
BEGIN
  SET NOCOUNT ON;

  IF @report_date IS NULL
    SET @report_date = CONVERT(DATE, DATEADD(MINUTE, 330, SYSUTCDATETIME()));

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
SELECT
  @store_id AS store_id,
  @report_date AS report_date,
  ISNULL(s.store_name, N'''') AS store_name,
  ISNULL(inv.invoiced_revenue, 0) AS invoiced_revenue,
  ISNULL(inv.bill_count, 0) AS bill_count,
  ISNULL(inv.avg_invoice_amount, 0) AS avg_invoice_amount,
  ISNULL(bk.booking_revenue, 0) AS booking_revenue,
  ISNULL(bk.booking_count, 0) AS booking_count,
  ISNULL(bk.avg_booking_amount, 0) AS avg_booking_amount,
  ISNULL(col.collection_total, 0) AS collection_total,
  ISNULL(col.bank_collection, 0) AS bank_collection,
  ISNULL(col.cash_collection, 0) AS cash_collection,
  ISNULL(memcol.membership_collection_total, 0) AS membership_collection_total,
  ISNULL(memcol.membership_bank_collection, 0) AS membership_bank_collection,
  ISNULL(memcol.membership_cash_collection, 0) AS membership_cash_collection,
  ISNULL(mem.memberships_sold, 0) AS memberships_sold
FROM dbo.stores s
OUTER APPLY (
  SELECT
    COUNT(*) AS bill_count,
    ISNULL(SUM(pi.total_amount), 0) AS invoiced_revenue,
    CASE WHEN COUNT(*) > 0 THEN ISNULL(SUM(pi.total_amount), 0) / COUNT(*) ELSE 0 END AS avg_invoice_amount
  FROM dbo.pos_invoices pi
  INNER JOIN ' + @orders_table + N' o ON o.order_id = pi.order_id
  WHERE o.store_id = @store_id
    AND CONVERT(DATE, pi.created_at) = @report_date
    AND ISNULL(o.status, N'''') <> N''CANCELLED''
) inv
OUTER APPLY (
  SELECT
    COUNT(*) AS booking_count,
    ISNULL(SUM(o.total_amount - ISNULL(o.sold_membership_amount, 0)), 0) AS booking_revenue,
    CASE WHEN COUNT(*) > 0
      THEN ISNULL(SUM(o.total_amount - ISNULL(o.sold_membership_amount, 0)), 0) / COUNT(*)
      ELSE 0 END AS avg_booking_amount
  FROM ' + @orders_table + N' o
  WHERE o.store_id = @store_id
    AND CONVERT(DATE, o.created_at) = @report_date
    AND ISNULL(o.status, N'''') <> N''CANCELLED''
    AND (o.order_kind IS NULL OR UPPER(LTRIM(RTRIM(o.order_kind))) <> @mem_kind)
) bk
OUTER APPLY (
  SELECT
    ISNULL(SUM(p.amount), 0) AS collection_total,
    ISNULL(SUM(CASE WHEN UPPER(LTRIM(RTRIM(p.method))) = N''CASH'' THEN p.amount ELSE 0 END), 0) AS cash_collection,
    ISNULL(SUM(CASE WHEN UPPER(LTRIM(RTRIM(p.method))) IN (N''UPI'', N''CARD'') THEN p.amount ELSE 0 END), 0) AS bank_collection
  FROM ' + @payments_table + N' p
  INNER JOIN ' + @orders_table + N' o ON o.order_id = p.order_id
  WHERE o.store_id = @store_id
    AND CONVERT(DATE, p.created_at) = @report_date
    AND ISNULL(o.status, N'''') <> N''CANCELLED''
    AND UPPER(LTRIM(RTRIM(ISNULL(o.order_kind, N'''')))) <> N''MEMBERSHIP''
) col
OUTER APPLY (
  SELECT
    ISNULL(SUM(p.amount), 0) AS membership_collection_total,
    ISNULL(SUM(CASE WHEN UPPER(LTRIM(RTRIM(p.method))) = N''CASH'' THEN p.amount ELSE 0 END), 0) AS membership_cash_collection,
    ISNULL(SUM(CASE WHEN UPPER(LTRIM(RTRIM(p.method))) IN (N''UPI'', N''CARD'') THEN p.amount ELSE 0 END), 0) AS membership_bank_collection
  FROM dbo.pos_membership_payments p
  INNER JOIN dbo.pos_membership_sales ms ON ms.membership_sale_id = p.membership_sale_id
  WHERE ms.store_id = @store_id
    AND CONVERT(DATE, p.created_at) = @report_date
    AND ISNULL(ms.status, N'''') = N''PAID''
) memcol
OUTER APPLY (
  SELECT
    ISNULL((
      SELECT COUNT(*) FROM dbo.pos_membership_sales ms
      WHERE ms.store_id = @store_id
        AND CONVERT(DATE, ms.created_at) = @report_date
        AND ISNULL(ms.status, N'''') = N''PAID''
    ), 0)
    + ISNULL((
      SELECT COUNT(*) FROM dbo.pos_orders po
      WHERE po.store_id = @store_id
        AND CONVERT(DATE, po.created_at) = @report_date
        AND ISNULL(po.status, N'''') <> N''CANCELLED''
        AND po.sold_membership_plan_key IS NOT NULL
        AND LTRIM(RTRIM(po.sold_membership_plan_key)) <> N''''
        AND po.linked_membership_sale_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM dbo.pos_membership_sales ms2
          WHERE ms2.product_order_id = po.order_id AND ms2.status = N''PAID''
        )
    ), 0) AS memberships_sold
) mem
WHERE s.store_id = @store_id;
';

  EXEC sp_executesql @sql,
    N'@store_id INT, @report_date DATE, @mem_kind NVARCHAR(20)',
    @store_id = @store_id,
    @report_date = @report_date,
    @mem_kind = N'MEMBERSHIP';
END;
GO
