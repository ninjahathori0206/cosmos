-- POS GST behaviour: Composition scheme toggle, GST-inclusive list prices toggle.
PRINT N'--- pos_gst_composition_inclusive.sql ---';
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = N'pos_composition_scheme')
BEGIN
  INSERT INTO dbo.app_settings (setting_key, setting_value, setting_group, description)
  VALUES (N'pos_composition_scheme', N'1', N'pos', N'1 = Composition / no GST on POS bill (gst_amount forced 0); 0 = show GST.');
  PRINT N'Seeded pos_composition_scheme = 1';
END;

IF NOT EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = N'pos_prices_gst_inclusive')
BEGIN
  INSERT INTO dbo.app_settings (setting_key, setting_value, setting_group, description)
  VALUES (N'pos_prices_gst_inclusive', N'1', N'pos', N'1 = catalogue/unit prices include GST — discount applies before tax split when GST on; when composition still full subtotal − discount.');
  PRINT N'Seeded pos_prices_gst_inclusive = 1';
END;

PRINT N'--- pos_gst_composition_inclusive.sql DONE ---';
GO
