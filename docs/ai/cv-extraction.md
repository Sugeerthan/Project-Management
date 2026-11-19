# CV Extraction

Gemini extracts structured candidate data from uploaded documents. Every result must pass shared Zod validation before persistence or presentation.

Module 2 defines the [v1 JSON contract](cv-extraction-schema-v1.md),
[Gemini instructions](../../ai/cv-extraction/prompts/extraction-v1.md), and
[backend validation guide](cv-extraction-validation.md). The implementation is in
`@nexus/shared/cv-extraction/v1`; it is separate from database and published types.
No Gemini API integration or factual verification is implied by schema validation.
