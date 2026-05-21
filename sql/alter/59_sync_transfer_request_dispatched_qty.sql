-- Migration 59: sync transfer_request_lines.dispatched_qty from shipped transfer docs
USE [CosmosERP];
GO

UPDATE l
SET dispatched_qty = agg.total_sent
FROM dbo.transfer_request_lines l
INNER JOIN (
  SELECT
    d.source_request_id AS request_id,
    dl.sku_id,
    SUM(dl.qty_sent) AS total_sent
  FROM dbo.stock_transfer_docs d
  INNER JOIN dbo.stock_transfer_doc_lines dl ON dl.doc_id = d.doc_id
  WHERE d.source_request_id IS NOT NULL
  GROUP BY d.source_request_id, dl.sku_id
) agg ON agg.request_id = l.request_id AND agg.sku_id = l.sku_id
WHERE ISNULL(l.dispatched_qty, 0) <> agg.total_sent;
GO

PRINT 'Migration 59: synced dispatched_qty from transfer docs — OK';
GO
