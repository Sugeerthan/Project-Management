# Signup UI and proposed username contract

**Status: UI and validation implemented; real lookup and registration blocked.**

This work is based on `feature/module-1-auth-session` and reuses its design,
public Supabase configuration validation, test runner, and login route. It does
not merge the unexecuted profiles migration or Module 2 contracts. The ClickUp
task requires an email/password/username form, live reserved/unique checks, and
suggestions for taken names. Only an approved DB-backed registry can establish
real availability; that registry does not exist in the current implementation.

## Implemented versus deferred

| Capability                 | Current behavior                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `/signup`                  | Responsive accessible form, labels, show/hide password, inline errors, loading/duplicate lock, login link      |
| Username policy            | Proposed local normalization, validation and versioned reserved-word list                                      |
| Availability state machine | Debounce, cancellation, stale-result guards, timeout, retry, and safe status messages                          |
| Taken/reserved suggestions | Deterministic local candidates; selecting one checks only that candidate                                       |
| Real availability          | **Unavailable**; no endpoint, table query, or network fallback is invented                                     |
| Account registration       | **Blocked** before any Auth client is created, even on programmatic form submit                                |
| Supabase signup adapter    | Dormant, unit-tested integration seam for a future approved atomic Auth trigger; never wired by the page       |
| Email confirmation         | Generic confirmation response is tested using mocks; no actual email or account is created                     |
| Database integration       | [Concrete registry/migration proposal](../database/username-registry-proposal.md), pending supervisor approval |

`SignupForm` always uses `signupService` on the real page. That service is created
with a literal null integration. No environment flag, query parameter, local
storage value, or browser-reported readiness can enable it. Explicit injected
services in `.test.tsx` files are mocks, not a product demo mode. Correct public
Supabase keys alone cannot enable signup. No availability HTTP route exists yet.
This client gate prevents this application from attempting registration; it does
not disable the public Supabase Auth API or enforce uniqueness against callers
who bypass the UI. Only the future database invariant can enforce that boundary.
The form explicitly uses POST so a failed JavaScript enhancement cannot place
passwords in a default GET query string; no fallback registration endpoint is added.

## Proposed username rules

The contract identifier is `username-v1-proposed`. Canonical names:

- Have 3–30 ASCII characters, matching `^[a-z][a-z0-9_]*$` plus length bounds.
- Start with a letter; contain lowercase letters, digits and underscores only.
- Trim surrounding whitespace and lowercase ASCII A–Z before validation/checking.
- Reject spaces inside the name, hyphens, dots, Unicode letters/confusables,
  controls, and punctuation. Unicode case folding/transliteration is not performed.
- Compare uniqueness only after canonicalization. `Maya_7` and `maya_7` refer to
  the same proposed registry key.
- Are unrelated to private `profiles.display_name`; no field is repurposed.

The current source of rules is
[`frontend/src/features/signup/username.ts`](../../frontend/src/features/signup/username.ts).
The reserved list includes admin, api, login, logout, signup, dashboard, settings,
portfolio, auth, support, help, www, register, and other application route/system
names. Matching is exact after normalization, not a prefix ban. Thus `admin_1`
can be a format-valid suggestion; broader impersonation/prefix protections are
an explicit supervisor decision before enabling real registration.

The future server and database must enforce the same policy independently.
Version the list together with the validator; review new application routes before
adding them. Decide treatment of an existing owner when a name becomes reserved.
A client-supplied policy version is input to validate, not proof of approval.

### Conflict with the earlier public-handle proposal

