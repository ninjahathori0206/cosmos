/*
  Migration 70 — Zone-based label templates on dbo.label_print_formats

  Deploy: npm run migrate:70-label-print-formats-zones
*/
USE [CosmosERP];
GO

SET NOCOUNT ON;
PRINT N'Migration 70: label_print_formats zones';
GO

IF COL_LENGTH(N'dbo.label_print_formats', N'label_type') IS NULL
BEGIN
  ALTER TABLE dbo.label_print_formats ADD
    label_type         NVARCHAR(20)   NULL,
    page_width_mm      DECIMAL(6,2)   NULL,
    page_height_mm     DECIMAL(6,2)   NULL,
    margin_left_mm     DECIMAL(6,2)   NULL,
    margin_right_mm    DECIMAL(6,2)   NULL,
    margin_top_mm      DECIMAL(6,2)   NULL,
    margin_bottom_mm   DECIMAL(6,2)   NULL,
    columns_count      INT            NULL,
    col_gap_mm         DECIMAL(6,2)   NULL,
    row_gap_mm         DECIMAL(6,2)   NULL,
    label_width_mm     DECIMAL(6,2)   NULL,
    label_height_mm    DECIMAL(6,2)   NULL,
    zones_json         NVARCHAR(MAX)  NULL;
  PRINT N'Migration 70: added zone columns';
END
ELSE
  PRINT N'Migration 70: zone columns already present — skipped ALTER';
GO

/* Deactivate legacy 15×15 / strip keys superseded by zone templates */
UPDATE dbo.label_print_formats
SET is_active = 0, is_default = 0, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
WHERE format_key IN (
  N'small_label',
  N'small_15x15_continuous_109',
  N'eyewear_strip_12x100'
)
  AND is_active = 1;
GO

/* small_15x15 — spec prototype */
MERGE dbo.label_print_formats AS t
USING (SELECT N'small_15x15' AS format_key) AS s ON t.format_key = s.format_key
WHEN MATCHED THEN UPDATE SET
  name = N'15×15mm Small Label',
  description = N'6-up on 109mm roll · QR + vertical unit id + brand/MRP footer',
  label_type = N'SQUARE',
  page_width_mm = 109, page_height_mm = NULL,
  margin_left_mm = 2, margin_right_mm = 2, margin_top_mm = 2, margin_bottom_mm = 0,
  columns_count = 6, col_gap_mm = 3, row_gap_mm = 3,
  label_width_mm = 15, label_height_mm = 15,
  config_json = N'{"v":1,"layoutType":"compact","marginTop":2,"marginBottom":0,"marginLeft":2,"marginRight":2,"gapRow":3,"gapCol":3,"labelWidthMm":15,"labelHeightMm":15,"labelsPerRow":6,"dotsPerMm":8,"qrCellSize":3,"qrVisualSizeMm":10,"qrTopRatio":0,"textTopRatio":0.68,"textXMul":1,"textYMul":1,"textFontId":1,"textFontPt":8,"bottomBandHeightMm":4,"rightRailWidthMm":4,"pageWidthMm":109}',
  zones_json = N'[{"zone_key":"qr","zone_type":"qr","label":"QR Code","printable":true,"x_mm":0,"y_mm":0,"width_mm":10,"height_mm":10,"content":"{unit_id}","font_size_pt":8,"font_weight":"700","writing_mode":"horizontal","error_level":"L","background":"transparent","border_top":false},{"zone_key":"uid_strip","zone_type":"text","label":"Unit ID","printable":true,"x_mm":10.5,"y_mm":0,"width_mm":4,"height_mm":15,"content":"{unit_id}","font_size_pt":8,"font_weight":"700","writing_mode":"vertical","error_level":"L","background":"transparent","border_top":false},{"zone_key":"footer","zone_type":"text","label":"Brand - MRP","printable":true,"x_mm":0,"y_mm":10.5,"width_mm":10,"height_mm":4.5,"content":"{brand}-{mrp}","font_size_pt":8,"font_weight":"700","writing_mode":"horizontal","error_level":"L","background":"transparent","border_top":true}]',
  is_default = 1, sort_order = 20, is_active = 1, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
