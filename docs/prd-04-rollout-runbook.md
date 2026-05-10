# PRD-04 Promotion Builder rollout and rollback

## Rollout sequence

1. Deploy SQL migrations in order:
   - `sql/migrations/38_offer_trigger_target.sql`
   - `sql/migrations/39_prd04_offers_usage.sql`
2. Deploy stored procedures:
   - `sql/sp/promotions.sql`
3. Deploy API + CU/POS runtime code.
4. Enable feature flag `prd04_offer_builder_enabled` in `dbo.app_settings`.
5. Validate:
   - create/edit/deactivate offer in Command Unit
   - POS preview returns candidates when no offer selected
   - checkout blocks when multiple offers qualify and no selection
   - offer usage rows appear in `dbo.offer_usage`

## Rollback

1. Set `prd04_offer_builder_enabled = 0` in `dbo.app_settings`.
2. Revert frontend to hide new trigger/target/scope mode controls.
3. Keep new DB columns/tables (non-destructive rollback); they are backward compatible.
4. If needed, disable usage writes by revoking execute on `sp_RecordOfferUsage`.
