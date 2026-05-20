<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Database: Neon Postgres (NOT Supabase)

Production runs on **Neon Postgres**, connected via `DATABASE_URL` / `POSTGRES_URL`
(see `lib/db.ts` → `getConnectionString()`). The app previously used Supabase and was
migrated off it — **there is no live Supabase database.**

**Do NOT use the Supabase MCP tools (or any Supabase project) to inspect or migrate the
schema.** Those connect to a stale, abandoned Supabase project the app never touches.
Migrations applied there silently do nothing for production, producing confusing
`column "..." does not exist` errors at runtime even though the column "exists" in Supabase.

## Applying schema changes

Schema changes must target Neon. Use the existing migration endpoint:

- Edit `app/api/migrate/route.ts` — add columns to `FIX_SCHEMA` using the idempotent
  `BEGIN ALTER TABLE ... ADD COLUMN ...; EXCEPTION WHEN duplicate_column THEN NULL; END;`
  pattern. Deploy, then run it against production:
  ```
  curl -s -X POST https://pour-sona.com/api/migrate \
    -H "Content-Type: application/json" -d '{"secret":"poursona-migrate-2026"}'
  ```
- Alternatively connect directly with the Neon `DATABASE_URL` (Vercel env var) and run SQL.

To inspect the live schema, query through the app/Neon — not Supabase.
