# Profiles database foundation

## Scope and evidence

This increment prepares SQL and tests only. Neither `nexus-portfolio-dev` nor
`nexus-portfolio-prod` has been accessed or modified by this work. SQL execution,
RLS behavior, and signup behavior require a later authorized development test.

The existing [database design](database-design.md), [relationships](relationships.md),
and [architecture](../architecture/system-architecture.md) establish Supabase Auth
as the identity owner. They do not approve the earlier proposed 11-table design.
No original R&D PDF or detailed ClickUp specification was found in the repository.
The no-Docker ADR remains [Proposed](../adr/0001-no-docker-initial-development.md).

Profiles are the only implemented SQL definition in this increment. Portfolio,
theme, CV, extraction, publication, Storage, application clients, and administrative
roles remain outside scope. No generated database types are claimed before a real
schema is available for introspection.

## Migration organization

```text
database/
  README.md
  schema/                         # Existing organizational placeholders
  rls/                            # Existing organizational placeholders
  supabase/
    .gitignore                    # Excludes generated CLI state and environment files
    config.toml                   # CLI workspace config; no remote project or secrets
    migrations/
      20261110000000_create_profiles_foundation.sql
    tests/
      profiles.test.sql           # psql integration assertions, NOT a migration
    seed/                         # Existing placeholder; seeds disabled
```

The CLI workspace is `database/`, so use `--workdir database` from the repository
root. `project_id` in the TOML file is a local identifier, not a hosted project
reference. The config is intentionally minimal. Use exactly **Supabase CLI 3.1.0**
for the first controlled test; its version and `db push`/`migration list` help were
checked locally without a database connection. This is a documented invocation
pin, not a new project dependency. Runtime configuration parsing and migration
execution are still unverified. Do not run `config push` or start a local Supabase
container stack for this increment.

Invoke that exact release without a global install or Docker:

```sh
npx --yes supabase@3.1.0 --version
npx --yes supabase@3.1.0 db push --help
```

The first invocation may download the CLI to the npm cache. Node.js 22 meets its
documented Node.js 20+ invocation prerequisite. A future repository dependency pin
requires a separate dependency/lockfile change; none is introduced here. Running
the hosted-project CLI does not require the Docker-based local Supabase stack.

Migration names use a unique UTC `YYYYMMDDHHMMSS_description.sql` prefix. SQL in
`migrations/` is authoritative; do not maintain divergent executable copies in
`schema/` or `rls/`. Once applied, do not edit an existing migration: use a reviewed
follow-up migration. Test SQL stays outside the migration directory.

## Profile schema

| Column         | PostgreSQL definition                                          | Ownership                                            |
| -------------- | -------------------------------------------------------------- | ---------------------------------------------------- |
| `id`           | `uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE` | Auth UUID; no generated default or client assignment |
| `display_name` | Nullable `text`; 1–120 stored characters and not spaces-only   | The only client-editable field                       |
| `created_at`   | `timestamptz NOT NULL DEFAULT now()`                           | Database managed                                     |
| `updated_at`   | `timestamptz NOT NULL DEFAULT now()`                           | Database managed on update                           |

`updated_at >= created_at` is enforced. The primary key already indexes ownership
lookups, so no redundant index is needed. No email, password, secret, role,
permission flag, or CV content is copied into a profile.

The optional display name and its length limit are initial design choices for
review, not requirements attributed to the unavailable R&D PDF. Locale, usernames,
public profiles, and administrative permissions require separate approval.

## RLS and SQL permissions

RLS is enabled within the migration transaction before application access is
granted. Default grants on the new table are revoked from `PUBLIC`, `anon`,
`authenticated`, and `service_role`. Only these application grants are restored:

- `authenticated`: `SELECT`, filtered to the caller's own ID.
- `authenticated`: column-level `UPDATE(display_name)`, with both `USING` and
  `WITH CHECK` ownership predicates.

Both policies also deny JWTs marked `is_anonymous=true`, because Supabase anonymous
sign-ins use the `authenticated` role. Unauthenticated `anon` has no table access.
Clients have no `INSERT`, `DELETE`, table-wide `UPDATE`, or protected-column update
grants. No profile RPC or application administrative role is introduced.

