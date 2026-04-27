PRINT 'Creating POS payments and invoices...';

USE [CosmosERP];
GO

IF OBJECT_ID('dbo.pos_payments', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.pos_payments (
    payment_id     INT IDENTITY(1,1) PRIMARY KEY,
    order_id       INT            NOT NULL,
    stage          NVARCHAR(20)   NOT NULL,
    method         NVARCHAR(20)   NOT NULL,
    amount         DECIMAL(12,2)  NOT NULL,
    tendered       DECIMAL(12,2)  NULL,
    change_given   DECIMAL(12,2)  NULL,
    external_ref   NVARCHAR(200)  NULL,
    created_by     INT            NULL,
    created_at     DATETIME       NOT NULL DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    CONSTRAINT FK_pos_payments_order FOREIGN KEY (order_id) REFERENCES dbo.pos_orders(order_id) ON DELETE CASCADE,
    CONSTRAINT FK_pos_payments_user FOREIGN KEY (created_by) REFERENCES dbo.users(user_id)
  );
END;
GO

IF OBJECT_ID('dbo.pos_invoices', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.pos_invoices (
    invoice_id     INT IDENTITY(1,1) PRIMARY KEY,
    order_id       INT            NOT NULL,
    invoice_no     NVARCHAR(50)   NOT NULL,
    taxable_amount DECIMAL(12,2)  NOT NULL,
    gst_amount     DECIMAL(12,2)  NOT NULL,
    total_amount   DECIMAL(12,2)  NOT NULL,
    created_at     DATETIME       NOT NULL DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    CONSTRAINT UQ_pos_invoices_no UNIQUE (invoice_no),
    CONSTRAINT FK_pos_invoices_order FOREIGN KEY (order_id) REFERENCES dbo.pos_orders(order_id) ON DELETE CASCADE
  );
END;
GO
