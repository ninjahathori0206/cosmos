/*
  Per-pair sub-orders: pair_index on each sub-order row; handover_status for INSTANT lanes.
  Applied to legacy pos_* and shared oe_* tables.
*/

PRINT N'Applying 41_sub_order_pair_handover (pair_index, handover_status)...';

USE [CosmosERP];
GO

IF COL_LENGTH(N'dbo.pos_sub_orders', N'pair_index') IS NULL
BEGIN
  ALTER TABLE dbo.pos_sub_orders ADD
    pair_index      INT NOT NULL CONSTRAINT DF_pos_so_pair_ix DEFAULT (1),
    handover_status NVARCHAR(30) NULL;
  PRINT N'Added pair_index, handover_status to pos_sub_orders.';
END
ELSE
  PRINT N'pos_sub_orders pair_index/handover columns already present.';
GO

UPDATE dbo.pos_sub_orders SET pair_index = 1 WHERE pair_index IS NULL OR pair_index < 1;
GO

IF COL_LENGTH(N'dbo.oe_sub_orders', N'pair_index') IS NULL
BEGIN
  ALTER TABLE dbo.oe_sub_orders ADD
    pair_index      INT NOT NULL CONSTRAINT DF_oe_so_pair_ix DEFAULT (1),
    handover_status NVARCHAR(30) NULL;
  PRINT N'Added pair_index, handover_status to oe_sub_orders.';
END
ELSE
  PRINT N'oe_sub_orders pair_index/handover columns already present.';
GO

UPDATE dbo.oe_sub_orders SET pair_index = 1 WHERE pair_index IS NULL OR pair_index < 1;
GO

PRINT N'41_sub_order_pair_handover done.';
GO
