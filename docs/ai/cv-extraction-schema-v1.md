# CV extraction contract v1

Version: **1.0.0**. This is the Module 2 extraction contract proposed for team
review, not an approved database schema or published portfolio representation.

Task A requires precisely `personalInfo`, `experience[]`, `education[]`, `skills[]`,
`projects[]`, and `socialLinks[]`. The [database design](../database/database-design.md)
supports the core CV domains; the [data flow](../architecture/data-flow.md) requires
validation before persistence and customer review before publication. Nested
fields and limits below are engineering choices for this contract, not claims of
an approved ERD. Social links are included because Task A explicitly requires them.

## Authoritative implementation and examples

- [Zod schema and inferred TypeScript types](../../shared/src/cv-extraction/v1.ts)
- [Valid synthetic JSON](../../ai/test-data/cv-extraction/v1/valid.json)
- [Synthetic source CV](../../ai/test-data/cv-extraction/v1/source.txt)
- [Minimal JSON](../../ai/test-data/cv-extraction/v1/minimal.json)
- [Invalid JSON fixture](../../ai/test-data/cv-extraction/v1/invalid.json)
- [Gemini instructions](../../ai/cv-extraction/prompts/extraction-v1.md)
- [Backend validation guide](cv-extraction-validation.md)

The invalid fixture is syntactically valid JSON but deliberately fails structural,
scalar, date, and unknown-property validation. Malformed JSON is tested separately.
All fixtures are synthetic. The source text permits manual provenance review;
fixture tests do not establish that any Gemini model will extract it correctly.

## Shared conventions

Every listed root and nested property is **required**. Unknown scalar details use
JSON `null` where the type permits it; they are not omitted or replaced with empty
strings, `"unknown"`, or fabricated placeholders. Missing sections and nested lists
use `[]`, never `null`. A skill requires its stated name. A social entry requires
at least a URL or a username. Omit unsupported section entries rather than create
an all-null entry. The schema does not infer whether a record was present in the CV.

All objects are strict: unknown keys, including IDs, confidence, database status,
version, and approval flags, are rejected rather than stripped. No coercion,
default filling, whitespace trimming, or Markdown extraction occurs. Text must
contain a non-whitespace character; surrounding whitespace is preserved except
URLs, where any whitespace is rejected. Strings use the installed Zod string
length semantics. Ordinary text is not interpreted as HTML or instructions.

`Text(N)` means nonempty non-whitespace text of at most N characters. `Date` means
a real calendar date string in exactly `YYYY`, `YYYY-MM`, or `YYYY-MM-DD` format,
years 0001–9999. February/leap years are validated. Do not invent missing month/day
components. No timestamps, ranges, localized numeric dates, or `Present` strings.
Ambiguous/unreadable dates become `null`; the source remains available for review.
Future dates are permitted when explicitly stated, such as planned graduation.
Clearly reversed date intervals fail; overlapping precision intervals are accepted
without completing their missing components.

`WebURL` means an absolute HTTP(S) URL, at most 2048 characters, with a hostname
and no whitespace or embedded credentials. Relative paths, bare domains, script,
file, and mailto schemes fail. This is syntax validation, not a safe-fetch or
domain-trust check. `Email` uses Zod email syntax and a 254-character limit; an
unsupported spelling needs review, not silent correction. Phone numbers remain
source text, at most 100 characters; do not infer country codes.

## Root object

| Field        | Type                | Maximum entries | Meaning                                                |
| ------------ | ------------------- | --------------- | ------------------------------------------------------ |
| personalInfo | PersonalInfo object | N/A             | Private personal/contact data                          |
| experience   | Experience[]        | 100             | Stated work history, in source order                   |
| education    | Education[]         | 50              | Stated qualifications/education                        |
| skills       | Skill[]             | 200             | Explicitly stated skills, not inferred from job titles |
| projects     | Project[]           | 100             | Explicitly described projects                          |
| socialLinks  | SocialLink[]        | 50              | Stated social URLs or handles                          |

## PersonalInfo

| Field    | Type               | Meaning                                             |
| -------- | ------------------ | --------------------------------------------------- |
| fullName | Text(200) or null  | Name as stated, not an Auth identity                |
| headline | Text(200) or null  | Explicit professional headline; do not generate one |
| summary  | Text(6000) or null | Existing CV summary, not generated marketing prose  |
| email    | Email or null      | Private contact email                               |
| phone    | Text(100) or null  | Private phone text with source formatting           |
| location | Text(300) or null  | Location as stated; no inferred address             |
| website  | WebURL or null     | Explicit personal website                           |

