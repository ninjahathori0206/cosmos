/*
  Report sku_units linked to more than one transfer document (historical duplicates)
  or units still AVAILABLE at warehouse but on open DISPATCHED/ACCEPTED docs.

  Read-only — no data changes.
*/
USE [CosmosERP];
GO

SET NOCOUNT ON;

PRINT N'--- Units on multiple transfer documents ---';
SELECT
  u.unit_id,
  u.unit_barcode,
  u.sku_id,
  u.status,
  u.location_type,
  u.location_id,
  COUNT(DISTINCT du.doc_id) AS doc_count
FROM dbo.sku_units u
INNER JOIN dbo.stock_transfer_doc_units du ON du.unit_id = u.unit_id
GROUP BY u.unit_id, u.unit_barcode, u.sku_id, u.status, u.location_type, u.location_id
HAVING COUNT(DISTINCT du.doc_id) > 1
ORDER BY u.unit_barcode;

PRINT N'--- Units on open transfer but status still AVAILABLE at warehouse ---';
SELECT
  u.unit_id,
  u.unit_barcode,
  d.doc_id,
  d.status AS doc_status,
  d.to_store_id,
  u.status AS unit_status,
  u.location_type,
  u.location_id
FROM dbo.sku_units u
INNER JOIN dbo.stock_transfer_doc_units du ON du.unit_id = u.unit_id
INNER JOIN dbo.stock_transfer_docs d ON d.doc_id = du.doc_id
WHERE d.status IN (N'DISPATCHED', N'ACCEPTED')
  AND u.status = N'AVAILABLE'
  AND u.location_type = N'WAREHOUSE'
ORDER BY u.unit_barcode, d.doc_id;

GO
