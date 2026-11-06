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

- `src/app/` contains route groups for authentication, customer journeys, administration, and public portfolios.
- `src/features/` contains feature-specific UI and client logic.
- `src/themes/` contains the five portfolio renderers.
- `src/components/` is reserved for reusable, feature-neutral UI.

The homepage is a responsive scaffold; portfolio creation is not implemented.
The inherited `test` scripts reference Vitest, which is not yet installed or configured.
Test-suite setup is separate from this scaffold task.
