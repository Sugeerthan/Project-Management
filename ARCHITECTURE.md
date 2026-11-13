# Architecture

See the [system architecture](docs/architecture/system-architecture.md) for the
planned component boundaries.

## Why Docker is not required initially

The target stack uses Vercel for managed application deployment and serverless
hosting, and Supabase for managed PostgreSQL, Auth, and Storage services. These
services handle the deployment and database infrastructure, so Docker is not
required for the initial application development and deployment workflow. Local
application development uses Node.js/npm.

Docker may still be useful later for local Supabase testing or other development
needs that benefit from containers. Reconsider it when a concrete need arises.

The rationale and tradeoffs are recorded in
[ADR 0001: Defer Docker during initial development](docs/adr/0001-no-docker-initial-development.md).
The ADR remains **Proposed**, pending team review and approval.
