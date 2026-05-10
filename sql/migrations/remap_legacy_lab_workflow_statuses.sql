PRINT 'Remapping legacy lab_workflow_status (LAB_PROCESSING, CUSTOMER_NOTIFIED) to new workflow keys...';

USE [CosmosERP];
GO

/*
  Maps rows left on the pre-lab-workflow-revision graph:

  - LAB_PROCESSING    -> LAB_FITTING        (equivalent "work in lab" stage before QC)
  - CUSTOMER_NOTIFIED -> READY_FOR_DELIVERY (staff inspected first THEN notified customer;
                                             so notified = QC already done + ready for handover.
                                             Maps to READY_FOR_DELIVERY so staff can go straight
                                             to Collect Balance with no extra confirmation.)

  Idempotent: second run updates 0 rows; log INSERTs only while old status rows exist.

  Applies to LAB fulfillment sub-orders only in both legacy (pos_*) and shared (oe_*) tables.

  NOTE: The new store QC workflow has 3 outcomes -- PASS, PARTIAL (fail but hand over),
  FAIL (send back to foundry). PARTIAL is not yet a distinct status; it must be added
  as STORE_QC_PARTIAL in pos_lab_transitions + the StorePilot UI in a follow-up task.
*/

IF OBJECT_ID('dbo.pos_sub_orders', 'U') IS NOT NULL
BEGIN
  DECLARE @pos_lp INT = (SELECT COUNT(*) FROM dbo.pos_sub_orders WHERE fulfillment = N'LAB' AND lab_workflow_status = N'LAB_PROCESSING');
  DECLARE @pos_cn INT = (SELECT COUNT(*) FROM dbo.pos_sub_orders WHERE fulfillment = N'LAB' AND lab_workflow_status = N'CUSTOMER_NOTIFIED');
  PRINT CONCAT(N'pos_sub_orders LAB_PROCESSING: ', @pos_lp, N'; CUSTOMER_NOTIFIED: ', @pos_cn);

  IF OBJECT_ID('dbo.pos_order_status_log', 'U') IS NOT NULL
  BEGIN
    INSERT INTO dbo.pos_order_status_log (order_id, sub_order_id, from_status, to_status, actor_user_id, note)
    SELECT so.order_id, so.sub_order_id, N'LAB_PROCESSING', N'LAB_FITTING', NULL,
           N'Migration remap_legacy_lab_workflow_statuses: LAB_PROCESSING -> LAB_FITTING'
    FROM dbo.pos_sub_orders so
    WHERE so.fulfillment = N'LAB' AND so.lab_workflow_status = N'LAB_PROCESSING';

    INSERT INTO dbo.pos_order_status_log (order_id, sub_order_id, from_status, to_status, actor_user_id, note)
    SELECT so.order_id, so.sub_order_id, N'CUSTOMER_NOTIFIED', N'READY_FOR_DELIVERY', NULL,
           N'Migration remap_legacy_lab_workflow_statuses: CUSTOMER_NOTIFIED -> READY_FOR_DELIVERY'
    FROM dbo.pos_sub_orders so
    WHERE so.fulfillment = N'LAB' AND so.lab_workflow_status = N'CUSTOMER_NOTIFIED';
  END;

  UPDATE dbo.pos_sub_orders
  SET lab_workflow_status = N'LAB_FITTING'
  WHERE fulfillment = N'LAB' AND lab_workflow_status = N'LAB_PROCESSING';

  UPDATE dbo.pos_sub_orders
  SET lab_workflow_status = N'READY_FOR_DELIVERY'
  WHERE fulfillment = N'LAB' AND lab_workflow_status = N'CUSTOMER_NOTIFIED';
END;
GO

IF OBJECT_ID('dbo.oe_sub_orders', 'U') IS NOT NULL
BEGIN
  DECLARE @oe_lp INT = (SELECT COUNT(*) FROM dbo.oe_sub_orders WHERE fulfillment = N'LAB' AND lab_workflow_status = N'LAB_PROCESSING');
  DECLARE @oe_cn INT = (SELECT COUNT(*) FROM dbo.oe_sub_orders WHERE fulfillment = N'LAB' AND lab_workflow_status = N'CUSTOMER_NOTIFIED');
  PRINT CONCAT(N'oe_sub_orders LAB_PROCESSING: ', @oe_lp, N'; CUSTOMER_NOTIFIED: ', @oe_cn);

  IF OBJECT_ID('dbo.oe_order_status_log', 'U') IS NOT NULL
  BEGIN
    INSERT INTO dbo.oe_order_status_log (order_id, sub_order_id, from_status, to_status, actor_user_id, note)
    SELECT so.order_id, so.sub_order_id, N'LAB_PROCESSING', N'LAB_FITTING', NULL,
           N'Migration remap_legacy_lab_workflow_statuses: LAB_PROCESSING -> LAB_FITTING'
    FROM dbo.oe_sub_orders so
    WHERE so.fulfillment = N'LAB' AND so.lab_workflow_status = N'LAB_PROCESSING';

    INSERT INTO dbo.oe_order_status_log (order_id, sub_order_id, from_status, to_status, actor_user_id, note)
    SELECT so.order_id, so.sub_order_id, N'CUSTOMER_NOTIFIED', N'READY_FOR_DELIVERY', NULL,
           N'Migration remap_legacy_lab_workflow_statuses: CUSTOMER_NOTIFIED -> READY_FOR_DELIVERY'
    FROM dbo.oe_sub_orders so
    WHERE so.fulfillment = N'LAB' AND so.lab_workflow_status = N'CUSTOMER_NOTIFIED';
  END;

  UPDATE dbo.oe_sub_orders
  SET lab_workflow_status = N'LAB_FITTING'
  WHERE fulfillment = N'LAB' AND lab_workflow_status = N'LAB_PROCESSING';

  UPDATE dbo.oe_sub_orders
  SET lab_workflow_status = N'READY_FOR_DELIVERY'
  WHERE fulfillment = N'LAB' AND lab_workflow_status = N'CUSTOMER_NOTIFIED';
END;
GO
