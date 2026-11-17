# Database design decisions awaiting approval

**Status: Proposed; Awaiting Supervisor Review. Not approved or implemented.**

Review with the [design](revised-database-design.md), [ERD](proposed-database-erd.md),
[source mapping](database-requirement-mapping.md), and [RLS matrix](proposed-rls-access-matrix.md).

| ID  | Decision requiring supervisor approval             | Proposed direction / consequence                                                                                                                                                              |
| --- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D01 | Authoritative scope and cancelled-task disposition | Confirm current documents supersede cancelled descriptions; obtain original ERD and cancellation rationale if available.                                                                      |
| D02 | Limited profiles foundation                        | Approve existing fields, trigger/backfill, anonymous-sign-in exclusion, signup failure coupling, and account lifecycle. Preserve existing SQL/tests during this design review.                |
| D03 | Portfolio multiplicity and URL ownership           | Multiple portfolios per account; one globally unique handle per portfolio. Alternative account username requires a primary-portfolio rule.                                                    |
| D04 | Handle lifecycle                                   | Approve normalization, length/alphabet, reserved names, allocation, renames, redirects, and reuse. Proposed default is a stable handle.                                                       |
| D05 | CV section contracts                               | Approve normalized portfolio-local rows versus JSON; required fields, validation, ordering, limits, dates, and skills taxonomy.                                                               |
| D06 | CV/asset relationship                              | Approve optional portfolio association during upload, same-owner enforcement, asset reuse, Storage naming, and maximum sizes/types.                                                           |
| D07 | Approval authority and audit                       | Identify approver, whether owner approval suffices, how approved revision/actor is recorded, and concurrency rules. No admin role is yet approved.                                            |
| D08 | Publication boundary                               | Choose immutable database snapshots versus generated artifacts; approve current-publication selection, public payload schema, rollback, and unpublish guarantees.                             |
| D09 | Theme versioning                                   | Choose immutable catalogue revisions or another version contract; define how availability changes affect existing publications.                                                               |
| D10 | Deployment lifecycle                               | Approve provider references, states/transitions, idempotency, retries, sanitized owner-visible fields, and publication activation timing.                                                     |
| D11 | Storage delivery and retention                     | Choose public media copies versus controlled delivery, signed URL expiry, cache invalidation, CV retention, malware handling, and orphan reconciliation.                                      |
| D12 | Deletion and recovery                              | Define child FK actions, snapshot retention, account deletion orchestration, object/artifact cleanup, backups, and failed-cleanup recovery. Only Auth-to-profile cascade is already prepared. |
| D13 | Privileged operations                              | Define service grants, administrative authorization, safe public lookup implementation, and audit records. No blanket service-role profile access.                                            |
| D14 | Deferred capabilities                              | Payments/custom requests require confirmed product workflows; social links require a content contract. No table implementation by implication.                                                |
| D15 | Status semantics                                   | Identify the original merged fields and transitions before considering a merged status. Avoid conflating independent processes.                                                               |
| D16 | Test and rollout authority                         | Approve disposable Supabase-compatible test target and later development inspection/application separately. Remote baseline and successful execution remain unknown.                          |

## Recommended next task

**Review and approve the revised ERD, ownership model, and publication boundary.**

Acceptance: record a disposition for each decision, approve the requirement mapping
and table scope, resolve the URL and Storage models, and agree the public/private
payload contract. Resolve relevant blockers before authoring each migration;
approval of domain scope alone is not approval of all proposed columns.

## Implementation roadmap after design approval

1. Validate the existing profiles foundation under its
   local controlled testing procedure (`docs/database/profiles-foundation.md`), including real Auth/API
   behavior and a separate backfill scenario. Do not run its empty-target harness
   in shared development. No execution is authorized by this document.
2. Under separate authorization, inspect the development baseline and plan/apply
   the reviewed foundation after disposable tests pass. Preserve applied migration
   history; later corrections use new migrations.
3. Author incremental portfolio, content, and theme migrations plus least-privilege
   ownership policies based on approved contracts. Test both user directions and
   malicious foreign-key assignments.
4. Implement approved asset metadata, Storage policies, upload validation, and
   lifecycle cleanup with API-level isolation tests.
5. Implement approved revision/approval, publication, URL lookup, and deployment
   model. Test draft isolation, concurrency, rollback, failed deploys, and unpublish.
6. Generate database types only after introspection of a verified applied schema.
   Revisit deferred capabilities only with approved requirements.

Production promotion, dependency changes, application work, and remote operations
are separate tasks. This documentation does not authorize them or close the parent
database task. Readiness for implementation depends on decision approval and later
execution evidence, not on the presence of an ERD.
