-- Idempotent migration: copy historical POS orders into shared oe_* tables.
-- Run after 12_order_engine.sql. Safe to re-run (skips rows already linked by legacy ids).
-- Usage: executed from scripts/deploy_pos_sql.js after table scripts.

USE [CosmosERP];
GO

INSERT INTO dbo.oe_orders (
  store_id, customer_id, created_by_user_id, order_no, order_source, order_kind,
  rx_snapshot, gst_rate_snapshot, lab_advance_pct_snapshot, procurement_mode_snapshot,
  status, subtotal_amount, gst_amount, total_amount, created_at, legacy_pos_order_id
)
SELECT
  po.store_id, po.customer_id, po.created_by_user_id, po.order_no, po.order_source, po.order_kind,
  po.rx_snapshot, po.gst_rate_snapshot, po.lab_advance_pct_snapshot, po.procurement_mode_snapshot,
  po.status, po.subtotal_amount, po.gst_amount, po.total_amount, po.created_at, po.order_id
FROM dbo.pos_orders po
WHERE NOT EXISTS (SELECT 1 FROM dbo.oe_orders eo WHERE eo.legacy_pos_order_id = po.order_id);
GO

INSERT INTO dbo.oe_sub_orders (order_id, fulfillment, lab_workflow_status, sort_order, legacy_pos_sub_order_id)
SELECT
  eo.order_id, ps.fulfillment, ps.lab_workflow_status, ps.sort_order, ps.sub_order_id
FROM dbo.pos_sub_orders ps
INNER JOIN dbo.oe_orders eo ON eo.legacy_pos_order_id = ps.order_id
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.oe_sub_orders es WHERE es.legacy_pos_sub_order_id = ps.sub_order_id
);
GO

INSERT INTO dbo.oe_order_items (
  sub_order_id, sku_id, qty, unit_price, line_total, product_type, fulfillment, line_key, lens_bundle,
  legacy_pos_order_item_id
)
SELECT
  es.sub_order_id, pi.sku_id, pi.qty, pi.unit_price, pi.line_total, pi.product_type, pi.fulfillment, pi.line_key, pi.lens_bundle,
  pi.order_item_id
FROM dbo.pos_order_items pi
INNER JOIN dbo.oe_sub_orders es ON es.legacy_pos_sub_order_id = pi.sub_order_id
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.oe_order_items oi WHERE oi.legacy_pos_order_item_id = pi.order_item_id
);
GO

INSERT INTO dbo.oe_payments (
  order_id, stage, method, amount, tendered, change_given, external_ref, created_by, created_at,
  legacy_pos_payment_id
)
SELECT
  eo.order_id, pp.stage, pp.method, pp.amount, pp.tendered, pp.change_given, pp.external_ref, pp.created_by, pp.created_at,
  pp.payment_id
FROM dbo.pos_payments pp
INNER JOIN dbo.oe_orders eo ON eo.legacy_pos_order_id = pp.order_id
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.oe_payments op WHERE op.legacy_pos_payment_id = pp.payment_id
);
GO

INSERT INTO dbo.oe_order_status_log (
  order_id, sub_order_id, from_status, to_status, actor_user_id, note, created_at, legacy_pos_log_id
)
SELECT
  eo.order_id,
  CASE WHEN psl.sub_order_id IS NULL THEN NULL ELSE es.sub_order_id END,
  psl.from_status, psl.to_status, psl.actor_user_id, psl.note, psl.created_at,
  psl.log_id
FROM dbo.pos_order_status_log psl
INNER JOIN dbo.oe_orders eo ON eo.legacy_pos_order_id = psl.order_id
LEFT JOIN dbo.oe_sub_orders es ON es.legacy_pos_sub_order_id = psl.sub_order_id
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.oe_order_status_log ol WHERE ol.legacy_pos_log_id = psl.log_id
);
GO

-- Reconciliation (optional manual checks after migration):
-- SELECT COUNT(*) AS pos_orders FROM dbo.pos_orders;
-- SELECT COUNT(*) AS oe_migrated FROM dbo.oe_orders WHERE legacy_pos_order_id IS NOT NULL;
-- SELECT SUM(CAST(total_amount AS DECIMAL(18,2))) AS pos_total FROM dbo.pos_orders;
-- SELECT SUM(CAST(total_amount AS DECIMAL(18,2))) AS oe_total FROM dbo.oe_orders WHERE legacy_pos_order_id IS NOT NULL;
