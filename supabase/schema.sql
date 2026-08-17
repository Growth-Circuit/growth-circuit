-- Canonical local schema entrypoint.
-- Managed migrations are the source of truth. This psql-compatible file replays
-- the accepted legacy baseline and community foundation in migration order.
\ir migrations/20260816_existing_schema_baseline.sql
\ir migrations/20260816_community_foundation.sql
