/*
  Migration 94 — GatePass visit purpose catalog (HQ-configurable)
  Seeds defaults from gatepassPurposeCatalog.js fallbacks.
*/
SET NOCOUNT ON;

PRINT N'Migration 94: gatepass_purpose_catalog';

IF OBJECT_ID(N'dbo.gatepass_purpose_catalog', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.gatepass_purpose_catalog (
    purpose_key    VARCHAR(50)   NOT NULL CONSTRAINT PK_gatepass_purpose_catalog PRIMARY KEY,
    label          NVARCHAR(200) NOT NULL,
    badge_variant  VARCHAR(20)   NOT NULL CONSTRAINT DF_gatepass_purpose_badge DEFAULT (N'gray'),
    sort_order     INT           NOT NULL CONSTRAINT DF_gatepass_purpose_sort DEFAULT (100),
    is_active      BIT           NOT NULL CONSTRAINT DF_gatepass_purpose_active DEFAULT (1),
    created_at     DATETIME2(0)  NOT NULL CONSTRAINT DF_gatepass_purpose_created DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    updated_at     DATETIME2(0)  NOT NULL CONSTRAINT DF_gatepass_purpose_updated DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME()))
  );
  PRINT N'Migration 94: created dbo.gatepass_purpose_catalog';
END
ELSE
  PRINT N'Migration 94: dbo.gatepass_purpose_catalog already exists — skipped create';

MERGE dbo.gatepass_purpose_catalog AS tgt
USING (
  SELECT * FROM (VALUES
    (N'order',     N'Buying frames',      N'blue',   10),
    (N'eye_test',  N'Eye test',           N'purple', 20),
    (N'handover',  N'Collecting order',   N'amber',  30),
    (N'general',   N'General',            N'gray',   40)
  ) AS v(purpose_key, label, badge_variant, sort_order)
) AS src ON tgt.purpose_key = src.purpose_key
WHEN NOT MATCHED BY TARGET THEN
  INSERT (purpose_key, label, badge_variant, sort_order, is_active)
  VALUES (src.purpose_key, src.label, src.badge_variant, src.sort_order, 1);

PRINT N'Migration 94: seed merge complete';
