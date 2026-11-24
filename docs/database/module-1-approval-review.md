# Module 1 database architecture approval review

**Status: Supervisor review requested. All recommendations and decisions are pending.**
This document is a decision package, not authorization to connect to a database,
apply a migration, enable signup or deploy. It describes repository evidence, not
the current state of either hosted Supabase project.

## 1. Executive summary

As of the reviewed `main` snapshot `644e2fe`, Supabase Auth login/session code,
signup UI and validation, provisional portfolio API contracts, CV extraction
contracts and type-generation tooling are in the repository. Signup lookup and
registration remain disabled; authenticated portfolio CRUD returns HTTP 503
because there is no database adapter. CV contracts are not database tables or
proof of a live extraction service. Generated database types are not present.

[PR #5](https://github.com/Sugeerthan/Project-Management/pull/5) proposes the
database design, ERD, requirements mapping and access matrix. [PR #12](https://github.com/Sugeerthan/Project-Management/pull/12)
prepares an unexecuted profiles migration. [PR #11](https://github.com/Sugeerthan/Project-Management/pull/11)
adds profiles isolation tests on top of that foundation. None of these establishes
an approved, deployed or runtime-verified portfolio schema. Supervisor decisions,
disposable PostgreSQL execution and signed-token RLS evidence are still required.

Sources reviewed: PR #5 at `d8b1bbe` ([design](https://github.com/Sugeerthan/Project-Management/blob/d8b1bbe1433b8b346fa80b0b1f151e96f148be84/docs/database/revised-database-design.md),
[ERD](https://github.com/Sugeerthan/Project-Management/blob/d8b1bbe1433b8b346fa80b0b1f151e96f148be84/docs/database/proposed-database-erd.md),
[requirements](https://github.com/Sugeerthan/Project-Management/blob/d8b1bbe1433b8b346fa80b0b1f151e96f148be84/docs/database/database-requirement-mapping.md),
[RLS matrix](https://github.com/Sugeerthan/Project-Management/blob/d8b1bbe1433b8b346fa80b0b1f151e96f148be84/docs/database/proposed-rls-access-matrix.md));
PR #12 at `f07563d` ([migration](https://github.com/Sugeerthan/Project-Management/blob/f07563d00f22143d987de19a7f774df578f8ddbb/database/supabase/migrations/20261110000000_create_profiles_foundation.sql),
[guide](https://github.com/Sugeerthan/Project-Management/blob/f07563d00f22143d987de19a7f774df578f8ddbb/docs/database/profiles-foundation.md));
PR #11 at `cc64409` ([test plan](https://github.com/Sugeerthan/Project-Management/blob/cc644099f4fd1aaf5010a37fdc95f19aaaf92e18/docs/database/rls-isolation-test-plan.md));
and the merged [username proposal](username-registry-proposal.md) and
[portfolio API contract](../api/portfolio-api.md).

## 2. Identity design decision

**Recommendation, pending approval:** one globally unique account username per
user, multiple portfolios per user, and a separate globally unique public handle
for each published portfolio. Existing users need an approved claim or migration
process; do not fabricate usernames for them. A draft need not reserve a public
handle unless the approved publication workflow requires it.

The signup proposal uses an account username of 3–30 lowercase ASCII characters
with underscores; PR #5 describes a per-portfolio handle of 3–63 characters with
hyphens. These are different proposals and their exact formats remain pending.
The URL must resolve the approved portfolio handle to a current public publication,
not assume `/portfolio/[username]` identifies an account or expose private drafts.

Use independently enforced canonical uniqueness and reserved-name policies for
the two namespaces. Decide whether names are immutable; if rename is allowed,
decide redirects, old-name reservation, reuse, collision and impersonation rules.
Availability checks are advisory; a database uniqueness constraint and atomic
provisioning must decide concurrent account claims. A minimal availability endpoint
also reveals whether individual names are taken, so approve its abuse controls.

## 3. Proposed minimum database scope

Recommend an initial, reviewed private-data slice, with exact names and columns
to be decided in DDL review:

| Component                 | Minimum responsibility                                                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Profiles                  | Private account data keyed to the Auth user; provision and protect system fields.                                                       |
| Account username registry | Canonical globally unique account username and unique Auth-owner association; enforce approved format and reservation rules atomically. |
| Portfolios                | Multiple records per owner; server-derived immutable owner and the approved draft fields.                                               |
| Education                 | Entries attached to an owned portfolio, with approved fields and parent ownership enforced.                                             |
| Work experience           | Entries attached to an owned portfolio, with approved fields and parent ownership enforced.                                             |

The merged API's `title`, `institution` and `organization` fields are provisional
request contracts, each bounded to 200 characters; they are not approved physical
columns. Map them deliberately to the approved schema and protect all owner and
parent IDs, including child reassignment. The initial contract offers no DELETE.
The proposed RLS matrix likewise defers direct deletion pending a lifecycle decision.

Skills, projects, CV processing and private files, public publishing and handles,
themes, deployment records and payments are later slices. The handle recommendation
is a future publication requirement, not a demand to implement publication in the
initial migration. Payments have no confirmed current database requirement.

## 4. Profiles migration review

PR #12 creates `public.profiles` with the Auth UUID as primary key and cascading
foreign key, nullable display name and database timestamps. An `AFTER INSERT` Auth
trigger calls a private `SECURITY DEFINER` function with an empty search path and
creates the ID-only profile; failure propagates to the Auth transaction. The
backfill inserts IDs for preexisting Auth users without overwriting profile data.
The migration deliberately fails on conflicting objects rather than adopting an
unknown existing schema.

RLS restricts authenticated SELECT and UPDATE to the matching `auth.uid()`;
grants allow SELECT and only `display_name` UPDATE. A trigger protects the ID and
timestamps and sets the update timestamp. Direct client insert and delete are not
granted. Anonymous sign-ins need separate attention because they use the
authenticated role. The policy denies an explicit `is_anonymous=true` but treats
a missing claim as `false`; confirm accepted issuers and decide whether missing
claims should fail closed, with tests for both token types and missing claims.

The profile trigger does not reserve usernames. Review existing Auth triggers,
execution order, function ownership, privileges, locking and backfill volume before
any application. A later username reservation must coexist with profile
provisioning and roll back the entire Auth transaction on failure, including
concurrent claims and direct Auth calls. Define recovery if provisioning breaks;
do not silently disable a required trigger. SQL rollback does not necessarily
undo external effects from other triggers.

## 5. PR #12 integration issue

A read-only three-way comparison with `main` at `644e2fe` found a `README.md`
conflict: the foundation branch's older text says Supabase is not integrated,
while current `main` documents implemented Auth. In a separately authorized
integration, retain current Auth and CV setup and accurately add the prepared,
unexecuted database foundation and its testing prerequisites. Do not imply live
database CRUD or overwrite either feature's setup instructions. Recheck the
conflict against the then-current base; this package does not resolve it.

## 6. Database testing strategy

| Target                                   | Suitability and constraints                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Disposable local Supabase                | Recommended first choice if approved: isolated synthetic data and no hosted project cost. Windows `supabase start` requires a Docker-compatible runtime; this needs a decision given the project's no-Docker direction. Local success does not establish hosted parity. [Supabase local development](https://supabase.com/docs/guides/local-development). |
| Authorized hosted disposable environment | Alternative if locally unavailable; separately verify identity, isolation, data, credentials, automation, plan and costs. Branching availability and charges depend on the organization and plan; it is not automatically free. [Supabase branching usage](https://supabase.com/docs/guides/platform/manage-your-usage/branching).                        |
| Existing development project             | Not assumed empty or disposable. The profiles harness requires empty Auth users and profiles, takes locks, and is inappropriate for a shared or populated environment. Any later non-destructive inspection or rollout requires its own authorization and target-specific plan. Never reset it for these tests.                                           |

Before connecting, independently verify host/project reference and credentials
against a trusted inventory and obtain explicit authorization for the exact
target and operations. A psql acknowledgement is not target verification: its
guard runs after connection. Use synthetic users, an isolated baseline, fail-fast
execution, timeouts, rollback and separately verified cleanup. On failure close
the session before checking cleanup; consider external trigger effects separately.
Use a different disposable baseline with preexisting synthetic Auth users to
test backfill. Never use production credentials or a service-role key as proof of
normal-user isolation.

SQL role/JWT-claim simulation verifies database behavior only. Separately test
genuine Auth-issued A and B tokens through the Data API and later the application,
including unauthenticated and anonymous-sign-in contexts. Record sanitized,
dated evidence and an actual passing suite screenshot; offline checks and mocks
are not RLS proof.

## 7. Supervisor decision table

| Decision required                 | Existing proposals                                                                      | Recommended option                                                                               | Reason                                                     | Risk or consequence                                                             | Approval status |
| --------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------- |
| Account identity and portfolios   | Account username versus per-portfolio handle; multiplicity unresolved                   | Separate one account username, multiple portfolios and one unique handle per published portfolio | Distinct account and public resource lifecycles            | Requires separate namespaces and an existing-user claim process                 | Pending         |
| Naming, routing and lifecycle     | Signup underscores/3–30; handle hyphens/3–63                                            | Approve each canonical format, reserved list and handle-based route independently                | Avoid conflating URL and account identity                  | Rename, redirects, reuse and impersonation must be specified                    | Pending         |
| Initial data scope                | Full ERD is proposed; API needs private portfolio and children                          | Profiles, username registry, portfolios, education and experience first                          | Small reviewable slice supports signup and API foundations | Later features remain unavailable                                               | Pending         |
| Profile and username provisioning | ID-only profile trigger; separate atomic registry proposal                              | Review coordinated, transactionally atomic provisioning                                          | Prevent orphan users and username races                    | A trigger failure can block signup; providers and existing users need a plan    | Pending         |
| Claims and private access         | Profile policy defaults missing anonymous claim to false; matrix denies anonymous users | Decide accepted issuer/claim contract and test missing and anonymous claims                      | Establish a verifiable authorization boundary              | Stricter rules may reject legacy tokens; permissive defaults need justification | Pending         |
| Deletion and recovery             | Direct client deletion deferred                                                         | Approve retention, cascading effects and recovery before delete grants                           | Protect dependent records and operational invariants       | Users may have no self-service deletion until implemented                       | Pending         |
| CV, assets and publication        | Private Storage, extraction records and snapshots proposed                              | Defer to dedicated reviews with retention and safe public projection                             | Prevent private CVs and drafts leaking                     | Publishing and extraction remain unavailable                                    | Pending         |
| Test environment                  | Local stack, hosted disposable or existing development                                  | Prefer an approved isolated local stack; otherwise an approved dedicated hosted target           | Reproducible tests without real user data                  | Container policy, resources, hosted charges and parity require review           | Pending         |
| Rollout and privileged operations | Foundation and later DDL unexecuted                                                     | Separate approvals for test execution, development rollout and production promotion              | Control target, automation, credentials and recovery       | More gates; avoids treating a PR merge as deployment approval                   | Pending         |

## 8. Implementation sequence

1. Approve the identity, scope, access, lifecycle and environment decisions above.
2. Review PR #12 and reconcile its integration conflict; verify merge/deployment
   automation cannot silently apply migrations. Merge decisions remain separate.
3. Prepare and authorize a verified disposable target. Review exact migration,
   trigger coexistence and rollback/recovery plan before execution.
4. Execute profiles SQL and PR #11 tests there; separately test preexisting-user
   backfill, failure rollback and real signed-token API isolation. Record evidence.
5. Design and review the minimum username, portfolio and child DDL and RLS; test
   races, owner forgery, parent references and grants in both user directions.
6. After a separately approved non-destructive deployment to the verified schema
   target, generate real TypeScript types with explicit project verification and
   review schema drift. Do not fabricate types for undeployed tables.
7. Implement request-scoped application adapters and enable signup or CRUD only
   after their own reviewed database and signed-token acceptance tests pass.

## 9. Acceptance checklist before database deployment

- [ ] Supervisor decisions, exact scope, DDL, RLS matrix and grants approved.
- [ ] Target identity and credentials independently verified; execution expressly
      authorized; existing objects, migration history and Auth triggers assessed.
- [ ] Deployment automation, backup, recovery, locks and signup impact reviewed;
      no unapproved reset or production operation in the plan.
- [ ] Actual PostgreSQL execution succeeds on an authorized disposable baseline,
      including migration, constraints, provisioning, backfill and rollback cases.
- [ ] SQL suite verifies both users, forged owners, protected columns, grants,
      anonymous contexts and parent isolation for each implemented table; cleanup
      and absence of leftover fixtures or test constraints independently verified.
- [ ] Real signed A/B tokens demonstrate own access and denied cross-user reads and
      writes in both directions through the Data API, plus application routes when
      enabled; unauthenticated and anonymous-sign-in cases are covered.
- [ ] Provisioning coexistence, concurrent username claims, missing/invalid
      metadata and transaction failure recovery have been tested where applicable.
- [ ] Sanitized logs and a screenshot of the actual passing suite retained without
      credentials, tokens or private user data; no mock or offline result presented
      as proof of live RLS.
- [ ] Any Storage/publication scope has separate object-level and public/private
      boundary evidence; types are generated only from an approved deployed schema.
- [ ] A target-specific rollout and recovery decision is separately approved.