## Experience

| Field       | Type                 | Meaning                                                                                          |
| ----------- | -------------------- | ------------------------------------------------------------------------------------------------ |
| company     | Text(200) or null    | Stated employer                                                                                  |
| role        | Text(200) or null    | Stated role/title                                                                                |
| location    | Text(300) or null    | Work location if given                                                                           |
| startDate   | Date or null         | Start date at original precision                                                                 |
| endDate     | Date or null         | End date, or null if unknown/current                                                             |
| isCurrent   | boolean or null      | true only for explicit current/Present wording; false for explicitly ended work; null if unknown |
| description | Text(4000) or null   | Stated work description                                                                          |
| highlights  | Text(1000)[]; max 50 | Source achievements; never invent metrics                                                        |

`isCurrent: true` requires `endDate: null`. A null end date alone does not imply
current employment. No total years of experience are calculated or guessed.

## Education

| Field         | Type               | Meaning                                                       |
| ------------- | ------------------ | ------------------------------------------------------------- |
| institution   | Text(200) or null  | Institution as stated                                         |
| qualification | Text(200) or null  | Qualification title; no degree-equivalence inference          |
| fieldOfStudy  | Text(200) or null  | Explicit study discipline                                     |
| startDate     | Date or null       | Start date at original precision                              |
| endDate       | Date or null       | Completion/expected end date if explicitly stated             |
| description   | Text(4000) or null | Source details, including stated expected/in-progress wording |

## Skill

| Field       | Type              | Meaning                                           |
| ----------- | ----------------- | ------------------------------------------------- |
| name        | Text(200)         | Explicit skill name; required and non-null        |
| category    | Text(200) or null | Only a category explicitly present in the CV      |
| proficiency | Text(100) or null | Stated proficiency text; no inferred level/rating |

## Project

| Field        | Type                 | Meaning                                          |
| ------------ | -------------------- | ------------------------------------------------ |
| name         | Text(200) or null    | Project title if provided                        |
| description  | Text(4000) or null   | Stated description                               |
| url          | WebURL or null       | Stated project URL; do not construct it          |
| startDate    | Date or null         | Start date at original precision                 |
| endDate      | Date or null         | End date if known; missing does not imply active |
| technologies | Text(200)[]; max 50  | Explicit technologies for this project           |
| highlights   | Text(1000)[]; max 50 | Explicit accomplishments                         |

## SocialLink

| Field    | Type              | Meaning                                           |
| -------- | ----------------- | ------------------------------------------------- |
| platform | Text(200) or null | Platform explicitly identified by source text/URL |
| url      | WebURL or null    | Full URL as stated                                |
| username | Text(200) or null | Handle as stated, including prefix if present     |

At least one of `url` and `username` must be non-null. Preserve handle-only entries
without constructing a URL or guessing a platform. These handles are unrelated to
the application's proposed public portfolio URL identifier.

## Versioning, limits, and trust

Consumers import `@nexus/shared/cv-extraction/v1`. TypeScript types are inferred
from Zod; no duplicate handwritten DTO or database type is authoritative.
`CV_EXTRACTION_CONTRACT_VERSION` is `1.0.0`. The payload has no version property:
select the contract through application/job metadata outside the Gemini JSON.
Changes to required keys, null semantics, limits, or accepted values require an
explicit compatibility review and a new major contract when breaking. Retain old
validators for already-stored extraction records if needed.

`parseCvExtractionJson` rejects model text above 1,048,576 UTF-8 bytes before JSON
parsing. Direct `cvExtractionSchema.safeParse` enforces per-field/array limits but
does not impose this raw transport bound. The future upload/model client must also
limit response streaming and CV file size before allocating the full response.
Oversized output must fail visibly; do not silently truncate a career history.

Structural validity is not factual accuracy, qualification verification, absence
of prompt injection, safe HTML, approved contact disclosure, or publication consent.
Require source-grounded review after validation. Keep email, phone, addresses, and
other personal details private unless the customer explicitly approves disclosure.
Use a separately designed allowlisted publication DTO; never publish this object
wholesale or use it as a database insert payload.

The implementation uses the pinned Zod API described in the
[official Zod documentation](https://zod.dev/api), including strict objects,
nullable fields, refinements, and inferred types. No Gemini API calls are part of
this contract work; provider-specific structured-output schema adaptation is a
future integration task and must retain local Zod validation.
