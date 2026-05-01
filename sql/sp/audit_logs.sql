IF OBJECT_ID('dbo.sp_AuditLog_Write', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_AuditLog_Write;
GO

CREATE PROCEDURE dbo.sp_AuditLog_Write
  @user_id     INT           = NULL,
  @action      VARCHAR(100),
  @module      VARCHAR(50),
  @entity_type VARCHAR(100),
  @entity_id   INT           = NULL,
  @old_value   VARCHAR(500)  = NULL,
  @new_value   VARCHAR(500)  = NULL,
  @ip_address  VARCHAR(50)   = NULL
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO dbo.audit_logs
    (user_id, action, module, entity_type, entity_id, old_value, new_value, ip_address)
  VALUES
    (@user_id, @action, @module, @entity_type, @entity_id, @old_value, @new_value, @ip_address);

  SELECT CAST(SCOPE_IDENTITY() AS INT) AS audit_id;
END;
GO

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

