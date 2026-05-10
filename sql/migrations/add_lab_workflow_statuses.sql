PRINT 'Updating POS lab workflow transitions...';

USE [CosmosERP];
GO

IF OBJECT_ID('dbo.pos_lab_transitions', 'U') IS NULL
BEGIN
  RAISERROR('Table dbo.pos_lab_transitions not found. Run sql/tables/05_pos_config.sql first.', 16, 1);
  RETURN;
END;
GO

-- Remove legacy transitions that this workflow replaces.
DELETE FROM dbo.pos_lab_transitions
WHERE (from_status = N'SENT_TO_LAB' AND to_status = N'LAB_PROCESSING')
   OR (from_status = N'LAB_PROCESSING' AND to_status IN (N'QC_PASS', N'QC_FAIL_LAB'))
   OR (from_status = N'QC_FAIL_LAB' AND to_status = N'LAB_PROCESSING')
   OR (from_status = N'RECEIVED_AT_STORE' AND to_status = N'CUSTOMER_NOTIFIED')
   OR (from_status = N'CUSTOMER_NOTIFIED' AND to_status = N'READY_FOR_DELIVERY');
GO

-- Upsert current transitions for the revised lifecycle.
MERGE dbo.pos_lab_transitions AS tgt
USING (
  SELECT * FROM (VALUES
    (N'ORDER_PLACED',                    N'ADVANCE_PAID',                    N'store_in_charge', 0),
    (N'ADVANCE_PAID',                    N'SENT_TO_LAB',                     N'store_in_charge', 0),
    (N'SENT_TO_LAB',                     N'FRAME_PENDING_LENS_BACKORDER',    N'lab_manager',     0),
    (N'FRAME_PENDING_LENS_BACKORDER',    N'FRAME_RECEIVED_LENS_BACKORDER',   N'lab_manager',     0),
    (N'FRAME_RECEIVED_LENS_BACKORDER',   N'FRAME_AND_LENS_RECEIVED',         N'lab_manager',     0),
    (N'FRAME_AND_LENS_RECEIVED',         N'LAB_FITTING',                     N'lab_manager',     0),
    (N'LAB_FITTING',                     N'QC_PASS',                         N'qc_team',         0),
    (N'LAB_FITTING',                     N'QC_FAIL_LAB',                     N'qc_team',         1),
    (N'QC_FAIL_LAB',                     N'LAB_FITTING',                     N'lab_manager',     0),
    (N'QC_PASS',                         N'DISPATCHED_TO_STORE',             N'lab_manager',     0),
    (N'DISPATCHED_TO_STORE',             N'RECEIVED_AT_STORE',               N'store_in_charge', 0),
    (N'RECEIVED_AT_STORE',               N'STORE_QC_PASS',                   N'store_in_charge', 0),
    (N'RECEIVED_AT_STORE',               N'STORE_QC_PARTIAL',                N'store_in_charge', 1),
    (N'RECEIVED_AT_STORE',               N'QC_FAIL_STORE',                   N'store_in_charge', 1),
    (N'QC_FAIL_STORE',                   N'SENT_TO_LAB',                     N'store_in_charge', 0),
    (N'STORE_QC_PASS',                   N'READY_FOR_DELIVERY',              N'store_staff',     0),
    (N'STORE_QC_PARTIAL',               N'READY_FOR_DELIVERY',              N'store_staff',     0),
    (N'READY_FOR_DELIVERY',              N'DELIVERED',                       N'store_staff',     0),
    (N'READY_FOR_DELIVERY',              N'DELIVERED',                       N'store_in_charge', 0),
    (N'DELIVERED',                       N'BALANCE_COLLECTED',               N'store_staff',     0),
    (N'DELIVERED',                       N'BALANCE_COLLECTED',               N'store_in_charge', 0),
    (N'BALANCE_COLLECTED',               N'INVOICED',                        N'system',          0),
    (N'BALANCE_COLLECTED',               N'INVOICED',                        N'store_in_charge', 0)
  ) AS s(from_status, to_status, actor_role, requires_note)
) AS src
ON tgt.from_status = src.from_status
AND tgt.to_status = src.to_status
AND tgt.actor_role = src.actor_role
WHEN MATCHED THEN
  UPDATE SET requires_note = src.requires_note
WHEN NOT MATCHED BY TARGET THEN
  INSERT (from_status, to_status, actor_role, requires_note)
  VALUES (src.from_status, src.to_status, src.actor_role, src.requires_note);
GO