WHEN NOT MATCHED THEN INSERT (
  format_key, name, description, config_json, is_default, sort_order, is_active, created_at, updated_at,
  label_type, page_width_mm, page_height_mm, margin_left_mm, margin_right_mm, margin_top_mm, margin_bottom_mm,
  columns_count, col_gap_mm, row_gap_mm, label_width_mm, label_height_mm, zones_json
) VALUES (
  N'small_15x15', N'15×15mm Small Label', N'6-up on 109mm roll · QR + vertical unit id + brand/MRP footer',
  N'{"v":1,"layoutType":"compact","marginTop":2,"marginBottom":0,"marginLeft":2,"marginRight":2,"gapRow":3,"gapCol":3,"labelWidthMm":15,"labelHeightMm":15,"labelsPerRow":6,"dotsPerMm":8,"qrCellSize":3,"qrVisualSizeMm":10,"qrTopRatio":0,"textTopRatio":0.68,"textXMul":1,"textYMul":1,"textFontId":1,"textFontPt":8,"bottomBandHeightMm":4,"rightRailWidthMm":4,"pageWidthMm":109}',
  1, 20, 1, DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME()),
  N'SQUARE', 109, NULL, 2, 2, 2, 0, 6, 3, 3, 15, 15,
  N'[{"zone_key":"qr","zone_type":"qr","label":"QR Code","printable":true,"x_mm":0,"y_mm":0,"width_mm":10,"height_mm":10,"content":"{unit_id}","font_size_pt":8,"font_weight":"700","writing_mode":"horizontal","error_level":"L","background":"transparent","border_top":false},{"zone_key":"uid_strip","zone_type":"text","label":"Unit ID","printable":true,"x_mm":10.5,"y_mm":0,"width_mm":4,"height_mm":15,"content":"{unit_id}","font_size_pt":8,"font_weight":"700","writing_mode":"vertical","error_level":"L","background":"transparent","border_top":false},{"zone_key":"footer","zone_type":"text","label":"Brand - MRP","printable":true,"x_mm":0,"y_mm":10.5,"width_mm":10,"height_mm":4.5,"content":"{brand}-{mrp}","font_size_pt":8,"font_weight":"700","writing_mode":"horizontal","error_level":"L","background":"transparent","border_top":true}]'
);
GO

/* small_15x15_fixed */
MERGE dbo.label_print_formats AS t
USING (SELECT N'small_15x15_fixed' AS format_key) AS s ON t.format_key = s.format_key
WHEN MATCHED THEN UPDATE SET
  name = N'15×15mm — Fixed (Brand rail + Unit footer)',
  description = N'10×10 QR · brand vertical rail · 7-digit unit footer',
  label_type = N'SQUARE',
  page_width_mm = 109, page_height_mm = NULL,
  margin_left_mm = 2, margin_right_mm = 2, margin_top_mm = 0, margin_bottom_mm = 0,
  columns_count = 6, col_gap_mm = 3, row_gap_mm = 2,
  label_width_mm = 15, label_height_mm = 15,
  config_json = N'{"v":1,"layoutType":"compact-fixed","marginTop":0,"marginBottom":0,"marginLeft":2,"marginRight":2,"gapRow":2,"gapCol":3,"labelWidthMm":15,"labelHeightMm":15,"labelsPerRow":6,"dotsPerMm":8,"qrCellSize":3,"qrVisualSizeMm":10,"qrTopRatio":0,"textTopRatio":0.68,"textXMul":1,"textYMul":1,"textFontId":1,"textFontPt":8,"bottomBandHeightMm":5,"rightRailWidthMm":5,"pageWidthMm":109}',
  zones_json = N'[{"zone_key":"qr","zone_type":"qr","label":"QR Code","printable":true,"x_mm":0,"y_mm":0,"width_mm":10,"height_mm":10,"content":"{unit_id}","font_size_pt":8,"font_weight":"700","writing_mode":"horizontal","error_level":"L","background":"transparent","border_top":false},{"zone_key":"brand_rail","zone_type":"text","label":"Brand - MRP","printable":true,"x_mm":10,"y_mm":0,"width_mm":5,"height_mm":15,"content":"{brand}-{mrp}","font_size_pt":8,"font_weight":"700","writing_mode":"vertical","error_level":"L","background":"transparent","border_top":false},{"zone_key":"unit_footer","zone_type":"text","label":"Unit ID","printable":true,"x_mm":0,"y_mm":10,"width_mm":10,"height_mm":5,"content":"{unit_id}","font_size_pt":8,"font_weight":"700","writing_mode":"horizontal","error_level":"L","background":"transparent","border_top":true}]',
  is_default = 0, sort_order = 27, is_active = 1, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