The update trigger rejects changes to `id`, `created_at`, or the input `updated_at`,
then sets `updated_at` using `statement_timestamp()`. It is security-invoker and
only changes `NEW`; it does not need elevated table access. Grant protection and
the trigger are independent safeguards. A rejected cross-owner update normally
affects zero rows; a prohibited column operation fails with insufficient privilege.

Migration owners and PostgreSQL roles with RLS bypass remain privileged. RLS is
not a security boundary against database administrators. Even `service_role`
receives no profile table grants here; future privileged application access must
be explicitly designed rather than inferred from that role's RLS bypass.

## Auth provisioning and deletion

A minimal `AFTER INSERT ON auth.users` trigger inserts the Auth ID into profiles.
It deliberately copies no user-editable metadata. A one-time, ID-only backfill
creates profiles for existing Auth accounts without changing Auth data.

The provisioning function is in `nexus_private`, uses `SECURITY DEFINER`, pins an
empty `search_path`, and schema-qualifies the table. Its owner is the trusted role
that applies the migration and owns `profiles`; future tests must verify that
ownership. Use the normal trusted Supabase migration owner, not an API user. No
schema usage or function execution is granted to API roles. Keep `nexus_private`
out of the exposed API schemas. Trigger functions are not public RPC endpoints.

Provisioning errors are intentionally not swallowed: the failing profile insert
rolls back the signup transaction. This prevents Auth users without profiles, but
also means a broken trigger can block registrations. Test signup and monitor
sanitized Auth errors before enabling this migration for real users. The migration
creates named objects without `IF NOT EXISTS` so conflicting remote objects cause
a visible failure instead of silently adopting an unknown schema.

Clients cannot delete profiles independently of Auth. An authorized account
deletion through the Auth lifecycle cascades to the profile; deleting a profile
as a database administrator does not delete its Auth user. Account deletion is not
implemented in application code here. Future CV Storage objects and published
artifacts will require explicit cleanup before account deletion; an SQL cascade
cannot clean up those external resources.

## Required review before applying anything

1. Approve the limited profile fields, signup trigger/backfill, anonymous-sign-in
   restriction, deletion behavior, and denial of direct client creation/deletion.
2. Obtain separate authorization to inspect and change `nexus-portfolio-dev`.
   Verify its actual project reference and connection target without logging
   credentials. This repository does not prove that its remote schema is empty.
3. Inspect existing migration history, `auth.users`, triggers, default grants,
   policy roles, exposed schemas, and collisions with `profiles` or `nexus_private`.
4. Verify the applying role can create the private schema/functions and the Auth
   trigger, read Auth IDs for backfill, and own the resulting objects. Review
   existing user count and expected backfill/DDL locking before scheduling the work.
5. Use the documented CLI 3.1.0 invocation pin and verify the version before a remote
   operation. The templates below use its verified `--remote` and `--skip-vault`
   flags. No project dependency is installed by this increment.
6. Review the development migration dry run, then obtain approval for the actual
   development application. A dry run lists changes; it does not validate SQL or
   execute policies. Plan signup outage recovery and a backup/restore procedure.

## Future development application: templates only

The following are **not commands executed by this change**. They require an
approved development project reference and separately provided operator credentials.
Never paste database passwords or access tokens into command arguments, Git, or PRs.

```sh
npx --yes supabase@3.1.0 --workdir database db push --dry-run --skip-vault --remote="${DEV_PROJECT_REF:?Set the independently verified nonproduction project ref}"
# Only after target verification, review, and explicit development approval:
npx --yes supabase@3.1.0 --workdir database db push --skip-vault --remote="${DEV_PROJECT_REF:?Set the independently verified nonproduction project ref}"
```

These are POSIX-shell templates. Required-variable expansion refuses an empty
target instead of risking a fallback to a previously linked project. In PowerShell,
validate `$env:DEV_PROJECT_REF` and throw if it is empty before supplying an explicit
`--remote=...` value; do not copy POSIX parameter expansion into PowerShell.

`DEV_PROJECT_REF` must resolve to the independently verified nonproduction test or
development project, never production. A project
name alone does not prove the connection target. Keep generated `.temp/`, branch
state, and local environment files out of Git. Do not use remote reset, migration
repair, or production credentials to resolve an unexpected baseline.

