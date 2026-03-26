/*
  Cosmos ERP — Database Bootstrap Script

  This script creates the main MSSQL database used by the
  Node.js + stored procedure backend.

  Run this once against the server:
    Server: 147.93.153.10
    Port:   3411
    Login:  sa

  Example (SQL Server Management Studio):
    - Connect to 147.93.153.10,1433 or 147.93.153.10,3411
    - Open this file
    - Execute
*/

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'CosmosERP')
BEGIN
  PRINT 'Creating database [CosmosERP]...';

  CREATE DATABASE [CosmosERP];
END
GO

PRINT 'Using database [CosmosERP]...';
GO

USE [CosmosERP];
GO

/*
  At this point, you can run the table creation scripts from:
    sql/tables/*.sql
  followed by stored procedure scripts from:
    sql/sp/*.sql
*/

