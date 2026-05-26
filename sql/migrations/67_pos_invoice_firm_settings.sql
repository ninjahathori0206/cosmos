-- Firm identity on POS tax invoices (app_settings keys consumed by GET /api/pos/settings).
PRINT 'Migration 67: POS invoice firm settings';

MERGE dbo.app_settings AS tgt
USING (
  SELECT N'firm_name' AS setting_key, N'' AS setting_value, N'pos' AS setting_group,
         N'Legal firm/company name shown on POS invoice' AS description
  UNION ALL
  SELECT N'firm_registered_address', N'', N'pos', N'Registered address shown on POS invoice'
  UNION ALL
  SELECT N'firm_gstin', N'', N'pos', N'GST registration number shown on POS invoice'
  UNION ALL
  SELECT N'pos_invoice_return_policy', N'7-day frame exchange · No cash refund · Prescription verification within 3 days', N'pos',
         N'Footer return policy text on POS invoice preview'
) AS src ON tgt.setting_key = src.setting_key
WHEN NOT MATCHED BY TARGET THEN
  INSERT (setting_key, setting_value, setting_group, description)
  VALUES (src.setting_key, src.setting_value, src.setting_group, src.description);

PRINT 'Migration 67 complete.';
