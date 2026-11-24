# Backend

Node.js/TypeScript API and server-side application logic. Each capability has an API boundary, controller, and service layer; cross-cutting concerns belong in `middleware/`, `validators/`, `config/`, or `utils/`.

The ESM workspace consumes `@nexus/shared/cv-extraction/v1` through
`src/validators/cv-extraction.ts`. Build shared declarations first using
`npm run build:shared` from the root, or run root `npm run typecheck` to prepare
them and check all workspaces. See the [validation guide](../docs/ai/cv-extraction-validation.md).
No API route, Gemini client, or persistence service is implemented by this contract.
