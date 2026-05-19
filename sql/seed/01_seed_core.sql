/*
  DEPRECATED — Cosmos no longer auto-seeds roles, stores, or users.

  Live environments: create roles, stores, and users in Command Unit (or your DBA process).
  Greenfield: configure manually once; do not rely on sql/seed/*.sql.

  Legacy script retained only as a no-op so old runbooks that reference this path do not fail.
*/
PRINT 'sql/seed/01_seed_core.sql — skipped (auto-seed disabled; use Command Unit).';

USE [CosmosERP];
GO
