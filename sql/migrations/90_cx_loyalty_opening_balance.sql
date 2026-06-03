/*
  90_cx_loyalty_opening_balance.sql
  ---------------------------------
  One-time: copy latest pos_points_ledger balance per customer into loyalty_ledger
  as LIVE MIGRATION rows. Safe to re-run (skips customers who already have MIGRATION row).

  Run after 90_cx_customer_360_phase1.sql when ready to populate loyalty_ledger.
  Does NOT enable loyalty_engine_v2 — that stays Phase 4 cutover.
*/
PRINT N'--- 90_cx_loyalty_opening_balance.sql ---';

USE [CosmosERP];
GO

IF OBJECT_ID(N'dbo.loyalty_ledger', N'U') IS NULL
BEGIN
  PRINT N'loyalty_ledger missing — run 90_cx_customer_360_phase1.sql first.';
  RETURN;
END

IF OBJECT_ID(N'dbo.pos_points_ledger', N'U') IS NULL
BEGIN
  PRINT N'pos_points_ledger missing — nothing to migrate.';
  RETURN;
END

DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

;WITH latest AS (
  SELECT
    p.customer_id,
    p.balance_after,
    ROW_NUMBER() OVER (PARTITION BY p.customer_id ORDER BY p.ledger_id DESC) AS rn
  FROM dbo.pos_points_ledger p
)
INSERT INTO dbo.loyalty_ledger (
  customer_id,
  entry_type,
  status,
  coins_delta,
  balance_after,
  reason,
  available_at,
  created_at
)
SELECT
  l.customer_id,
  N'MIGRATION',
  N'LIVE',
  l.balance_after,
  l.balance_after,
  N'Opening balance migrated from pos_points_ledger',
  @now,
  @now
FROM latest l
WHERE l.rn = 1
  AND l.balance_after <> 0
  AND NOT EXISTS (
    SELECT 1
    FROM dbo.loyalty_ledger ll
    WHERE ll.customer_id = l.customer_id
      AND ll.entry_type = N'MIGRATION'
  );

PRINT N'Migrated opening balances: ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + N' customers.';
GO

PRINT N'--- 90_cx_loyalty_opening_balance.sql complete ---';
GO
