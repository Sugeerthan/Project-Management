# Database

Supabase/PostgreSQL source of truth. Versioned SQL belongs in `supabase/migrations/`; representative data belongs in `supabase/seed/`. Database ownership and row-level security policies are documented in `schema/` and `rls/` respectively.

## Profiles foundation: prepared, not applied

The first migration defines only private, Auth-linked profiles. It has not been
applied to either Supabase project. The earlier 11-table proposal is not an
approved schema and is outside this increment.

- CLI configuration: [`supabase/config.toml`](supabase/config.toml).
- Migration: [`20261110000000_create_profiles_foundation.sql`](supabase/migrations/20261110000000_create_profiles_foundation.sql).
- Future connected tests: [`supabase/tests/profiles.test.sql`](supabase/tests/profiles.test.sql).
- Schema, RLS, provisioning, test coverage, and controlled application procedure:
  [profiles foundation guide](../docs/database/profiles-foundation.md).

Run future CLI commands from the repository root with `--workdir database`.
The existing `supabase/config/` folder is a placeholder; CLI configuration belongs
in the sibling `supabase/config.toml`. Seeds are disabled. No Docker, application
integration, migration automation, or production changes are introduced.
