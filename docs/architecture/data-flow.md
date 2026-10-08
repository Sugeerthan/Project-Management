# Data Flow

1. A customer uploads a CV through the frontend.
2. The backend stores it in Supabase Storage and invokes Gemini extraction.
3. The extraction output is validated with Zod, then persisted to PostgreSQL.
4. The customer reviews the data, chooses a theme, previews, and approves.
5. The deployment service publishes the approved portfolio.

