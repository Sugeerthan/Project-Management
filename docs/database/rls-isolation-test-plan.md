# RLS isolation test plan

**Status: prepared, not executed against PostgreSQL or Supabase.** No screenshot or claim of a passing RLS suite is available. The [profiles harness](../../database/supabase/tests/profiles.test.sql) is the single consolidated test on this branch, based on the committed profiles foundation and its corrected fail-closed guards. The profile migration is prepared, not deployed or verified. Do not apply it as part of this task.

## Coverage audit

The existing harness already checked A and B can each see only their own profile, cross-user updates affect zero rows in both directions, A's self-update, protected profile fields, denied direct insert/delete, anon and anonymous-sign-in denial, RLS enablement, role bypass flags and grants, private trigger security, provisioning, and transactional cleanup. The consolidated harness adds explicit A/B ownership-forged inserts, B self-update and protected-ID change, assertions about each simulated role and claims, and an authenticated SELECT grant assertion. A denied update is asserted using its row count, not just lack of error. The harness expects profile INSERT to fail on grants; it does not demonstrate a portfolio `WITH CHECK` policy.

The repository's portfolio API contract tests use mocked repositories and do not execute RLS. The proposed ERD and RLS matrix are unapproved and do not establish table names, fields, grants or policies. No executable portfolio SQL is added until real reviewed tables and policies exist.

## Access matrix

| Action                                       | A on A            | A on B        | B on B            | B on A        | Anonymous                        |
| -------------------------------------------- | ----------------- | ------------- | ----------------- | ------------- | -------------------------------- |
| Read profiles                                | Own row           | No row        | Own row           | No row        | Denied/no row, depending on role |
| Update profile display name                  | One row           | Zero rows     | One row           | Zero rows     | Denied/no row, depending on role |
| Insert profile or change profile ID          | Denied            | Denied        | Denied            | Denied        | Denied                           |
| Read/update private portfolio and child rows | Proposed allow    | Proposed deny | Proposed allow    | Proposed deny | Proposed deny                    |
| Insert portfolio/section or asset metadata   | Proposed own only | Proposed deny | Proposed own only | Proposed deny | Proposed deny                    |

The profile row describes the **prepared migration**, not verified deployed behavior. Future rows are proposed acceptance expectations, subject to approved schemas and policies. Anonymous includes separate unauthenticated `anon` and Supabase anonymous-sign-in `authenticated` identities; test both.

## Future portfolio and asset SQL tests

After schema and policy approval, prepare the following with actual generated names and constraints in a new test harness. Use two synthetic users, one owned portfolio and separate education, experience and private asset metadata record for each. Create fixtures only in an explicitly authorized disposable environment; use a trusted setup role solely for provisioning, and switch to non-bypass authenticated roles for assertions. Use a third unowned/missing UUID for not-found checks. The harness must fail with nonzero status for every unexpected row, successful forbidden write, or wrong error category.

- For each direction from A to B and from B to A: own portfolio/child/asset SELECT returns only own records; targeted cross-owner SELECT returns none. Own permitted update changes exactly one intended row. Cross-owner update affects zero rows or is denied under the approved policy, and a privileged post-check confirms the victim's data is unchanged.
- Attempt insert of portfolio with the victim's owner ID, and attempt an own-row owner change to the victim. Require an explicit denial, not a successful zero-row claim. Confirm both users' data remains unchanged and no record was created. Apply analogous tests for asset owner fields and other protected columns.
- For education and experience, attempt create under the other user's portfolio, update the other user's entry, and reparent an own entry to the other user's portfolio. Check both foreign-parent directions and both `USING` and `WITH CHECK` behavior; test null/unknown parent only according to approved constraints. Verify rejected writes do not leave partial changes.
- Attempt forged own asset metadata that references the other user's portfolio, forged owner metadata, read and update of the other user's private asset metadata, and forbidden reassociation. Separately test actual private Storage object operations, object paths and bucket policies; metadata RLS alone cannot secure object bytes.
- Check RLS enabled on every reviewed table, non-owner roles do not bypass it, exact table and column grants match the approved matrix, and anon and anonymous-sign-in contexts cannot access private rows. Confirm parent-link and owner immutability, protected timestamp/privileged state grants, and cross-owner foreign-key constraints independently of RLS where required. Never assert an unapproved schema by name in executable tests.

