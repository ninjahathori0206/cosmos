-- sp_User_SetPosPin for Command Unit POS PIN management (run if sql/sp/users.sql not redeployed).
USE [CosmosERP];
GO

IF OBJECT_ID('dbo.sp_User_SetPosPin', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_User_SetPosPin;
GO

CREATE PROCEDURE dbo.sp_User_SetPosPin
  @user_id  INT,
  @pin_hash VARCHAR(200)
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE dbo.users
  SET pos_pin_hash = @pin_hash,
      updated_at   = DATEADD(MINUTE, 330, SYSUTCDATETIME())
  WHERE user_id = @user_id;

  SELECT @@ROWCOUNT AS rows_updated;
END;
GO
