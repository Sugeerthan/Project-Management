## Summary of changes

<!-- Describe the problem and resulting behavior. -->

## Related ClickUp task

<!-- Add the ClickUp task link or ID. -->

## Type of change

- [ ] Feature
- [ ] Bug fix
- [ ] Refactor
- [ ] Documentation
- [ ] Configuration

## Implementation details

<!-- Note the approach, key decisions, and any limitations. -->

## Testing performed

<!-- Record commands and results. Mark unrelated checks N/A with a brief reason; do not check unrun tests. -->

- [ ] TypeScript: `npm run typecheck`
- [ ] ESLint: `npm run lint`
- [ ] Formatting: `npx prettier --check <changed-files>`
- [ ] Production build: `npm run build:frontend`
- [ ] Relevant automated or manual tests (describe results):

## Security and privacy considerations

<!-- Mark each unrelated item N/A. Describe relevant risks and safeguards. -->

- [ ] Supabase RLS reviewed and tested when database access changes.
- [ ] Authentication and authorization checked for affected routes and resources.
- [ ] Uploaded CVs and personal information handled safely, including storage, access, and logs.
- [ ] Gemini API keys and Supabase secret/service-role keys remain server-side and out of source, logs, and client bundles.
- [ ] AI output validated with Zod before use or persistence when extraction changes.

## Screenshots or evidence

<!-- Add UI screenshots, test output, or other evidence when useful. Redact personal data and secrets, or mark N/A. -->

## Deployment or migration impact

<!-- Describe impact, or mark N/A. -->

- Environment-variable names added/changed (never include secret values):
- Database migrations, compatibility, and rollback plan:
- Deployment/configuration changes and recovery considerations:

## Reviewer checklist

<!-- Mark unrelated checks N/A with a brief reason. -->

- [ ] Scope matches the linked ClickUp task and preserves existing architecture.
- [ ] Implementation and test evidence reviewed; relevant checks passed or gaps explained.
- [ ] Applicable security, privacy, environment, and migration impacts reviewed.
- [ ] No accidental modifications to production configuration.
- [ ] Documentation updated where needed.
