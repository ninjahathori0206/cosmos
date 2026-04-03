IF OBJECT_ID('dbo.sp_AuditLogs_GetRecent', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_AuditLogs_GetRecent;
GO

CREATE PROCEDURE dbo.sp_AuditLogs_GetRecent
  @Top INT = 50
AS
BEGIN
  SET NOCOUNT ON;

  SELECT TOP (@Top)
    a.audit_id,
    a.user_id,
    u.full_name AS user_full_name,
    a.action,
    a.module,
    a.entity_type,
    a.entity_id,
    a.old_value,
    a.new_value,
    a.ip_address,
    a.created_at
  FROM dbo.audit_logs a
  LEFT JOIN dbo.users u
    ON a.user_id = u.user_id
  ORDER BY a.created_at DESC, a.audit_id DESC;
END;
GO