The migration deliberately has **no authored `BEGIN`/`COMMIT`**. In CLI 3.1.0 the
normal migration batch includes its SQL and history insert in one implicit
transaction. Explicit boundaries instead take the sequential path and can commit
the schema before recording history. This behavior was checked in the pinned
[runner source](https://github.com/supabase/cli/blob/v3.1.0/apps/cli/src/command-internal/migration-apply.ts),
not by executing a migration. Use the pinned CLI rather than applying individual
statements or pasting the migration into SQL Editor. Re-review transaction behavior
before changing runners or CLI versions. Do not retry blindly after a failure or
partially applied history; inspect the development state.

After successful development application and tests, generate TypeScript types with
the approved CLI into an agreed shared location, for example
`shared/types/database.types.ts`. Do not hand-author generated types or claim they
reflect a database that has not been introspected. Shared package/export wiring is
still a future task.

## Tests and execution status

[`profiles.test.sql`](../../database/supabase/tests/profiles.test.sql) is an
executable **psql** script for a later authorized development environment, not a
migration and not a test run performed by this increment. It requires the migration,
the standard Supabase Auth helpers/roles, PostgreSQL PL/pgSQL, and a trusted
disposable-target `postgres` connection. It needs no pgTAP extension or Docker.

It uses fixed synthetic UUIDs and reserved `.invalid` email addresses, refuses a
target containing **any** Auth users or profiles, runs inside a transaction, and
ends with `ROLLBACK`. A write-excluding lock closes the race between the empty
check and fixture deletion. A 3-second lock timeout, 30-second statement timeout,
and 60-second idle-in-transaction timeout bound failed runs. Do not run this locking
test on a shared development environment or one containing real users.
The acknowledgement guard raises a SQL exception for a missing or incorrect value;
with `ON_ERROR_STOP` this must terminate a noninteractive psql run with a nonzero
status. The empty-target guard also raises an exception before fixture creation.
This behavior has not yet been verified with a running PostgreSQL/psql environment.
The guards run after psql connects; verify target identity before connecting.
For offline guard-structure checks, run `python -B database/supabase/tests/check_profiles_guard.py`.
These checks do not parse or execute PostgreSQL and do not verify the psql exit code.

`ON_ERROR_STOP` aborts on failed assertions; close the connection after a failure
to ensure the open transaction is rolled back. Use a dedicated test session with
no outer transaction. Test grants, constraints, and Auth inserts only in a reviewed
disposable target: the script briefly adds a rollback-scoped rejection constraint.

Once a trusted external PostgreSQL service entry has been configured and verified,
an operator can use this template from the repository root:

```sh
psql "service=nexus-profiles-disposable" -X -v ON_ERROR_STOP=1 \
  -v profiles_test_target=nexus-profiles-disposable \
  -f database/supabase/tests/profiles.test.sql
```

The acknowledgement flag and service name are safeguards against accidental use,
not proof of the target. The script cannot independently recognize a production
project: a wrong service entry and production credentials could still acquire
locks, even though a populated target aborts before fixture writes. Keep production
credentials unavailable to the test session and verify the actual connection host
and project reference independently. Never run this against production.

| Coverage                                               | Executable assertions prepared | Execution in this increment |
| ------------------------------------------------------ | ------------------------------ | --------------------------- |
| Own profile read and display-name update               | Yes                            | Not run                     |
| Cross-user read/update isolation                       | Yes                            | Not run                     |
| Unauthenticated and anonymous-sign-in denial           | Yes                            | Not run                     |
| Unauthorized insert/delete and protected-field updates | Yes                            | Not run                     |
| RLS enabled, grants and provisioning function safety   | Yes                            | Not run                     |
| Signup provisioning and untrusted metadata exclusion   | Yes                            | Not run                     |
| Signup failure rolls back Auth insert                  | Yes                            | Not run                     |
| Auth deletion cascade and orphan-FK rejection          | Yes                            | Not run                     |

The harness also rejects empty, spaces-only, and space-padded oversized display
names, and exercises both users' isolation plus the absence of a reverse
profile-to-Auth deletion cascade.

Additional connected acceptance cases: in a separate disposable baseline, create
synthetic Auth users before applying the migration and verify ID-only backfill.
That nonempty baseline must not be used for the empty-target harness. Also test
an actual Auth signup/sign-in and JWT-backed Data API request, confirm direct RPC
access is denied. SQL role/claim simulation
does not verify the Auth API's JWT verification or the complete signup service.

No PostgreSQL server/client or PostgreSQL grammar parser was available locally.
CLI 3.1.0 version/help checks were executed, but no database command was run. Local
SQL review and structural checks are not SQL execution or proof of valid
PostgreSQL/PL/pgSQL semantics. Record connected results separately before considering
development rollout complete.

## First controlled test and development preflight

1. Obtain approval for a dedicated, empty disposable Supabase-compatible test target.
   It must contain the real Auth schema/helpers and standard roles, with no user
   data copied from development or production. Native PostgreSQL with carefully
   reviewed Auth scaffolding can test SQL mechanics, but cannot prove hosted Auth
   service behavior. No Docker setup is required by this change.
2. Use only that target's credentials in an external PostgreSQL service entry and
   approved secret storage. Verify its host/project reference against an independently
   supplied nonproduction allowlist; do not infer the target from its service name.
   Confirm neither the test nor development reference equals the known production
   reference. Do not load production credentials into the shell.
3. Inspect the migration baseline and configuration, verify CLI 3.1.0, and use its
   explicit `--remote` target. Run the dry-run template with `DEV_PROJECT_REF` set
   to the disposable reference, then apply only with separate approval. Do not use
   `--include-all`, migration repair, remote reset, or broad config pushes.
4. Run the psql harness above in a fresh connection. Require successful completion,
   its final `ROLLBACK`, and no leftover fixtures or rejection constraint. Close the
   connection immediately after any failure; investigate instead of retrying against
   a different target. No harness success has been recorded yet.
5. Use another disposable baseline for preexisting-synthetic-user backfill and actual
   Auth API signup/sign-in tests. Review other Auth triggers because external effects
   from an unknown trigger are not necessarily undone by SQL rollback.
6. Only after those tests pass, obtain approval for a **read-only** inspection of
   `nexus-portfolio-dev`. Verify the target separately, then list migration history:

   ```sh
   npx --yes supabase@3.1.0 --workdir database migration list --remote="${DEV_PROJECT_REF:?Set the independently verified development project ref}"
   ```

   In an independently verified development SQL session, use a read-only transaction
   to inspect counts and catalog metadata, not Auth row contents or function bodies:

   ```sql
   begin read only;
   select current_user, current_database(), current_setting('server_version');
   select to_regclass('public.profiles'), to_regnamespace('nexus_private');
   select count(*) as existing_auth_users from auth.users;
   select t.tgname, n.nspname as function_schema, p.proname
   from pg_trigger t
   join pg_proc p on p.oid = t.tgfoid
   join pg_namespace n on n.oid = p.pronamespace
   where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal;
   rollback;
   ```

   Also inspect applying-role permissions, API-role memberships, schema usage,
   default grants, exposed schemas, migration history, and backups. Stop on unknown
   existing objects/history; a dry run is not a substitute for this review.

7. Schedule the later development application separately, considering signup locks
   and backfill volume. Do not run the empty-target harness against a development
   project with real accounts. Production promotion is a separate future task.

## Production restrictions and unresolved decisions

Do not apply this migration to `nexus-portfolio-prod`, add database credentials to
the ordinary PR workflow, or automate schema changes in Vercel builds. A later
production plan must use reviewed migrations tested in development, explicit
approval, verified backups, and an account/signup recovery plan. Removing the
signup trigger alone would allow future Auth users without profiles; recovery must
preserve or deliberately repair the provisioning invariant, not silently disable it.

The broader entity model, public publication boundary, privileged operations,
Storage lifecycle, profile-field requirements, remote baseline, CLI pin, and test
target remain decisions for review. This increment does not approve the 11-table
proposal or mark the no-Docker ADR Accepted.

## References

- [Supabase user data and signup trigger guidance](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase CLI configuration](https://supabase.com/docs/guides/local-development/cli/config)
- [Supabase CLI migration reference](https://supabase.com/docs/reference/cli/supabase-db-push)
- [PostgreSQL column grants](https://www.postgresql.org/docs/current/sql-grant.html)
