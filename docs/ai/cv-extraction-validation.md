# Validating Gemini CV output

The [v1 specification](cv-extraction-schema-v1.md) defines a private extraction DTO.
The shared package is independent of database, backend, frontend, and AI code.
Backend and frontend declare `@nexus/shared` as a workspace dependency; a future
AI service package should declare the same dependency rather than copy the schema.
No Gemini SDK, network integration, or persistence is implemented here.

## Build and import

Run `npm ci` from the root after the lockfile is committed, then `npm run build:shared`.
The package exports ESM JavaScript and declarations from ignored `shared/dist/`.
Root typecheck, extraction tests, and frontend build prepare shared output first.
Do not commit generated dist files or introduce separate workspace lockfiles.

```ts
import {
  CV_EXTRACTION_CONTRACT_VERSION,
  parseCvExtractionJson,
  type CvExtraction,
} from "@nexus/shared/cv-extraction/v1";

// rawText is unknown model text, not a trusted object or a TypeScript cast.
function validateExtraction(rawText: unknown): CvExtraction | null {
  const result = parseCvExtractionJson(rawText);
  if (!result.success) {
    // Record only code/issueCount plus an internal job ID. Never raw CV content.
    return null;
  }
  // Keep this version in server-owned job metadata, outside the six-field JSON.
  void CV_EXTRACTION_CONTRACT_VERSION;
  return result.data;
}
```

The backend validator module re-exports the same contract for existing service
boundaries. For an already parsed HTTP request body, accept `unknown` and use
`cvExtractionSchema.safeParse(body)` after enforcing HTTP body-size limits. Do not
use `as CvExtraction` to bypass validation. Do not stringify an untrusted arbitrary
object just to invoke the text parser.

## Processing sequence

1. Authenticate the caller, authorize the uploaded private CV, enforce file/response
   limits and timeouts, and select v1 in server-owned metadata.
2. Supply the [extraction instructions](../../ai/cv-extraction/prompts/extraction-v1.md)
   with the contract. Request JSON output using the eventual provider integration.
   Check completion/truncation/refusal status before accepting text.
3. Call `parseCvExtractionJson` on the complete text. It checks runtime input type,
   UTF-8 size, JSON syntax, then Zod shape validation. It does not strip fences,
   coerce, fill defaults, or repair data. Error codes are `invalid_input`,
   `oversized_json`, `invalid_json`, and `invalid_shape`; no raw values are returned.
4. On failure, stop persistence and presentation as accepted data. Store only a
   sanitized failure category/count and internal correlation ID. Route to a bounded
   retry or manual correction process; never silently continue with partial output.
   Do not log Zod's complete error object, the prompt, raw CV, or contact fields.
5. On success, retain private source provenance and require customer review for
   factual correctness. Map only approved fields into a separately designed
   persistence contract. Never accept owner IDs, roles, or approval state from AI.
6. Revalidate customer edits and separately authorize publication. Construct an
   allowlisted published portfolio DTO, with explicit contact disclosure choices.
   Render text safely and vet links; never treat output as trusted HTML or fetch
   supplied URLs automatically. HTTP(S) validation does not prevent SSRF.

No retry loop, source storage, approval workflow, or public DTO is implemented by
this module. Duplicate JSON keys are forbidden by instructions but native
`JSON.parse` keeps the last occurrence; this parser does not detect duplicates.
Direct calls to `safeParse` can produce detailed error objects containing field
names; treat diagnostics as sensitive. Structural validation cannot verify that
Gemini did not invent a fact. Tests deliberately demonstrate this limitation.

## Verification commands

From the root:

```sh
npm run test:cv
npm run typecheck
npm run lint
npm run build:frontend
```

`test:cv` builds shared code and runs Node's built-in tests, including JSON fixtures,
strict shapes, date precision/calendar validity, bounds, raw JSON handling, and
extraction-rule presence. It uses no external services. The inherited root
`npm test` still invokes unconfigured frontend/backend Vitest scripts; those suites
are outside this task. Use the explicit contract test command above.

Task A proof after commit: link to `docs/ai/cv-extraction-schema-v1.md` or the valid
JSON fixture at the reviewed commit. Task B proof: link to the shared schema and
record `test:cv` results for that commit. Use links pinned to the reviewed commit
so the evidence identifies the exact contract and validator that were tested.
