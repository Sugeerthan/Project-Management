# Nexus Portfolio Management

Nexus Solutions' Automated Portfolio Management & Generation Platform is designed
to turn an uploaded CV into a reviewed, theme-based professional portfolio website.
The planned workflow uses Gemini AI to extract structured information, lets the
customer review and edit it, and generates a portfolio for preview and publication.

## Current implementation status

The repository currently contains the Module 0 development foundation.

| Implemented                                                        | Planned                                                      |
| ------------------------------------------------------------------ | ------------------------------------------------------------ |
| Next.js App Router frontend with a responsive placeholder homepage | CV upload and Supabase Storage integration                   |
| React, strict TypeScript, Tailwind CSS, and PostCSS configuration  | Supabase Auth, PostgreSQL persistence, and RLS policies      |
| npm workspaces and a shared root lockfile                          | Gemini extraction and shared Zod validation                  |
| ESLint, Prettier, Husky, lint-staged, and a GitHub PR template     | Customer review/editing, administration, and theme rendering |
| Environment placeholders and cross-platform line-ending policy     | Portfolio preview, approval, and publishing orchestration    |

Supabase and Gemini are **not integrated yet**. Authentication routes, backend
services, database migrations, and AI modules are placeholders; the homepage does
not upload CVs or generate portfolios. The GitHub Actions workflow validates pull
requests; it does not deploy the application.

## Technology stack

- **Implemented:** Next.js 16.4.5, React 19.3.1, TypeScript, and Tailwind CSS 3.4.19.
- **Planned integrations:** Supabase PostgreSQL, Auth, and Storage; Google Gemini API;
  Zod for boundary and AI-output validation.
- **Deployment and automation:** Vercel for the frontend; GitHub Actions validates
  pull requests targeting `main`. Hosted CI results, deployment status, and
  environment scopes are verified externally.

## Architecture and repository structure

The intended system flow is:

```text
Customer CV upload -> Frontend -> Backend/API -> Supabase Storage
  -> Gemini extraction -> Zod validation -> PostgreSQL
  -> Customer review/editing -> Theme engine -> Preview -> Approval
  -> Deployment -> Published portfolio
```

The root project is a private npm monorepo with two workspaces: `frontend` and
`backend`. Other top-level folders define architectural boundaries rather than
separate npm packages.

| Area                                          | Responsibility and current state                                                             |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [`frontend/`](frontend/README.md)             | Runnable Next.js scaffold; customer, administrator, and public-portfolio routes are reserved |
| [`backend/`](backend/README.md)               | API, authorization, storage, and deployment-service placeholders; no runnable server yet     |
| [`database/`](database/README.md)             | Supabase migration, seed, schema, and RLS scaffolding                                        |
| [`ai/`](ai/README.md)                         | Planned Gemini extraction, mapping, prompts, and validation pipeline                         |
| [`shared/`](shared/README.md)                 | Reserved for cross-boundary TypeScript types, Zod schemas, constants, and utilities          |
| [`testing/`](testing/README.md)               | Planned unit, integration, API, and Cypress end-to-end testing areas                         |
| `docs/`                                       | Architecture, research, database, API, AI, deployment, and development records               |
| [`infrastructure/`](infrastructure/README.md) | Reserved for deployment and automation configuration                                         |
| [`scripts/`](scripts/README.md)               | Reserved for repository automation                                                           |
| `.github/`                                    | Pull request template and PR lint, typecheck, and build workflow                             |

The five planned portfolio themes are Terminal/Tech Specialist, Corporate
Executive & Director, Modern UI/UX & Product Designer, Academic & Research Scholar,
and Freelance Consultant & Agency. Their renderers are not implemented.

Top-level folders are organized by responsibility; each area is organized by
feature or module. Read the area's README before adding a module.

## Prerequisites

- Git and Node.js with npm. The full toolchain has been verified with Node.js
  **22.14.0** and npm **11.3.0**; use a compatible Node.js 22.x version.
- Run dependency installation from the repository root using the committed
  `package-lock.json`. Do not create a separate frontend lockfile.

The repository does not currently pin a Node.js version through `engines` or a
version-manager file. Supabase and Gemini credentials are not needed to run the
current placeholder homepage.

## Local development

```sh
git clone https://github.com/Sugeerthan/Project-Management.git
cd Project-Management
npm ci
npm run dev:frontend
```

