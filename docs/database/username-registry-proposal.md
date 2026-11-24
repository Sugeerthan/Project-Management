# Username registry and atomic signup proposal

**Status: Proposed; Awaiting Supervisor Approval. No migration implemented or applied.**

This is the database integration proposal for the [signup UI](../auth/signup-username.md).
The [current database design](database-design.md) gives Supabase Auth ownership of
identity but defines no approved username registry. The private profiles migration
on `feature/module-1-database-foundation` is unexecuted and unchanged. Do not add a
username to `display_name`, claim the proposed ERD is approved, or query tables
that do not exist. This proposal introduces no executable migration file.

## Decisions to approve first

1. Account-level username versus per-portfolio handle, multiple portfolios per
   account, and public URL routing. This task's account username and the separate
   ERD's portfolio handle are conflicting proposals, not interchangeable fields.
2. Canonical format/length and reserved words. Proposed signup policy is
   `username-v1-proposed`: trim, ASCII lowercase, 3–30 `[a-z][a-z0-9_]*` characters.
   Decide whether protected prefixes and impersonation variants also need blocking.
3. Whether usernames are immutable, rename/redirect/reuse rules, and treatment of
   preexisting accounts, reserved-word additions, and accounts awaiting confirmation.
4. Lookup transport, its restricted DB execution identity, anti-enumeration quotas,
   trusted request identity/IP handling, and CAPTCHA/abuse requirements.
5. Password policy alignment, verified-email flow/templates, account-exists behavior,
   uncertain signup outcomes, cleanup/retention, and approved integration rollout.

## Proposed physical model

Exact table/function names below are proposals and must not be used by application
code until approved migrations exist.

| Proposed object / field      | Proposed invariant                                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Private `username_registry`  | One account username row per Auth identity; not a portfolio or private display name                                    |
| `canonical_username text`    | Non-null PRIMARY KEY (or equivalent UNIQUE constraint), deterministic ASCII/C collation, format and 3–30 length checks |
| `auth_user_id uuid`          | Non-null UNIQUE FK to `auth.users(id)` with Auth deletion cascade; derived solely from `NEW.id`                        |
| `contract_version text`      | Approved policy version written by trusted provisioning logic                                                          |
| `created_at timestamptz`     | Database-generated timestamp                                                                                           |
| Private reserved-name policy | Versioned reviewed list enforced by trusted trigger/lookup code, not client input                                      |

Require canonical storage equal to its ASCII-lowercase, trimmed form. Do not rely
on UI normalization or a case-sensitive raw-string UNIQUE index alone. All writes
must pass the same format and reserved-word policy. A table CHECK cannot query a
mutable reserved table: use reviewed provisioning/validation logic and explicit
policy versioning. Do not create divergent ad hoc lists in clients and SQL.
Reject non-ASCII source characters before case conversion; do not use Unicode
case folding to turn a rejected character into an accepted ASCII name. Use an
explicit ASCII conversion or reviewed C-collation behavior matching the client.

Use the Auth primary key for ownership rather than email, metadata owner UUIDs,
or a profile display name. The registry should not depend on an application
profile row so it can coexist with the separate foundation proposal. Existing
Auth users may initially have no username; do not fabricate or automatically
allocate one during migration. Their claim/migration workflow needs approval.

## Atomic registration boundary

Recommended proposal: a narrowly privileged `AFTER INSERT ON auth.users` trigger
validates requested username metadata and inserts the registry row **inside the
Auth-user creation transaction**. Normal registration has this sequence:

1. The approved lookup returns advisory availability for one canonical name.
2. The application calls Supabase `auth.signUp` with email/password and
   `options.data = { requested_username, username_contract }`. These metadata
   values are untrusted requests, never approval/authorization claims.
3. The trigger checks the approved contract, canonicalizes/validates, rejects
   reserved names, and inserts the UNIQUE username using `NEW.id` as owner.
4. A uniqueness/policy/other provisioning failure propagates and aborts the full
   database transaction. Do not swallow exceptions or retry with a new name.

Two concurrent signups for the same canonical name can both pass availability;
the UNIQUE constraint allows only one registry row. The losing Auth insert must
roll back along with any profile row created by another provisioning trigger.
Auth-trigger order and all existing triggers must be inspected and tested in a
separately authorized disposable baseline before development rollout.

Require the trigger invariant for **every new public signup**, including direct
Auth API requests that bypass this form or omit metadata. A client-supplied
"admin", "skip username", or ownership flag must not bypass it. This can affect
other providers and administrative account creation; any approved exception must
be based on trusted server authority and a deliberate account lifecycle, not
editable user metadata. Do not introduce an exception silently.