WHEN NOT MATCHED THEN INSERT (
  format_key, name, description, config_json, is_default, sort_order, is_active, created_at, updated_at,
  label_type, page_width_mm, page_height_mm, margin_left_mm, margin_right_mm, margin_top_mm, margin_bottom_mm,
  columns_count, col_gap_mm, row_gap_mm, label_width_mm, label_height_mm, zones_json
) VALUES (
  N'small_15x15_fixed', N'15×15mm — Fixed (Brand rail + Unit footer)', N'10×10 QR · brand vertical rail · 7-digit unit footer',
  N'{"v":1,"layoutType":"compact-fixed","marginTop":0,"marginBottom":0,"marginLeft":2,"marginRight":2,"gapRow":2,"gapCol":3,"labelWidthMm":15,"labelHeightMm":15,"labelsPerRow":6,"dotsPerMm":8,"qrCellSize":3,"qrVisualSizeMm":10,"qrTopRatio":0,"textTopRatio":0.68,"textXMul":1,"textYMul":1,"textFontId":1,"textFontPt":8,"bottomBandHeightMm":5,"rightRailWidthMm":5,"pageWidthMm":109}',
  0, 27, 1, DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME()),
  N'SQUARE', 109, NULL, 2, 2, 0, 0, 6, 3, 2, 15, 15,
  N'[{"zone_key":"qr","zone_type":"qr","label":"QR Code","printable":true,"x_mm":0,"y_mm":0,"width_mm":10,"height_mm":10,"content":"{unit_id}","font_size_pt":8,"font_weight":"700","writing_mode":"horizontal","error_level":"L","background":"transparent","border_top":false},{"zone_key":"brand_rail","zone_type":"text","label":"Brand - MRP","printable":true,"x_mm":10,"y_mm":0,"width_mm":5,"height_mm":15,"content":"{brand}-{mrp}","font_size_pt":8,"font_weight":"700","writing_mode":"vertical","error_level":"L","background":"transparent","border_top":false},{"zone_key":"unit_footer","zone_type":"text","label":"Unit ID","printable":true,"x_mm":0,"y_mm":10,"width_mm":10,"height_mm":5,"content":"{unit_id}","font_size_pt":8,"font_weight":"700","writing_mode":"horizontal","error_level":"L","background":"transparent","border_top":true}]'
);
GO

/* small_15x15_alt */
MERGE dbo.label_print_formats AS t
USING (SELECT N'small_15x15_alt' AS format_key) AS s ON t.format_key = s.format_key
WHEN MATCHED THEN UPDATE SET
  name = N'15×15mm — Brand rail + Unit band',
  description = N'QR + vertical brand/MRP rail + horizontal unit code band',
  label_type = N'SQUARE',
  page_width_mm = 109, page_height_mm = NULL,
  margin_left_mm = 2, margin_right_mm = 2, margin_top_mm = 2, margin_bottom_mm = 0,
  columns_count = 6, col_gap_mm = 3, row_gap_mm = 2,
  label_width_mm = 15, label_height_mm = 15,
  config_json = N'{"v":1,"layoutType":"compact-alt","marginTop":2,"marginBottom":0,"marginLeft":2,"marginRight":2,"gapRow":2,"gapCol":3,"labelWidthMm":15,"labelHeightMm":15,"labelsPerRow":6,"dotsPerMm":8,"qrCellSize":3,"qrVisualSizeMm":9,"qrTopRatio":0.02,"textTopRatio":0.68,"textXMul":1,"textYMul":1,"textFontId":2,"textFontPt":8,"bottomBandHeightMm":4,"rightRailWidthMm":3.5,"pageWidthMm":109}',
  zones_json = N'[{"zone_key":"qr","zone_type":"qr","label":"QR Code","printable":true,"x_mm":0,"y_mm":0,"width_mm":10,"height_mm":10,"content":"{unit_id}","font_size_pt":8,"font_weight":"700","writing_mode":"horizontal","error_level":"L","background":"transparent","border_top":false},{"zone_key":"brand_rail","zone_type":"text","label":"Brand - MRP","printable":true,"x_mm":10.5,"y_mm":0,"width_mm":4.5,"height_mm":15,"content":"{brand}-{mrp}","font_size_pt":8,"font_weight":"700","writing_mode":"vertical","error_level":"L","background":"transparent","border_top":false},{"zone_key":"unit_band","zone_type":"text","label":"Unit ID","printable":true,"x_mm":0,"y_mm":10.5,"width_mm":10.5,"height_mm":4.5,"content":"{unit_id}","font_size_pt":8,"font_weight":"700","writing_mode":"horizontal","error_level":"L","background":"transparent","border_top":true}]',
  is_default = 0, sort_order = 26, is_active = 1, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
