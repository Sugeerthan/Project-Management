# Login, logout, and session handling

Module 1 implements `/login`, `/dashboard`, and cookie-based Supabase Auth using
Next.js 16 `proxy.ts`. It does not query profiles or depend on database migrations.
Registration, username checks, portfolio operations, and OAuth callbacks are outside scope.

## Configuration and prerequisites

Use Node.js 22.14 or newer compatible Node 22.x (the test runner requires at least
22.12). Install from the repository root with `npm ci`. Configure only these public
values in an ignored `frontend/.env.local`, using the independently verified
**nexus-portfolio-dev** project:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=<development project HTTPS origin>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<development sb_publishable_ key>
```

Replace the placeholders; do not commit the file. The configuration validator
accepts HTTPS origins (or HTTP loopback for local Supabase), no credentials,
paths, query strings, or fragments, and modern `sb_publishable_` keys. Legacy
anon JWT keys and secret/service-role keys are intentionally not accepted.
Validation checks syntax, not whether the configured project is development;
the operator must independently verify the project before using real accounts.

Next.js inlines `NEXT_PUBLIC_` values into browser code at build time. Configure
them before starting development or building a configured test application;
restart/rebuild when they change. A missing/invalid configuration does not throw
at import time or prevent builds or public `/` rendering. `/login` displays a
safe unavailable state, and `/dashboard` fails closed by redirecting to login.
No key values, tokens, passwords, or upstream error details are rendered or logged.

Real testing requires a dedicated existing **email-verified development account**.
The supplied project context says email/password and confirmation are enabled and
anonymous sign-in is disabled; those dashboard settings have not been inspected
or changed by this implementation. Do not use production accounts or credentials.
Creating accounts and changing Auth settings are separate tasks.

The supplied development redirect allowlist is `http://localhost:3000/**` and
`https://project-management-frontend-teal.vercel.app/**`. Password login here does
not implement an email/OAuth callback flow or alter that allowlist. Verify email
through the existing approved development process before recording.

## Implementation boundaries

| File / area                                       | Responsibility                                                              |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| `frontend/src/lib/supabase/config.ts`             | Lazy public configuration validation                                        |
| `frontend/src/lib/supabase/browser.ts`            | Reusable SSR browser client with SDK cookie persistence                     |
| `frontend/src/lib/supabase/server.ts`             | Fresh request-scoped server client using async `cookies()`                  |
| `frontend/src/lib/supabase/proxy.ts`              | Cookie refresh, verified claims, auth redirects, no-store responses         |
| `frontend/src/proxy.ts`                           | Next.js 16 entry point and explicit login/dashboard matcher                 |
| `frontend/src/features/auth/server.ts`            | Independent server authorization using fresh Auth `getUser()`               |
| `frontend/src/features/auth/login-form.tsx`       | Accessible login, validation, pending state, duplicate lock, generic errors |
| `frontend/src/features/auth/logout-button.tsx`    | Local-session sign-out with safe retry behavior                             |
| `frontend/src/features/auth/session-boundary.tsx` | UI privacy on history restoration, focus, and cross-tab logout              |
| `frontend/src/app/(auth)/login/page.tsx`          | Dynamic login page and authenticated-user redirect                          |
| `frontend/src/app/(customer)/dashboard/page.tsx`  | Authorized welcome/email/logout page without database queries               |

The implementation follows the official
[Supabase Next.js SSR guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs)
and [Next.js proxy convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy).
Pinned packages are `@supabase/ssr` 0.12.7 and `@supabase/supabase-js` 2.119.1.

## Session and route security

The browser client uses the SDK's cookie storage and browser singleton. No custom
localStorage token implementation is added. Cookies use path `/`, SameSite=Lax,
and Secure on HTTPS; they must remain readable by the browser SDK, so they are
not HttpOnly. Protect against XSS and never inject untrusted HTML. No service-role
key is needed or read. Future application tables still require independent RLS.

Proxy runs only for `/login` and `/dashboard/:path*`, leaving public pages and
static assets untouched. It calls `auth.getClaims()` to verify JWTs and refresh
sessions when necessary; an unverified `getSession().user` is never an identity
source. SDK cookie writes update the incoming request for Server Components and
the outgoing response for the browser, including chunked cookies and deletions.
Redirects preserve updated cookies. All matched responses and redirects receive
`Cache-Control: private, no-store, max-age=0, must-revalidate`, plus Pragma/Expires.

