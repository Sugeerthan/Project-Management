# Shared Contracts

Cross-boundary contracts only: domain types, Zod schemas, constants, and pure utilities. This folder must not depend on frontend, backend, or AI code.

`@nexus/shared` is a private ESM npm workspace. Its versioned
`@nexus/shared/cv-extraction/v1` export provides the extraction Zod schema, inferred
types, and a bounded JSON parser. See the [specification](../docs/ai/cv-extraction-schema-v1.md)
and [integration guide](../docs/ai/cv-extraction-validation.md).

Run `npm run build:shared` before consuming compiled exports. From the root,
`npm run test:cv`, `npm run typecheck`, and `npm run lint` verify the contract.
No generated `dist/` files belong in Git. Node's built-in test runner needs no
Vitest setup; production code has only Zod as a runtime dependency.
