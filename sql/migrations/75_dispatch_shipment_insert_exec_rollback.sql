-- 75: Fix shipment dispatch — ROLLBACK forbidden inside INSERT…EXEC child proc.
-- Deploy: npm run migrate:75-dispatch-shipment-rollback
-- (Re-applies sp_StockTransferDoc_Dispatch + sp_TransferRequest_DispatchShipment from sql/sp/)

USE [CosmosERP];
GO

-- Patched procedures are applied by scripts/run-migration-75-dispatch-shipment-rollback.js
-- from sql/sp/stock_transfer_docs.sql and sql/sp/transfer_requests.sql.
