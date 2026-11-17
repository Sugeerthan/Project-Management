# Database requirement-to-source mapping

**Status: Proposed; Awaiting Supervisor Review. Not approved or implemented.**

This mapping supports the [revised design](revised-database-design.md) and
[ERD](proposed-database-erd.md). Confirmed means explicitly documented domain
intent; it does not imply implementation or stakeholder approval of physical DDL.

| Requirement or concept                              | Repository evidence                                                                                                                                                      | Classification and design treatment                                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Managed identity                                    | [Database design](database-design.md)                                                                                                                                    | Confirmed: Supabase Auth owns identity; no duplicate credentials table.                                              |
| Private application profile                         | Local foundation guide (`docs/database/profiles-foundation.md`), local prepared migration (`database/supabase/migrations/20261110000000_create_profiles_foundation.sql`) | Prepared only: exact existing fields and policies preserved; not remotely verified.                                  |
| Profile isolation tests                             | Local SQL harness (`database/supabase/tests/profiles.test.sql`)                                                                                                          | Prepared, not run. Covers profiles only; SQL role simulation is not full Auth/API testing.                           |
| Portfolios, experience, education, projects, skills | [Database design](database-design.md)                                                                                                                                    | Confirmed concepts; separate child tables, columns, and constraints are proposed.                                    |
| User ownership and portfolio children               | [Relationships](relationships.md)                                                                                                                                        | Confirmed direction of ownership; profile FK, multiplicities, immutability, and delete behavior are proposed.        |
| Themes                                              | [Database design](database-design.md), [root README](../../README.md)                                                                                                    | Confirmed theme selection and five planned renderers; reusable catalogue and version representation are proposed.    |
| Assets                                              | [Database design](database-design.md), [relationships](relationships.md)                                                                                                 | Confirmed portfolio assets; metadata fields, pre-portfolio uploads, and cardinality are proposed.                    |
| CV upload, Storage, extraction                      | [Data flow](../architecture/data-flow.md), [CV extraction](../ai/cv-extraction.md)                                                                                       | Confirmed Storage upload and Zod validation before persistence; no approved upload/job schema.                       |
| Deployment records                                  | [Relationships](relationships.md), [deployment strategy](../deployment/deployment-strategy.md)                                                                           | Confirmed deployment concept and portfolio association; attempt records and publication FK are proposed.             |
| Review, preview, approval, publication              | [Data flow](../architecture/data-flow.md)                                                                                                                                | Confirmed workflow; immutable snapshots and current-publication pointer are architectural proposals.                 |
| Username route                                      | [Route placeholder](../../frontend/src/app/portfolio/%5Busername%5D/.gitkeep)                                                                                            | Structural intent only; no route implementation. Portfolio handle, uniqueness, and rename rules are proposals.       |
| Social links                                        | [Schema directory placeholder](../../database/schema/social-links/.gitkeep)                                                                                              | Structural intent only; excluded pending field/scope confirmation.                                                   |
| Administrative operations                           | [API overview](../api/api-overview.md)                                                                                                                                   | Confirmed planned API area; administrator roles and database privileges are unresolved.                              |
| Boundary contracts                                  | [System architecture](../architecture/system-architecture.md), [shared README](../../shared/README.md)                                                                   | Confirmed shared Zod contract direction; detailed schemas not supplied.                                              |
| Broader schema approval                             | [Database README](../../database/README.md), local foundation guide (`docs/database/profiles-foundation.md`)                                                             | Local-only evidence says the earlier 11-table proposal is not approved. Prepared SQL does not approve a broader ERD. |
| Payments, custom requests, merged status            | Cancelled descriptions supplied by the supervisor in this conversation; no equivalent current repository specification found                                             | Historical cancelled scope only; defer tables and status definition.                                                 |

## Local implementation evidence excluded from this branch

The profile migration, SQL harness, and foundation guide cited as local paths
were inspected in the uncommitted `feature/module-1-database-foundation` workspace.
They are not present in this documentation-only branch or its main baseline.
Their descriptions record local review evidence, not a claim that those files
are committed, deployed, approved, or available to reviewers in this branch.
The local database README update stating that the earlier 11-table proposal is
unapproved is also excluded; the baseline README does not contain that update.
No implementation files are required to render this design package.

## Cancelled ClickUp scope: historical record

The following records the supplied task descriptions, not a live ClickUp lookup.
No task IDs, cancellation rationale, source ERD, or original detailed specification
were supplied or found in the reviewed repository.

1. **Finalize schema incl. ERD changes:** write SQL migrations for USERS,
   PORTFOLIOS, EXPERIENCE, EDUCATION, PROJECTS, SKILLS, SOCIAL, FILES, THEMES,
   DEPLOY, PAYMENTS, and CUSTOM_REQUESTS; include FILES→PORTFOLIOS, username,
   and merged status; run on development.
2. **Write Row-Level Security policies:** apply owner-only SELECT/INSERT/UPDATE
   for portfolios, files, and custom requests; test with two accounts.

The supplied list has 12 entities. The repository refers to an earlier 11-table
proposal; their equivalence is unverified. Do not silently reconcile the count.

Overlapping concepts can enter the revised design because current documents
support them, not because the cancelled task names them. USERS maps conceptually
to managed Auth plus private profiles; FILES may overlap assets, and DEPLOY may
overlap deployments, but exact equivalence requires confirmation.

No current definition establishes what fields were merged into status. No billing
or custom-request workflow justifies those tables. **Payments and custom requests
remain deferred until requirements are confirmed.** Any future billing design
needs provider/webhook authority, purchase/refund lifecycle, and access rules; any
request design needs requester/assignee, workflow, retention, and access rules.

Cancellation does not establish permanent product rejection. It also does not
authorize implementation, migration execution, or restoration of the cancelled scope.
