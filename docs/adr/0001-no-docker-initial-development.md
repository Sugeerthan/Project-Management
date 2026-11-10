# ADR 0001: Defer Docker during initial development

- **Status:** Proposed
- **Date:** 2026-11-10

## Project context

The repository contains a runnable Next.js frontend and npm workspaces for
`frontend` and `backend`. Developers currently run Node.js/npm locally. The target
architecture uses managed Supabase PostgreSQL, Auth, and Storage, the Gemini API,
and Vercel deployment. Supabase and Gemini integration and backend services remain
planned rather than implemented.

Confirmed repository evidence:

- Root npm scripts install dependencies and run frontend development, checks, and
  builds without containers.
- No Dockerfile, Docker Compose configuration, devcontainer configuration, or
  container-specific workflow was found. The
  [PR checks workflow](../../.github/workflows/pr-checks.yml) runs npm-based checks.
- [Technical decisions](../research/technical-decisions.md) and the
  [deployment strategy](../deployment/deployment-strategy.md) identify the target
  stack, but do not record approval of a no-Docker decision.
- The generic mention of Docker assets in the
  [infrastructure README](../../infrastructure/README.md) describes a reserved
  responsibility, not an existing container implementation.

This proposal assumes the initial implementation can continue using managed
services and Vercel without a custom operating-system image or persistent worker.
Live service configuration is outside the evidence provided by repository files.
The ADR remains Proposed pending team review and approval.

## Decision

Do not introduce Docker as a prerequisite for initial application development,
CI checks, or Vercel deployment. Use Node.js/npm locally, managed Supabase as the
intended backend, and Vercel for hosting. Access Gemini through a future server-side
integration. Revisit this decision when concrete runtime or operational needs
justify containers; it does not rule out Docker for future deployments or optional
local tooling.

## Rationale

The current frontend builds with the existing npm workflow. Containerizing it now
would add image maintenance, volume/network setup, and another development path
without an identified application requirement. Managed Supabase and Vercel are
intended to provide backend and hosting infrastructure during the initial phase.
This rationale supports deferral, not a claim that containers offer no value.

## Benefits

- Fewer tools and setup steps for initial contributors.
- One npm-workspace workflow for development and build verification.
- No project-owned container images or container registry to maintain initially.
- More time available for authentication, CV extraction, validation, and portfolios.

## Tradeoffs and limitations

- Developer and CI operating systems and native dependencies can differ.
- The lockfile fixes dependency resolution, but does not fully reproduce the OS or
  runtime; Node.js is not currently pinned in repository configuration.
- Managed services introduce network, credential, quota, and provider dependencies.
- Fully offline backend development and production-equivalent local infrastructure
  are not provided by the current scaffold.
- Future native tooling or workloads outside Vercel's runtime constraints may need
  a different execution environment.

## Consequences for local development

Use a compatible Node.js/npm installation, run `npm ci` from the repository root,
then `npm run dev:frontend`. Follow the [root README](../../README.md) for versions,
commands, and environment setup. Docker is not required for the current scaffold.
When integrations are added, use authorized development services and ignored local
environment files; never commit credentials or customer CVs.

If the team later chooses Supabase CLI's local container-backed stack, assess that
as a separate tooling decision rather than treating it as part of today's setup.

## Consequences for CI/CD and deployment

Continue using the npm-workspace build with Vercel Root Directory `frontend` and
the Next.js framework preset. This proposal adds no image-build, registry, or
container-deployment step and does not alter service settings.

The GitHub Actions PR workflow runs npm-based lint, typecheck, and build checks
without project container images. Future workflows should use the same approach
unless their requirements justify another execution environment.
Local build success does not verify a deployment; verify the exact commit and
environment in GitHub/Vercel. Portfolio publishing orchestration is still planned.

## When to reconsider Docker

- Repeated OS or native-dependency differences prevent reliable development or CI.
- Offline or isolated integration testing requires a reproducible local backend.
- CV conversion, OCR, or other native utilities need a controlled system image.
- Long-running extraction jobs, queues, or workers exceed the selected host's limits.
- Self-hosting, a new deployment provider, compliance, or isolation requirements
  require container packaging.
- Team onboarding or operational evidence shows containers would reduce complexity.

Evaluate the affected components and costs before introducing containers; a future
decision may containerize selected services rather than the entire monorepo.
