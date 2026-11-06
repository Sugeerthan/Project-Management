# Local code quality checks

Run commands from the repository root after `npm ci`. Husky is activated by the
root `prepare` script. Use Node.js 20.19 or newer (Node.js 22.14 was verified).
The frontend's existing Next.js ESLint flat config and TypeScript rules remain unchanged.
ESLint currently covers frontend code; backend code receives formatting checks only.

| Command                             | Purpose                                        |
| ----------------------------------- | ---------------------------------------------- |
| `npm run lint`                      | Frontend ESLint                                |
| `npm run typecheck`                 | Frontend TypeScript                            |
| `npm run format`                    | Format the repository (broad, explicit opt-in) |
| `npx prettier --write path/to/file` | Format selected files                          |
| `npm run format:check`              | Check formatting across the repository         |
| `npx prettier --check path/to/file` | Check only selected files                      |
| `npm run lint:staged`               | Validate staged files using lint-staged        |
| `npm run prepare`                   | Reinstall local Husky hooks                    |
| `npm run build:frontend`            | Frontend production build                      |

The pre-commit hook runs from the repository root. It checks staged frontend
JavaScript/TypeScript with the existing frontend ESLint configuration, and checks
formatting for staged JS, TS, TSX, JSON, Markdown, CSS, SCSS, and YAML files.
Generated Next.js declarations, dependency folders, builds, lockfiles, environment
files, and generated agent instructions are excluded from formatting checks.
Checks do not automatically rewrite files. Fix reported formatting explicitly and
stage the intended changes again. lint-staged normally backs up and temporarily
hides partially staged changes so checks see the staged version of a file.

Existing files have not been mass-formatted. The project-wide formatting command
can therefore report inherited formatting differences; format only the files you
intend to include in a change. Do not run the broad write command just to satisfy
an unrelated task.

Full builds and TypeScript checks remain manual commands to keep commits fast.
No test suite is added by this tooling setup. Existing Vitest scripts remain a
separate, unconfigured scaffold item.
