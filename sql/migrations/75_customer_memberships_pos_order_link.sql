-- Migration 75: Link customer_memberships to the POS order where membership was purchased
-- Adds nullable pos_order_id FK so CX staff can record which order triggered the grant.

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.customer_memberships') AND name = N'pos_order_id'
)
BEGIN
  ALTER TABLE dbo.customer_memberships
    ADD pos_order_id INT NULL
      CONSTRAINT FK_cm_pos_order FOREIGN KEY REFERENCES dbo.pos_orders(order_id);
END
GO

-- Re-run safe: no harm on repeat execution.