## Signed-token integration requirement

SQL `SET ROLE` and `request.jwt` settings simulate claims: they do **not** verify a JWT signature, token issuance, Auth endpoints, PostgREST, or application SSR forwarding. In an independently verified disposable Supabase environment, create two synthetic Auth users through the supported test setup and sign in separately to obtain genuine A and B tokens. Use a publishable key and each user's own bearer token for requests; never use a service-role credential to establish isolation. Verify token identity through the Auth API, keep tokens out of source, logs and screenshots, then perform every applicable matrix action in both directions via the Data API and, separately, the actual application routes once enabled. Check result bodies and affected rows, re-read victim data with the victim's token, and test unauthenticated plus anonymous-sign-in requests. Test that the application's private routes safely return 404 where applicable. Use approved test-only cleanup through a separately authorized setup mechanism and verify no fixtures or objects remain. The disabled portfolio API currently returns 503, so mock route tests cannot satisfy this requirement.

## Future disposable-target execution (not run)

1. Obtain explicit authorization for a **dedicated disposable** Supabase-compatible environment; never use `nexus-portfolio-dev` or `nexus-portfolio-prod`, real-user copies, or production credentials. Independently verify its project reference, endpoint and database host against a trusted inventory and compare against the known dev/prod references. A service name or test variable is not identity verification. The SQL guard runs only after psql has connected, so it cannot prevent an initial connection to a misconfigured target. No automatic runner verifies the target before connection; the operator must verify the service configuration and independently confirm the target and credential provenance before invoking psql. Stop on uncertainty. Approve the exact target and credentials before any connection.
2. In the verified isolated target, the reviewed profiles migration and Supabase Auth schema/functions/standard roles must already exist under separate authorization. The harness requires a trusted `postgres` owner connection, no users and no profiles; use an external PostgreSQL service entry with approved disposable-only credentials. Confirm no other test/session or external Auth trigger has side effects. Review locks and fixture behavior. SQL claims are simulated under `SET LOCAL ROLE authenticated`, not signed JWTs.
3. From this worktree, use the following **template only after the preceding preflight**. Configure and independently verify `nexus-profiles-disposable` in a protected PostgreSQL service file; no password or token belongs in command arguments. The `profiles_test_target` value is an acknowledgement, not target verification. `-X` ignores psql startup files; `ON_ERROR_STOP` and the SQL guards fail fast.

   ```powershell
   psql "service=nexus-profiles-disposable" -X -v ON_ERROR_STOP=1 -v profiles_test_target=nexus-profiles-disposable -f database/supabase/tests/profiles.test.sql
   if ($LASTEXITCODE -ne 0) { throw "Profiles RLS harness failed; stop and investigate" }
   ```

   The script locks the empty fixture tables, uses a single transaction and ends in `ROLLBACK`. On any error, stop, close the connection and verify rollback; never blindly retry on another target. A SQL error exits before the final explicit rollback, so closing the session is essential. It uses no application service-role key.

4. After success or failure, verify cleanup in a new approved connection to the same independently verified disposable target, without printing user data:

   ```powershell
   psql "service=nexus-profiles-disposable" -X -v ON_ERROR_STOP=1 -c "SELECT (SELECT count(*) FROM auth.users) AS users_remaining, (SELECT count(*) FROM public.profiles) AS profiles_remaining, EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.profiles'::regclass AND conname = 'profiles_test_reject_signup') AS test_constraint_remaining;"
   if ($LASTEXITCODE -ne 0) { throw "Cleanup verification failed" }
   ```

   Require both counts to be zero and the constraint flag false; otherwise stop and investigate. Review any nontransactional/external trigger effects separately. This SQL check does not clean up Auth API or Storage fixtures from the future signed-token suite.

## Evidence

After authorized disposable execution, retain a screenshot showing the actual named suite, date/target identity in sanitized form, nonzero-failure behavior and passing summary, with no credentials, JWTs, emails or private data. Provide separate evidence for SQL role/claim simulation and signed-token API tests. A screenshot of offline structural checks or mocks does not satisfy the ClickUp proof.

Offline only: `python scripts/check_rls_harness.py` checks structural markers and transaction guards; it is neither a PostgreSQL parser nor an RLS execution. Run real PostgreSQL syntax/behavior checks only on an authorized disposable target.
