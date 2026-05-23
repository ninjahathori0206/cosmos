-- Backfill transfer_request_lines.received_qty from STOCKED transfer documents.
-- Requires sp_TransferRequest_SyncReceivedFromDocs (sql/sp/transfer_requests.sql).

DECLARE @request_id INT;

DECLARE req_cur CURSOR LOCAL FAST_FORWARD FOR
  SELECT DISTINCT d.source_request_id
  FROM dbo.stock_transfer_docs d
  WHERE d.source_request_id IS NOT NULL
    AND d.status = N'STOCKED';

OPEN req_cur;
FETCH NEXT FROM req_cur INTO @request_id;

WHILE @@FETCH_STATUS = 0
BEGIN
  EXEC dbo.sp_TransferRequest_SyncReceivedFromDocs @request_id = @request_id;
  FETCH NEXT FROM req_cur INTO @request_id;
END;

CLOSE req_cur;
DEALLOCATE req_cur;