Open [http://localhost:3000](http://localhost:3000). Stop the server with `Ctrl+C`.
The root command delegates to the `frontend` workspace; there is no root `dev`
script or backend development command yet.

To test the production server locally:

```sh
npm run build:frontend
npm --workspace frontend run start
```

This serves the built frontend locally and does not deploy it.

## Environment setup

Use [`.env.example`](.env.example) as the variable-name reference. When integrations
are introduced, create an ignored `frontend/.env.local` with the required values
for local Next.js development. A root `.env.local` is not the frontend app's
environment file. Keep privileged backend credentials in the server environment
that needs them.

| Variable                               | Visibility and purpose                                                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Public Supabase project URL                                                                                                 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe publishable key; data access must be protected by Auth and RLS                                                 |
| `GEMINI_API_KEY`                       | Server-only key for the planned extraction service                                                                          |
| `SUPABASE_SERVICE_ROLE_KEY`            | Retained server-only placeholder for future privileged backend operations; ordinary user authentication does not require it |

These variables are not consumed by the scaffold yet. Never commit real keys,
passwords, customer CVs, or personal information. Do not prefix Gemini or privileged
Supabase keys with `NEXT_PUBLIC_`, expose them in client code, or log them.

Vercel Preview configuration is intended to target `nexus-portfolio-dev`. Confirm
the project association and environment scope in the dashboard without copying
secret values into GitHub issues or documentation. Supabase Auth redirect settings
and storage/RLS policies will need configuration when those features are added.

## Available commands

Run these from the repository root unless stated otherwise.

| Command                              | Purpose                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `npm ci`                             | Install locked workspace dependencies; initialize local hooks through `prepare`                  |
| `npm run dev:frontend`               | Start the Next.js development server                                                             |
| `npm run build:frontend`             | Create the frontend production build                                                             |
| `npm --workspace frontend run start` | Serve an existing frontend production build                                                      |
| `npm run lint`                       | Run frontend ESLint                                                                              |
| `npm run typecheck`                  | Run frontend TypeScript checks                                                                   |
| `npx prettier --check README.md`     | Check formatting for a selected file                                                             |
| `npx prettier --write path/to/file`  | Format selected files                                                                            |
| `npm run format:check`               | Check formatting across the repository                                                           |
| `npm run format`                     | Format the entire repository; avoid this for unrelated changes                                   |
| `npm run lint:staged`                | Validate staged files with lint-staged                                                           |
| `npm run prepare`                    | Initialize local Husky hooks when applicable                                                     |
| `npm test`                           | Invoke inherited workspace Vitest scripts; currently unavailable until test setup is implemented |

Husky initialization is skipped in CI, Vercel, production, with `HUSKY=0`, or when
Husky is not installed. Normal development installs retain the pre-commit hook.

## Testing and verification

The [PR checks workflow](.github/workflows/pr-checks.yml) runs `npm ci`, ESLint,
TypeScript checks, and the frontend production build on Ubuntu with Node.js 22 for
pull requests targeting `main`. It uses read-only repository permissions and no
application secrets. It validates code only; Vercel handles deployment separately.
A local run does not establish that GitHub-hosted CI has passed.

For a typical frontend change, run:

```sh
npm run lint
npm run typecheck
npx prettier --check path/to/changed-file
npm run build:frontend
```

Lint and typecheck currently cover the frontend. No automated test suite is
configured: the frontend and backend `test` scripts reference Vitest, which is not
installed. `--if-present` in the root test command does not make these scripts pass.
Unit, integration, API, and end-to-end tests remain planned.

The repository has **27 pre-existing formatting issues** outside this README
update. The broad formatting check therefore fails; check changed files
and avoid a repository-wide formatting sweep in unrelated PRs. This count will
change as formatting cleanup is completed.

## Git workflow

1. Start from a clean, synchronized `main` and create a focused feature, fix, or
   documentation branch.
2. Keep changes scoped and run the relevant checks above.
3. Stage intended files. The pre-commit hook runs frontend ESLint on relevant
   staged code and Prettier verification on supported staged files.
4. Open a pull request into `main` using the
   [PR template](.github/pull_request_template.md), include the ClickUp task link or
   ID, and record test results and applicable security/deployment impacts.
5. Review the exact commit's Vercel Preview check before requesting approval.

The [Git attributes policy](.gitattributes) keeps text checkouts at LF, matching
Prettier even with Windows `core.autocrlf=true`. Windows command and PowerShell
scripts have CRLF exceptions; Husky files use LF. See the
[development-tooling guide](docs/development-tooling.md) for hook behavior.

## Deployment overview

The intended Vercel project is `project-management-frontend`, connected to
`Sugeerthan/Project-Management`, with Root Directory **`frontend`**, framework
**Next.js**, and default install, build, and output settings. The root workspace
lockfile is shared; `npm run build` inside `frontend/` runs `next build`.

With the Git integration enabled, feature-branch pushes are expected to create
Preview deployments and changes to the configured production branch (`main`) are
expected to deploy Production. Verify the environment, commit SHA, Ready status,
and Preview URL in the PR's Vercel check or dashboard. A local build does not prove
that deployment succeeded. No GitHub Actions secrets are required by the PR checks
workflow; Vercel environment values and integration settings live outside
this repository.

There are no implemented migrations or portfolio-publishing services to run yet.
The deployment architecture documents describe the target design, not completed
backend automation.

## Further documentation

- [System architecture](docs/architecture/system-architecture.md),
  [data flow](docs/architecture/data-flow.md), and
  [component responsibilities](docs/architecture/component-responsibilities.md)
- [Technical decisions](docs/research/technical-decisions.md)
- [ADR 0001: Defer Docker during initial development (Proposed)](docs/adr/0001-no-docker-initial-development.md)
- [Database design](docs/database/database-design.md) and
  [relationships](docs/database/relationships.md)
- [API overview](docs/api/api-overview.md) and [CV extraction](docs/ai/cv-extraction.md)
- [Deployment strategy](docs/deployment/deployment-strategy.md)
- [Frontend guide](frontend/README.md) and
  [development tooling](docs/development-tooling.md)

Some design documents describe planned components; use the implementation status
above and actual source files to distinguish scaffolding from working features.
