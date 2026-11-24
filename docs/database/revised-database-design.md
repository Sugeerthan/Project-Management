# Revised database design

**Status: Proposed; Awaiting Supervisor Review. Not approved or implemented.**

This package reconciles current repository requirements with a proposed physical
model. It does not reactivate cancelled ClickUp scope. Only the private profiles
migration and its SQL harness are prepared; neither has been executed against
Supabase. They remain unchanged. No remote schema state is asserted.

## Review package

- [ERD and relationship constraints](proposed-database-erd.md)
- [Requirement-to-source mapping and cancelled scope](database-requirement-mapping.md)
- [Proposed RLS and Storage access matrix](proposed-rls-access-matrix.md)
- [Decisions and implementation gates](database-design-decisions.md)
- Repository evidence: [database design](database-design.md),
  [relationships](relationships.md), and local profiles foundation guide (`docs/database/profiles-foundation.md`)

The local profiles evidence is not included on this documentation-only branch;
see the [evidence qualification](database-requirement-mapping.md#local-implementation-evidence-excluded-from-this-branch).

## Evidence and scope

Supabase Auth owns identity. Current database documents name portfolios,
experience, education, projects, skills, themes, assets, and deployments. Users own
portfolios; portfolios contain CV sections and relate to themes, assets, and
deployment records. The [data flow](../architecture/data-flow.md) requires validated
extraction, customer editing, theme choice, preview, approval, and publication.

Those are confirmed domain concepts, not approval of a complete schema. Except
for the existing profiles definition, all columns, constraints, exact
cardinalities, normalization choices, and foreign keys in this package are
proposals. Directory placeholders indicate intent, not working features.

## Identity and draft model

Preserve `profiles.id` as the Auth UUID and primary/foreign key to `auth.users.id`.
The prepared signup trigger creates the profile without copying untrusted user
metadata; the migration backfills IDs for existing accounts. Auth deletion cascades
to the profile. No duplicate USERS credential table is proposed. The migration
allows only own-profile reads and display-name updates; profiles stay private.
Display name is not a public URL identifier. Profile fields and provisioning
choices remain subject to the existing foundation review gates.

Propose multiple portfolios per profile, each with one immutable owner. Education,
experience, projects, and skills are ordered, portfolio-local draft rows. This
avoids premature global skills taxonomy or shared content semantics. All child
ownership is derived from the parent portfolio rather than repeated owner fields.
A reusable theme catalogue supplies an optional selected theme while drafting.
Theme versions must be pinned when creating a publication.

The ERD deliberately shows only representative content fields. CV section field
contracts, required values, length limits, dates, and validation rules must be
agreed in shared Zod schemas before migrations are authored. Proposed UUID keys,
timestamps, and sort positions are implementation choices, not extracted requirements.

## Username-based URLs

The existing `frontend/src/app/portfolio/[username]/.gitkeep` suggests
`/portfolio/{username}` but implements no route behavior or database contract.

Propose a nullable, globally unique `portfolios.public_handle`, populated before
first publication. The route parameter may remain named `username`; it resolves
a portfolio handle, not an Auth identifier or private profile query. This supports
the documented user-to-many-portfolios model without selecting an arbitrary portfolio.
An account-wide username with a primary portfolio is an alternative requiring approval.

Proposed validation: canonical lowercase ASCII letters, digits, and internal
hyphens, 3–63 characters, with a reserved-name list. Enforce canonicalization and
uniqueness in the database as well as at the input boundary. Handle allocation
must be atomic. Changes after publication require an explicit rename/redirect and
reuse policy; default to stable handles until that policy exists. Handles never
authorize access: UUID ownership remains the security key.

Resolve public URLs through a narrow publication query or server response that
returns only the current public snapshot. Unknown, draft-only, and unpublished
handles return no public portfolio. Do not grant public SELECT on draft portfolios
or profiles just to implement routing.

## Uploaded CVs, assets, and portfolios

The confirmed workflow stores CV bytes in Supabase Storage and persists validated
extracted data in PostgreSQL. Propose `assets` for object metadata, including an
immutable owner, private bucket/object key, and an asset kind such as source CV or
portfolio media. Raw CVs are private inputs, not public portfolio content.

Allow `assets.portfolio_id` to be null during upload before portfolio creation;
later association must verify that asset and portfolio share an owner. This is a
proposal to reconcile upload-first flow, not a documented nullable relationship.
The initial model associates an asset with at most one portfolio. Reuse across
portfolios would require a separately approved link model.

Storage metadata and object creation are not one database transaction. Plan pending
upload reconciliation, abandoned-upload expiry, extraction failure handling, and
cleanup of deleted/replaced objects. Do not persist expiring signed URLs as object
identity. Source CV retention, maximum size, supported types, and extraction audit
records need decisions. No extraction-job table is included without that decision.

## Draft and publication boundary

Approval-before-publication is confirmed. A separate `portfolio_publications`
table is an architectural proposal to enforce that boundary, not a currently
documented table requirement.

Propose immutable, versioned snapshots of an explicitly approved draft revision.
The server builds an allowlisted public payload and pins the theme version plus
approved media references. It excludes raw CVs, private profile fields, extraction
payloads, internal notes, and private object keys. A snapshot must not read mutable
draft rows at render time. Later draft edits do not alter the existing publication.

An authorized publication operation verifies ownership, approval of that exact
revision, and asset readiness. Deployment records refer to that publication.
Only after successful publication/deployment does a controlled operation switch
`portfolios.current_publication_id` atomically. The pointer is a private control
field; public delivery exposes only the snapshot selected by it. A selected
publication must belong to that same portfolio. Public reads need no access to
the private control row itself.

Failed deployments leave the prior publication active. Unpublishing clears the
pointer and disables public delivery; CDN artifacts and copied public media also
need invalidation/cleanup. Historical snapshots remain private unless selected.
Public payloads are immutable; publication selection and delivery metadata are
service controlled. Concurrent approval/publishing must use draft revision checks
or equivalent locking to prevent publishing unapproved edits.

Generated artifacts instead of database snapshots remain an alternative. Decide
that boundary before implementing publication storage or public RLS.

## Lifecycle and deferred scope

Do not implement a generic merged `status`: its source fields and meaning are
absent. Extraction, approval, publication selection, and deployment outcome are
distinct concerns. `deployments.state` in the ERD is only a proposed operational
field; its values and transitions are not approved.

Payments and custom requests are explicitly deferred until product requirements
are confirmed. Social links have a directory placeholder but no field contract;
they are also excluded from the proposed initial table set. Administrative API
intent does not establish an administrative database role or blanket access.

Do not assume cascading account deletion can remove Storage objects or deployed
artifacts. Except for the existing Auth-to-profile cascade, delete actions and
retention policies require review. Index proposed owner/parent foreign keys and
public handle lookups; choose other indexes from actual access patterns.