WHEN NOT MATCHED THEN INSERT (
  format_key, name, description, config_json, is_default, sort_order, is_active, created_at, updated_at,
  label_type, page_width_mm, page_height_mm, margin_left_mm, margin_right_mm, margin_top_mm, margin_bottom_mm,
  columns_count, col_gap_mm, row_gap_mm, label_width_mm, label_height_mm, zones_json
) VALUES (
  N'small_15x15_alt', N'15×15mm — Brand rail + Unit band', N'QR + vertical brand/MRP rail + horizontal unit code band',
  N'{"v":1,"layoutType":"compact-alt","marginTop":2,"marginBottom":0,"marginLeft":2,"marginRight":2,"gapRow":2,"gapCol":3,"labelWidthMm":15,"labelHeightMm":15,"labelsPerRow":6,"dotsPerMm":8,"qrCellSize":3,"qrVisualSizeMm":9,"qrTopRatio":0.02,"textTopRatio":0.68,"textXMul":1,"textYMul":1,"textFontId":2,"textFontPt":8,"bottomBandHeightMm":4,"rightRailWidthMm":3.5,"pageWidthMm":109}',
  0, 26, 1, DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME()),
  N'SQUARE', 109, NULL, 2, 2, 2, 0, 6, 3, 2, 15, 15,
  N'[{"zone_key":"qr","zone_type":"qr","label":"QR Code","printable":true,"x_mm":0,"y_mm":0,"width_mm":10,"height_mm":10,"content":"{unit_id}","font_size_pt":8,"font_weight":"700","writing_mode":"horizontal","error_level":"L","background":"transparent","border_top":false},{"zone_key":"brand_rail","zone_type":"text","label":"Brand - MRP","printable":true,"x_mm":10.5,"y_mm":0,"width_mm":4.5,"height_mm":15,"content":"{brand}-{mrp}","font_size_pt":8,"font_weight":"700","writing_mode":"vertical","error_level":"L","background":"transparent","border_top":false},{"zone_key":"unit_band","zone_type":"text","label":"Unit ID","printable":true,"x_mm":0,"y_mm":10.5,"width_mm":10.5,"height_mm":4.5,"content":"{unit_id}","font_size_pt":8,"font_weight":"700","writing_mode":"horizontal","error_level":"L","background":"transparent","border_top":true}]'
);
GO

