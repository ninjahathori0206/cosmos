/*
  Seed default Eyewoot Go membership_plans (idempotent).
  CX grant modal and customer_memberships FK require rows in membership_plans.
  Manage plans via Command Unit Membership Plans (/api/settings/membership-plans).
*/
USE [CosmosERP];
GO

IF OBJECT_ID('dbo.membership_plans', 'U') IS NULL
BEGIN
  PRINT 'membership_plans table missing — run 31_membership_plans.sql first.';
  RETURN;
END;

DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

MERGE dbo.membership_plans AS t
USING (
  SELECT *
  FROM (VALUES
    (N'PLUS',  N'Eyewoot Plus',     999.00, 365, 5, 1),
    (N'BASIC', N'Eyewoot Basic',    499.00, 365, 3, 1)
  ) AS s(plan_key, display_name, price, validity_days, max_dependents, is_active)
) AS src
ON t.plan_key = src.plan_key
WHEN MATCHED THEN
  UPDATE SET
    display_name   = src.display_name,
    price          = src.price,
    validity_days  = src.validity_days,
    max_dependents = src.max_dependents,
    is_active      = src.is_active
WHEN NOT MATCHED BY TARGET THEN
  INSERT (plan_key, display_name, price, validity_days, max_dependents, is_active, created_at)
  VALUES (src.plan_key, src.display_name, src.price, src.validity_days, src.max_dependents, src.is_active, @now);

PRINT 'Default membership_plans seeded (PLUS, BASIC).';
GO
