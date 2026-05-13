/*
  Cosmos ERP — Database bootstrap

  Creates the CosmosERP database on your SQL Server instance.
  Run once with sufficient privileges (e.g. SSMS or sqlcmd), then deploy
  schema using sql/manifest.json + sql/tables (see sql/README.md).
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