/* strip_104x12 */
MERGE dbo.label_print_formats AS t
USING (SELECT N'strip_104x12' AS format_key) AS s ON t.format_key = s.format_key
WHEN MATCHED THEN UPDATE SET
  name = N'104×12mm Frame Wrap Label',
  description = N'66 mm print (QR + brand) + 34 mm tail on 108 mm roll',
  label_type = N'STRIP',
  page_width_mm = 108, page_height_mm = NULL,
  margin_left_mm = 2, margin_right_mm = 2, margin_top_mm = 2, margin_bottom_mm = 0,
  columns_count = 1, col_gap_mm = 0, row_gap_mm = 2,
  label_width_mm = 104, label_height_mm = 12,
  config_json = N'{"v":1,"layoutType":"strip","marginTop":2,"marginBottom":0,"marginLeft":2,"marginRight":2,"gapRow":2,"gapCol":0,"labelWidthMm":104,"labelHeightMm":12,"labelsPerRow":1,"dotsPerMm":8,"qrCellSize":3,"qrVisualSizeMm":10,"qrTopRatio":0.06,"textTopRatio":0.72,"textXMul":1,"textYMul":1,"textFontId":2,"textFontPt":6,"printWidthMm":66,"zone1WidthMm":33,"zone2WidthMm":33,"tailWidthMm":34,"pageWidthMm":108}',
  zones_json = N'[{"zone_key":"zone_qr_sku","zone_type":"qr","label":"Zone 1 — QR + SKU","printable":true,"x_mm":0,"y_mm":0,"width_mm":33,"height_mm":12,"content":"{unit_id}","font_size_pt":6,"font_weight":"700","writing_mode":"horizontal","error_level":"L","background":"transparent","border_top":false},{"zone_key":"zone_brand_mrp","zone_type":"text","label":"Zone 2 — Brand + Model + MRP","printable":true,"x_mm":33,"y_mm":0,"width_mm":33,"height_mm":12,"content":"{brand}\n{model}\nMRP {mrp}","font_size_pt":6,"font_weight":"700","writing_mode":"horizontal","error_level":"L","background":"transparent","border_top":false},{"zone_key":"tail","zone_type":"tail","label":"Tail (non-print)","printable":false,"x_mm":66,"y_mm":0,"width_mm":38,"height_mm":12,"content":"","font_size_pt":null,"font_weight":null,"writing_mode":null,"error_level":null,"background":"transparent","border_top":false}]',
  is_default = 0, sort_order = 30, is_active = 1, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
WHEN NOT MATCHED THEN INSERT (
  format_key, name, description, config_json, is_default, sort_order, is_active, created_at, updated_at,
  label_type, page_width_mm, page_height_mm, margin_left_mm, margin_right_mm, margin_top_mm, margin_bottom_mm,
  columns_count, col_gap_mm, row_gap_mm, label_width_mm, label_height_mm, zones_json
) VALUES (
  N'strip_104x12', N'104×12mm Frame Wrap Label', N'66 mm print (QR + brand) + 34 mm tail on 108 mm roll',
  N'{"v":1,"layoutType":"strip","marginTop":2,"marginBottom":0,"marginLeft":2,"marginRight":2,"gapRow":2,"gapCol":0,"labelWidthMm":104,"labelHeightMm":12,"labelsPerRow":1,"dotsPerMm":8,"qrCellSize":3,"qrVisualSizeMm":10,"qrTopRatio":0.06,"textTopRatio":0.72,"textXMul":1,"textYMul":1,"textFontId":2,"textFontPt":6,"printWidthMm":66,"zone1WidthMm":33,"zone2WidthMm":33,"tailWidthMm":34,"pageWidthMm":108}',
  0, 30, 1, DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME()),
  N'STRIP', 108, NULL, 2, 2, 2, 0, 1, 0, 2, 104, 12,
  N'[{"zone_key":"zone_qr_sku","zone_type":"qr","label":"Zone 1 — QR + SKU","printable":true,"x_mm":0,"y_mm":0,"width_mm":33,"height_mm":12,"content":"{unit_id}","font_size_pt":6,"font_weight":"700","writing_mode":"horizontal","error_level":"L","background":"transparent","border_top":false},{"zone_key":"zone_brand_mrp","zone_type":"text","label":"Zone 2 — Brand + Model + MRP","printable":true,"x_mm":33,"y_mm":0,"width_mm":33,"height_mm":12,"content":"{brand}\n{model}\nMRP {mrp}","font_size_pt":6,"font_weight":"700","writing_mode":"horizontal","error_level":"L","background":"transparent","border_top":false},{"zone_key":"tail","zone_type":"tail","label":"Tail (non-print)","printable":false,"x_mm":66,"y_mm":0,"width_mm":38,"height_mm":12,"content":"","font_size_pt":null,"font_weight":null,"writing_mode":null,"error_level":null,"background":"transparent","border_top":false}]'
);
GO

/* Ensure large_label stays default-off if small_15x15 is default */
UPDATE dbo.label_print_formats SET is_default = 0, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
WHERE format_key = N'large_label' AND is_default = 1
  AND EXISTS (SELECT 1 FROM dbo.label_print_formats WHERE format_key = N'small_15x15' AND is_default = 1);
GO

PRINT N'Migration 70: complete.';
GO
