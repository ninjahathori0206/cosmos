PRINT 'Creating POS points ledger...';

USE [CosmosERP];
GO

IF OBJECT_ID('dbo.pos_points_ledger', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.pos_points_ledger (
    ledger_id      INT IDENTITY(1,1) PRIMARY KEY,
    customer_id    INT            NOT NULL,
    order_id       INT            NULL,
    points_delta   INT            NOT NULL,
    balance_after  INT            NOT NULL,
    reason         NVARCHAR(100)  NOT NULL,
    created_at     DATETIME       NOT NULL DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    CONSTRAINT FK_pos_points_customer FOREIGN KEY (customer_id) REFERENCES dbo.pos_customers(customer_id),
    CONSTRAINT FK_pos_points_order FOREIGN KEY (order_id) REFERENCES dbo.pos_orders(order_id)
  );
END;
GO
