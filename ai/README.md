# AI / CV Extraction

Gemini-powered multimodal CV extraction. The pipeline keeps prompts, raw extractors, mapping, and Zod validation separate so extraction is testable and auditable. Do not commit customer CVs; use only anonymized fixtures in `test-data/sample-cvs/`.

The [v1 contract](../docs/ai/cv-extraction-schema-v1.md) is implemented in the
independent shared workspace. [Prompt instructions](cv-extraction/prompts/extraction-v1.md)
and entirely synthetic `test-data/cv-extraction/v1/` fixtures describe the expected
output. These fixtures contain no real customer information. Future AI service
packages must declare `@nexus/shared` as a dependency and validate output before use.
