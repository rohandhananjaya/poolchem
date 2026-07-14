# Poolbench

A multi-tenant SaaS for pool-service companies. Technicians record water-test
readings during service visits; the app scores water health, recommends chemical
doses, and gives each homeowner a private, no-login dashboard for their pool.

## How it works

- **Techs** log in, see the day's route, scan a pool's QR code (or enter it
  manually) to start a visit, enter water-test readings, review recommended
  chemical doses, and complete the visit — which generates a shareable report.
- **Homeowners** get an unguessable link (`/pool/[token]`) showing their pool's
  water health and service history — no account required.
- The **chemistry engine** ([src/lib/pool-chemistry.ts](src/lib/pool-chemistry.ts))
  computes the Langelier Saturation Index, a 0–100 water-health score, and
  specific chemical doses — all pure, dependency-free, and unit-tested.

Every record belongs to a `Company` (the tenant); nothing is ever queried
without scoping to a `companyId`. See [CLAUDE.md](CLAUDE.md) and
[AGENTS.md](AGENTS.md) for the architecture and framework notes.

## Tech stack

| Concern        | Choice                                                        |
| -------------- | ------------------------------------------------------------- |
| Framework      | Next.js 16 (App Router, Server Actions; "Proxy" not middleware) |
| UI             | React 19, Tailwind CSS v4, shadcn/ui (`radix-nova`)           |
| Language       | TypeScript                                                    |
| ORM            | Prisma 7 (driver adapters; client generated to `src/generated/prisma`) |
| Database       | SQLite for local dev → Supabase Postgres in production        |
| Auth           | Supabase Auth (password + Google OAuth), linked to a Prisma `User` by email |
| Validation     | Zod v4, react-hook-form                                       |
| Testing        | Vitest                                                        |
| Hosting        | Vercel                                                        |

## Prerequisites

- Node.js 20.12+ or 22+ (the seed and Prisma config use the built-in
  `process.loadEnvFile`).
- A [Supabase](https://supabase.com) project (for auth).

## Local setup

```bash
# 1. Install dependencies (also runs `prisma generate` via postinstall)
npm install

# 2. Configure environment
cp .env.example .env
#    then fill in your Supabase values (see "Environment variables" below)

# 3. Create the local SQLite database and apply migrations
npx prisma migrate dev

# 4. (Optional) Seed demo data + a demo login
npm run db:seed

# 5. Start the dev server
npm run dev
```

Open <http://localhost:3000>.

After seeding, log in with:

```
email:    tech@demo.com
password: password123
```

> The seed provisions the matching Supabase Auth user automatically **only if**
> `SUPABASE_SERVICE_ROLE_KEY` is set in `.env`. Otherwise create the user
> manually in the Supabase dashboard (Authentication → Users → Add user, with
> the email confirmed) — the seed prints a reminder.

## Environment variables

| Variable                        | Required | Description                                                                 |
| ------------------------------- | -------- | --------------------------------------------------------------------------- |
| `DATABASE_URL`                  | yes      | Prisma connection string. `file:./dev.db` locally; Supabase Postgres string in prod. |
| `NEXT_PUBLIC_SUPABASE_URL`      | yes      | Supabase project URL (browser-exposed).                                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes      | Supabase anon/publishable key (browser-exposed, safe to ship).              |
| `SUPABASE_SERVICE_ROLE_KEY`     | no\*     | Server-only secret. Used by the seed to create the demo login. Never expose to the client. |
| `NEXT_PUBLIC_APP_URL`           | no       | Public base URL for absolute links (share links, OAuth redirects). No trailing slash. |

\* Not required to run the app, but needed for `npm run db:seed` to provision
the demo auth login automatically.

## Available scripts

```bash
npm run dev          # dev server (http://localhost:3000)
npm run build        # production build
npm run start        # serve the production build
npm run lint         # eslint
npm test             # vitest run (one-shot)
npm run test:watch   # vitest watch mode
npm run db:seed      # seed demo company/user/pools/visits
npm run db:migrate   # apply migrations in a deployed environment (prisma migrate deploy)

# Prisma (after editing prisma/schema.prisma)
npx prisma generate                 # regenerate the client into src/generated/prisma
npx prisma migrate dev --name <x>   # create + apply a migration (local dev.db)
```

## Deploying to Vercel

1. **Move the database to Supabase Postgres.** SQLite is local-dev only — its
   file does not persist on Vercel's serverless filesystem. In
   [prisma/schema.prisma](prisma/schema.prisma) set the datasource `provider` to
   `postgresql`, and in [src/lib/prisma.ts](src/lib/prisma.ts) swap the driver
   adapter from `@prisma/adapter-better-sqlite3` to `@prisma/adapter-pg` (see the
   note in [CLAUDE.md](CLAUDE.md)). Regenerate with `npx prisma generate`.
2. **Push to a Git repo** and import the project into Vercel.
3. **Set environment variables** in Vercel → Project → Settings → Environment
   Variables — the same keys as `.env.example`. Use the Supabase **pooled**
   connection string (port `6543`, `?pgbouncer=true`) for `DATABASE_URL`.
4. **Build.** [vercel.json](vercel.json) runs `prisma generate && next build`;
   `prisma generate` also runs on install via the `postinstall` script.
5. **Apply migrations** against the production database (once, and after each
   schema change):
   ```bash
   DATABASE_URL="<prod-postgres-url>" npx prisma migrate deploy
   ```
   or add it to the Vercel build command once you're on Postgres.
6. **Configure Supabase Auth redirect URLs** to include your deployed origin
   (`https://<your-app>/auth/callback`) so Google OAuth works in production.

## Project layout

```
src/
  app/                 # App Router pages, layouts, Server Actions
    (dashboard)/       # authenticated route group (sidebar/bottom-nav shell)
    pool/[poolToken]/  # public, no-login homeowner dashboard
    auth/callback/     # OAuth code exchange
  components/          # UI primitives (ui/) + feature components
  lib/
    db/                # tenant-scoped data access (Prisma)
    reports/           # report + homeowner-dashboard view models
    supabase/          # browser + server Supabase clients
    pool-chemistry.ts  # pure chemistry engine (unit-tested)
    auth.ts            # bridges Supabase Auth ↔ Prisma User
  proxy.ts             # Next.js 16 "Proxy" — session refresh + route guards
prisma/                # schema + migrations
scripts/seed.ts        # demo-data seeder
```

## Testing

```bash
npm test
npx vitest run src/lib/pool-chemistry.test.ts   # a single file
```

The chemistry engine is the one piece with unit tests — keep it pure (no I/O) so
it stays that way.
