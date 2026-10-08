# Automated Portfolio Management & Generation Platform

Nexus Solutions' SaaS platform for converting a customer CV into a reviewed,
theme-based, publishable professional portfolio.

## Repository map

| Area | Responsibility |
| --- | --- |
| `frontend/` | Next.js customer, administrator, and published-portfolio experiences |
| `backend/` | API routes, business services, authorization, storage, and deployment orchestration |
| `database/` | Supabase migrations, schema design, seed data, and PostgreSQL RLS policies |
| `ai/` | Gemini integration and the CV extraction/validation pipeline |
| `shared/` | Cross-boundary TypeScript types, Zod schemas, constants, and utilities |
| `testing/` | Unit, integration, API, and Cypress end-to-end testing assets |
| `docs/` | Architecture, research, database, API, AI, and deployment records |
| `infrastructure/` | Vercel, GitHub Actions, and Docker configuration |

## System flow

`Customer → Frontend → Backend/API → Supabase Storage → Gemini extraction → Zod validation → PostgreSQL → customer review → theme engine → preview → approval → deployment → published portfolio`

The five supported portfolio themes are Terminal/Tech Specialist, Corporate Executive & Director, Modern UI/UX & Product Designer, Academic & Research Scholar, and Freelance Consultant & Agency.

## Working convention

Top-level folders are organized by system responsibility. Within each area, folders are organized by feature or module. See each area's README before adding a new module.

