# Proposed RLS and Storage access matrix

**Status: Proposed; Awaiting Supervisor Review. Not approved or implemented.**

Only the profiles row below reflects prepared SQL. All remaining rows depend on
approval of the [design](revised-database-design.md) and [ERD](proposed-database-erd.md).

## Database access

Owner means a non-anonymous authenticated account whose Auth UUID owns the row or
its parent portfolio. Other authenticated users have no private access. Supabase
anonymous sign-ins use an authenticated role; deny them private owner operations,
consistent with the prepared profiles policy. They may use the public delivery surface.

| Resource                                 | Owner                                                                           | Other authenticated users   | Anonymous visitors                         | Privileged server operations                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------- |
| Private profiles                         | SELECT own; UPDATE display_name only                                            | Deny                        | Deny                                       | Existing private signup trigger and backfill only; no general service-role grant |
| Draft portfolios                         | SELECT, INSERT, UPDATE permitted draft fields                                   | Deny                        | Deny                                       | Explicitly authorized extraction/orchestration only; verify owner                |
| Education, experiences, projects, skills | SELECT, INSERT, UPDATE through owned parent                                     | Deny                        | Deny                                       | Validated extraction writes only under an approved contract                      |
| Asset metadata                           | SELECT, INSERT for own upload; limited UPDATE of permitted metadata/association | Deny                        | Deny                                       | Validate object existence/type; reconcile and clean up through scoped operations |
| Available theme catalogue                | SELECT available entries                                                        | SELECT available entries    | SELECT public catalogue fields if approved | Explicit theme-management authorization; no customer writes                      |
| Publication snapshots                    | SELECT own history; no direct INSERT/UPDATE/DELETE                              | Current public payload only | Current public payload only                | Create approved immutable snapshot; select/unselect current publication          |
| Deployment records                       | SELECT sanitized own records; no operational writes                             | Deny                        | Deny                                       | Create attempts and update operational state after authorization                 |
| Public portfolio lookup                  | Current public payload only                                                     | Current public payload only | Current public payload only                | Resolve canonical handle to current publication without exposing drafts          |

Direct client DELETE is denied in this initial proposal. Portfolio, section, asset,
and account deletion workflows and retention need approval before delete grants.
Auth identity is managed through Auth APIs; this matrix does not grant direct
application access to `auth.users`. Owners do not acquire privileged write access
merely because they can request publication or deployment.

## Policy and grant requirements

- Enable RLS before exposing each future table and revoke unintended default grants.
  Grant only needed operations/columns. Protect owner IDs, publication pointers,
  revision counters, timestamps, and operational fields from direct client changes.
- For owner SELECT use ownership predicates. INSERT needs `WITH CHECK`; UPDATE
  needs both `USING` and `WITH CHECK`, plus applicable SELECT access and column grants.
  Child policies verify the parent portfolio owner, including the destination
  parent on reassignment. Prefer immutable parent links unless reparenting is approved.
- Asset insertion and association require both caller ownership and matching
  portfolio ownership. Storage paths are not proof that a portfolio belongs to a caller.
- Apply relational constraints alongside policies. Server roles that bypass RLS
  still need explicit business authorization; owner checks cannot rely on RLS there.
- Current-publication lookup must not require anonymous table access to private
  portfolios. Use a narrowly authorized server endpoint or reviewed projection/RPC
  with only safe output and no arbitrary row selector. A view is not automatically
  a safe RLS boundary; review its execution privileges and all underlying grants.
- Public reads return only the selected publication's allowlisted payload. Never
  grant broad snapshot-row SELECT if rows contain private approval or audit metadata.
  Historical/unselected snapshots remain owner-only. An authenticated caller must
  retain the same public access as an anonymous visitor.
- Privileged credentials stay server-only. Do not infer an administrator role from
  user-editable Auth metadata. Approve each privileged operation and its audit trail.

The existing migration revokes profile grants even from `service_role`. This
proposal does not change that choice. General backend profile access would need
a separate reviewed privilege change. Database owners and bypass roles are outside
the protection offered by owner RLS.

## Supabase Storage

| Object class                 | Owner                                                                  | Other users / anonymous                       | Privileged server                                                         |
| ---------------------------- | ---------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| Source CVs and private media | Authenticated own-object upload/read under bucket and ownership rules  | Deny                                          | Authorized extraction/read and lifecycle cleanup                          |
| Unassociated uploads         | Own staging area only; association checked separately                  | Deny                                          | Reconcile expiry/orphans and validate completed uploads                   |
| Approved public media copies | Read through approved publication delivery; no direct public overwrite | Public read only when intentionally published | Create immutable copies; revoke delivery and clean up on unpublish/delete |

Use private buckets for source CVs and drafts. Define separate `storage.objects`
policies for SELECT/INSERT/UPDATE/DELETE as required by the actual upload flow;
application metadata RLS does not secure object bytes. If overwrite/upsert is
unnecessary, deny it. Validate bucket, owner/path namespace, and metadata association
on every permitted write; prevent moving or overwriting another owner's object.

Use short-lived signed URLs or authorized server streaming for private downloads.
Do not log signed URLs or include them in public snapshots. Enforce size and MIME
allowlists, validate actual content server-side, and decide malware handling and
filename sanitization before launch. Treat uploads and extracted text as untrusted.

Publish only specifically approved media, preferably immutable copies distinct
from private source objects. A public bucket exposes bytes independently of
application RLS and cannot promise immediate revocation from downstream caches.
Choose public bucket versus controlled delivery and document cache invalidation,
expiry, retention, and cleanup guarantees before adopting that model.

## Future acceptance tests

Use two real test accounts plus SQL assertions in an authorized disposable target.
Test both directions of isolation, forged owner IDs, cross-owner foreign keys,
reparenting, protected-column writes, anonymous-sign-in denial, and object-path
attacks. Verify owner rights do not allow approval/deployment state forgery.

Verify draft edits leave published payload/media unchanged; unpublished and old
snapshots cannot be fetched publicly; failed deployment preserves the prior public
version; concurrent edits cannot publish an unapproved revision. Exercise actual
Auth JWTs and Storage APIs, not only simulated SQL claims. The existing profiles
harness remains unchanged and must not run against a populated/shared development target.