Do not reserve a row before calling Auth and hope to delete it on failure. Do not
create an Auth user and then perform a separate client-side username INSERT. Both
are multi-transaction orphan risks. The proposed trigger instead makes database
failure atomic; it requires no privileged browser credential or post-signup write.
Auth deletion cascades registry rows, but deleting a registry row must not delete
its Auth account. Metadata updates alone must not rename or transfer a registry row.

Database atomicity does not cover email delivery or a lost HTTP response after
commit. An API/network error can leave a valid pending Auth account with an owned
username, so never report that every error proves no account exists. Define
idempotency/recovery and pending-email retention to prevent abandoned reservations
and username squatting. Cleanup must remove/update the Auth identity and registry
consistently under separately authorized operations, not delete usernames blindly
from a browser. Already-registered email responses must not claim a second username
was reserved or enumerate whether that email owns any name.

Supabase documents Auth-linked triggers and warns that failures can block signups;
review the [official user-data guidance](https://supabase.com/docs/guides/auth/managing-user-data).
Approval must include rollback/recovery procedures for a broken trigger. Removing
it while public signup remains enabled would break the username invariant.

## Minimal availability contract

The implemented semantic interface is `lookup(canonicalUsername, AbortSignal)`.
An approved server adapter must validate input and return only:

```json
{ "username": "maya_7", "status": "taken" }
```

Other allowed statuses are `available`, `reserved`, `invalid`, and `unavailable`.
No registered-user list, Auth/profile row, ownership UUID, email, count, raw SQL
error, or alternative-name availability batch is returned. The browser must never
turn a lookup failure into `available`. `available` does not lock or reserve.

No HTTP URL, RPC endpoint or adapter is implemented in this task. Choose the
transport and service identity only after approval. The preferred lookup execution
identity has only EXECUTE on one narrowly scoped private function; it must not be
a general service-role credential exposed to clients. Do not grant anonymous
table SELECT to implement a count query. If direct anonymous RPC is considered,
review how abuse controls survive calls that bypass an HTTP rate limiter; do not
claim the route limiter secures a separately public database RPC.

Required controls before exposure: bounded request size and rate/concurrency
limits, short lookup timeouts, no-store responses, cancellation support, generic
errors, safe request logging without email/password, and no batch enumeration.
Availability necessarily discloses whether a single requested name is occupied;
make that limited disclosure an explicit product/security decision.

## RLS and privilege review proposal

| Principal                   | Proposed registry access                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| Anonymous visitor           | No direct SELECT/INSERT/UPDATE/DELETE; minimal approved lookup transport only                          |
| Authenticated owner         | At most SELECT own canonical name if required later; no direct creation, transfer, rename, or deletion |
| Other authenticated account | No private registry row access; same minimal lookup disclosure                                         |
| Private Auth trigger        | Only required registry/policy access; derives owner from Auth `NEW.id`                                 |
| Restricted lookup principal | Execute one bounded lookup function only; no row/list enumeration privileges                           |
| Administrators              | Separately approved and audited lifecycle operations; no client-controlled role flags                  |

Enable RLS and revoke managed-schema defaults before exposing future tables. Keep
provisioning functions in an unexposed schema, pin an empty search path, qualify
references, restrict ownership and EXECUTE grants, and copy no unrelated metadata.
Review database-owner/RLS-bypass privileges separately. Do not give the browser
service-role access or authorize changes from metadata role claims.

## Proposed migration and rollout work items

1. Approve the preceding decisions and produce reviewed DDL for the registry,
   uniqueness/format constraints, policy enforcement, RLS/grants, trigger and
   restricted lookup function. Use a new migration; preserve existing foundation SQL.
2. Test a disposable target with synthetic users: case collisions, format/reserved
   rejection, invalid/missing metadata, owner spoofing, concurrent same-name Auth
   requests, registry failure rollback, coexistence with profile provisioning,
   Auth deletion, metadata-change immutability, and independent account deletion.
3. Test real Auth API behavior, duplicate email obfuscation, email confirmation,
   uncertain responses/retries, rate limiting, and pending-account recovery.
   A pair of mocked success/failure responses does not prove DB atomicity.
4. Separately inspect/authorize the development migration baseline, apply reviewed
   migrations there, and verify the actual lookup and trigger contracts. No such
   access or application is authorized by this documentation.
5. Only after those gates pass, implement the real server lookup adapter and wire
   the matching integration in a reviewed release. The current null integration
   must remain until then; do not replace it with a permissive stub or feature flag.
6. Capture the [development recording](../auth/signup-username.md#real-clickup-recording-prerequisites-and-walkthrough).
   Production promotion is a separate future task.
