# Frontend

Next.js App Router, React, TypeScript, and Tailwind CSS application in the root npm workspace.
Requires Node.js 20.9 or newer (verified locally with Node.js 22).

## Local commands

Run from the repository root:

```sh
npm ci
npm run dev:frontend
npm --workspace frontend run typecheck
npm --workspace frontend run lint
npm run build:frontend
npm --workspace frontend run start
```

The development and production servers default to http://localhost:3000.
Run the production build before starting the production server.
Tailwind 3 uses `tailwind.config.ts`, `postcss.config.mjs`, and `src/app/globals.css`.

## Environment configuration

The root `.env.example` documents names only; never commit credentials. For local
Next.js development, copy the needed placeholders to `frontend/.env.local`.

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are public
  browser configuration. Data access must be protected with Supabase RLS.
- `GEMINI_API_KEY` is server-only and must never be exposed in client components.
- `SUPABASE_SERVICE_ROLE_KEY` is a retained server-only placeholder for future
  privileged backend operations; ordinary user authentication does not require it.

Vercel Preview configuration is expected to target `nexus-portfolio-dev`.
Supabase and Gemini are not integrated yet, so the scaffold does not consume these
variables. Values and environment scopes must be verified in Vercel settings.

## Preview deployment verification

The repository uses npm workspaces with the lockfile at the root. The intended
Vercel configuration is Root Directory `frontend`, Next.js framework, and default
install/build/output settings. `npm run build` in `frontend/` runs `next build`;
`npm run build:frontend` at the root invokes the same workspace build.

After pushing a commit to PR #1, inspect its Vercel check or deployment status.
Open the details link and confirm the deployment targets Preview, references the
exact new commit SHA and `feature/module-0-setup`, and reaches Ready. Open its
Preview URL to smoke-test the homepage. A successful local build alone does not
verify automatic deployment. No GitHub Actions workflows currently exist, so no
Actions secrets are required by the scaffold; Vercel integration is configured
outside the repository.

- `src/app/` contains route groups for authentication, customer journeys, administration, and public portfolios.
- `src/features/` contains feature-specific UI and client logic.
- `src/themes/` contains the five portfolio renderers.
- `src/components/` is reserved for reusable, feature-neutral UI.

The homepage is a responsive scaffold; portfolio creation is not implemented.
The inherited `test` scripts reference Vitest, which is not yet installed or configured.
Test-suite setup is separate from this scaffold task.