The separate [proposed database design](https://github.com/Sugeerthan/Project-Management/blob/d8b1bbe1433b8b346fa80b0b1f151e96f148be84/docs/database/revised-database-design.md)
suggests a **per-portfolio** `public_handle`, 3–63 characters with hyphens, with
ownership and URL routing still unresolved. This task proposes an **account signup
username**, 3–30 characters with underscores. Neither contract is approved.
Do not map one to the other or change `/portfolio/[username]` based on this UI.
The supervisor must decide account versus portfolio ownership, multiplicity,
URL mapping, rename, redirects, and reuse before schema implementation.

## Email and password validation

Email validation reuses the login validator and 254-character limit. Passwords
are preserved exactly, never trimmed or silently truncated. The proposed client
baseline requires at least 12 Unicode code points, at most 72 UTF-8 bytes, and
rejects all-whitespace values. A show/hide button has accessible pressed state.
This is not a claim about the configured project policy: reconcile it with the
approved Auth password requirements before enabling registration. Provider-side
validation remains authoritative; see [Supabase password security](https://supabase.com/docs/guides/auth/password-security).

## Availability and suggestions

`SignupService.checkUsername(canonicalName, signal)` returns only
`{ username, status }`. Lookup statuses are `available`, `taken`, `reserved`,
`invalid`, and `unavailable`; the UI also has `idle` and `checking`. Errors map to
`unavailable` without reflecting backend exception text. Successful responses must
echo the exact canonical name. Transport, endpoint path and authentication model
remain unimplemented pending the registry review.

Local invalid/reserved checks happen immediately and do not call the backend.
Valid names use a 400 ms debounce and 8 second timeout. Abort signals, effect
cleanup, request generations and input revisions prevent old replies from
overwriting newer state, including A → B → A edits. Failed, timed-out, mismatched,
or cancelled lookups never become `available`. No available result is cached for
authorization. The service performs a fresh informational check before signup;
only the future UNIQUE constraint and transaction can decide who wins a race.

Suggestions use the canonical stem truncated to 28 characters plus `_1`, `_2`,
and `_3`, then pass through the same format/reserved checks. They contain no
email-derived data, random identity claims, account IDs, or fetched registry lists.
They are visibly **not checked for availability**. Selecting one changes the field
and starts a new check; it does not submit or claim that candidate is free.

## Safe registration and confirmation

The dormant adapter requires a matching `UsernameRegistryIntegration` with
`atomicRegistration: 'auth-insert-trigger-v1'`. This TypeScript marker is not a
security boundary or database readiness probe. Enabling it requires a future
reviewed code change after the [database gates](../database/username-registry-proposal.md)
are satisfied, not supplying a mock or turning on an environment variable.

If enabled in a future rollout, it invokes the existing public-key architecture's
Supabase `signUp` API with email/password and metadata containing only
`requested_username` and `username_contract`. A reviewed Auth INSERT trigger must
validate and create the username row in that same transaction, deriving ownership
from `NEW.id`. No post-signup client database write or ownership UUID is sent.
UI availability is informational, not a reservation or promise of successful signup.

Signup uses an isolated Supabase client with persistence, automatic refresh and
URL-session detection disabled. It cannot overwrite the existing SSR cookie/login
session. No `signIn`, `setSession`, dashboard navigation, service-role key, or
email-confirmation bypass is added. An unexpected session in a signup response
causes local cleanup and failure, not automatic login. Even a failed cleanup has
no cookie/localStorage session to leave behind.

A successful no-session response shows: "If registration can be completed, check
your email for a confirmation link. After confirming your email, return to sign in."
It does not assert account creation or username ownership: Supabase can obfuscate
existing-account responses. The password is cleared from the form after that
response. Errors are generic; an uncertain result is not blindly retried or
described as proof that no account exists. Confirm the email through an approved
provider flow, then use the existing password login. No custom verification-token
callback, redirect setting, or email template is implemented or changed here.

## Tests and verification

From the root of this worktree:

```sh
npm run test:signup
npm run test:auth
npm run lint
npm run typecheck
npm run build:frontend
```

`test:signup` targets the new signup tests. `test:auth` runs the complete frontend
suite, including existing login/session tests and signup tests. Dependencies and
the root lockfile are inherited unchanged; no new package is required.

Tests cover local rules and reserved names, rendering/validation, debounce/races,
suggestion selection, duplicate submits, timeouts, unavailable/malformed backend
responses, generic errors, mocked confirmation and uniqueness conflicts, isolated
client settings, and blocked real-service operation with no network or mutation.
They do **not** prove database atomicity, real uniqueness, RLS, real Auth signup,
email delivery, rate limiting, or provider confirmation settings.

## Real ClickUp recording prerequisites and walkthrough

This recording is **blocked until the approved registry integration is deployed
and tested in development**. Do not present mocked UI results as real DB evidence.

1. Approve the username ownership/routing/policy decisions. Implement and separately
   authorize the proposed migrations, lookup transport, RLS, transaction tests,
   confirmation flow and rate limits on the independently verified development
   target. Resolve pending-account retention and existing-account behavior.
2. Have an authorized operator prepare a dedicated test account that already owns
   a known synthetic username. Review permission to create additional development
   test accounts and confirm the project email/password and confirmation settings.
3. Enable the real integration through a reviewed rollout, verify public dev
   configuration, and run `npm run dev:frontend`. Start recording `/signup` without
   capturing passwords, keys, token links, or real customer information.
4. Type the known taken username. Show the debounced authoritative **taken** result
   and suggestions, including the notice that suggestions are unverified.
5. Select a suggestion. Show **checking**, then its authoritative result. If it is
   taken, select/check another; do not assume any particular suggestion is free.
6. Optionally type a reserved name such as `admin` and show immediate local rejection.
7. With approved test-account creation permission, fill the remaining fields and
   submit an available name once. Show the generic email-confirmation instruction.
   Verify no automatic authenticated dashboard navigation occurred.
8. Confirm through the approved development email flow, then sign in normally.
   Record the tested commit, environment and recording link without credentials.

No real account or recording was created in this task. The ClickUp task cannot be
marked complete solely from this UI: authoritative uniqueness and recording proof
remain external acceptance requirements.

## Stacked branch review and pull request base

This signup branch is based on Auth commit
`4bfd2212c5bd855c3735fb98371e602b3f1078cf`, verified against
`origin/feature/module-1-auth-session` during final review.

When a supervisor is ready to open a pull request, select base
`feature/module-1-auth-session` and compare
`feature/module-1-signup-username`. Use the
[signup-only GitHub comparison](https://github.com/Sugeerthan/Project-Management/compare/feature/module-1-auth-session...feature/module-1-signup-username).
No pull request is created by this implementation task.

Before opening it, fetch the parent and inspect the signup-only diff:

```sh
git fetch origin feature/module-1-auth-session
git diff origin/feature/module-1-auth-session...HEAD
```

Do not target `main` while the Auth implementation is unmerged: that comparison
would include inherited Auth changes. If the parent moves or merges, review the
stack and update the intended base deliberately before opening or retargeting the
pull request. Preserve the separate database and Module 2 worktrees.