Both pages use request-time `connection()`. The dashboard additionally calls
`requireAuthenticatedUser()`, which performs `getUser()` against Supabase Auth and
redirects if identity is missing, invalid, anonymous, or cannot be verified. This
remains effective when proxy is absent/bypassed. It does not authorize future
portfolio data access; each future operation must check its own ownership.

Already authenticated login visitors go to `/dashboard`. Unauthenticated dashboard
visitors go to `/login`; `next` accepts only the exact implemented `/dashboard`
destination. External URLs, protocol-relative paths, encoded alternatives, and
query-bearing destinations cannot select another route.

The login page makes its redirect decision using the fresh `getUser()` check;
proxy refreshes its cookies but never redirects it based on JWT claims alone.
This prevents a redirect loop when claims are still valid but the Auth server
rejects the user or is unavailable. The login form remains reachable in that case.

## Login, logout, and browser history

The form validates email and nonempty password without imposing a new signup
password policy. Password whitespace is preserved. A synchronous ref lock plus a
disabled pending button prevents repeated submissions. Supabase authentication
errors are shown generically, including the reminder to verify a new email.

Successful sign-in performs a full `location.replace('/dashboard')` after the SDK
writes session cookies. Logout uses browser `auth.signOut({ scope: 'local' })` to
end this browser's session, then fully replaces the page with `/login`. It does
not sign out other devices. Full navigation discards the old Next.js router cache.
If sign-out fails, the button becomes retryable and a generic failure is shown;
the application does not falsely report success.

The client session boundary initially withholds private dashboard UI, then verifies
claims. It hides content synchronously on `pagehide`, rechecks on `pageshow` and
focus, and removes it on `SIGNED_OUT` (including SDK cross-tab events). Generation
checks prevent an old verification promise from revealing data after logout or
navigation. A changed account forces a server reload rather than displaying the
previous user's email. These are UI privacy measures, not a replacement for the
server authorization check. Real browser history behavior still needs the manual
recording below; jsdom does not implement the browser back/forward cache.

As with Supabase's documented session model, previously issued access JWTs can
remain cryptographically valid until expiry after sign-out. This feature clears
the normal browser session; it does not promise immediate revocation of a copied
access token. See the [Supabase sign-out reference](https://supabase.com/docs/reference/javascript/auth-signout).

## Automated verification

From the repository root:

```sh
npm run test:auth
npm run lint
npm run typecheck
npm run build:frontend
```

`test:auth` runs frontend Vitest tests for validation, config failure, successful
and failed sign-in, loading/duplicate suppression, logout and failure recovery,
safe redirects, fresh server authorization, cookie refresh/deletion, reload
handling, post-logout denial, and history-event UI hiding. All Supabase clients
are **mocked** in these tests. They do not prove real cookies, tokens, email
verification, SDK cross-tab communication, or remote session refresh behavior.
No real accounts, database rows, or provider settings are created by tests.
The root `npm test` runs both the frontend Auth and shared CV extraction suites.
Backend tests remain unconfigured and are not included.

Check changed Markdown/TypeScript/JSON files with the installed Prettier and run
`git diff --check`. The production build requires no configured Supabase project.
No GitHub Actions or Vercel configuration changes are part of this feature.

## Exact ClickUp recording walkthrough

1. Verify the two public configuration values belong to `nexus-portfolio-dev`,
   and that the dedicated test account already exists and has confirmed its email.
   Keep passwords, keys, token cookies, network payloads, and unrelated personal
   information outside the capture. Use only an approved synthetic test email.
2. Run `npm run dev:frontend` from this worktree. Open a fresh browser profile at
   `http://localhost:3000/login`. Confirm the normal form appears, not the
   unavailable state. Start recording.
3. Enter the verified development account email and password (mask/exclude password
   entry). Click **Sign in** once. Show navigation to `/dashboard`, the welcome
   message, and the approved test email.
4. Refresh `/dashboard` and show that the same account remains signed in. To verify
   actual token refresh separately, wait beyond the configured access-token expiry
   and revisit; do not alter Auth settings just for this recording.
5. Click **Logout**. Show the redirect to `/login` and the empty login form.
6. Type `/dashboard` directly into the address bar. Show the redirect back to login.
7. Use browser Back/Forward to revisit the dashboard history entry. Confirm no
   private dashboard email remains visible and access returns to login. Optionally
   repeat with a second tab to demonstrate logout synchronization.
8. Stop recording and attach the recording link to ClickUp. Record the tested
   commit, browser, date, and development target without including credentials.

No screen recording or real Supabase integration success is claimed by this
implementation. Before commit/PR, review the diff and recorded test results.
The real Auth login/refresh/logout recording remains required acceptance evidence.
