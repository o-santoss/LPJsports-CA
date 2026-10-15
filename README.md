# C.Arbitragem · React + Supabase

**Começa por [START-HERE.md](START-HERE.md)** para instalar o módulo de arbitragem e a migração SQL 002.

# LPJ Sports · C.Arbitragem

React + Node.js API, PostgreSQL via `DATABASE_URL`, Supabase private Storage, Vercel hosting.

## Local development

Use Node 22.13 or newer (recommended: Node 22 LTS).

```sh
nvm use
npm ci
cp .env.example .env
# Fill the variables locally, then:
npm run build
npm start
```

`npm run dev` watches the client and API. Never commit `.env`, `.env.local`, other environment files or `.vercel/`. Only `.env.example` belongs in Git. No server environment variables are bundled into React.

## Supabase configuration

The existing project and SQL schema are reused. **Startup and demo seeding do not apply migrations.** `server/migrations/001_core.postgres.sql` documents the expected tables and types; do not run it over existing tables. The original SQLite schema remains only as a test fixture/reference.

Set:

- `DATABASE_URL`: Supabase **session pooler**, port 5432, from the Connect panel. Use the exact URL and URL-encode special characters in the password. TLS certificate verification is enabled; `DATABASE_SSL=disable` is only for a local test database.
- `SUPABASE_URL`: the project HTTPS URL.
- `SUPABASE_SERVICE_ROLE_KEY`: a server-only service role key. Never add a public frontend prefix.
- `SUPABASE_PHOTOS_BUCKET=photos` and `SUPABASE_DOCUMENTS_BUCKET=documents`.
- `PUBLIC_URL`: the site's actual public HTTPS URL.
- `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PIN`: optional first administrator, only if users is empty. Remove bootstrap values after initial setup.
- Brevo variables in `.env.example` if real email delivery is required.

Create the two Storage buckets as **private** if they do not already exist. Suggested object size limits: 2 MB for photos, 15 MB for documents. Do not grant public access. Session checks and role/audience checks remain in the app API; the service key is used only on the server.

Photos retain their authenticated `/api/photos/:file` URLs. Documents upload directly to a signed single-object Storage URL and then submit metadata to the API. Upload receipts bind the path, size and expiry to the requesting administrator. Downloads verify the document audience before redirecting to a URL valid for 60 seconds. Documents sent by older API clients as base64 are limited to 3 MB to fit Vercel's request limit; the new UI supports 15 MB.

Objects uploaded but never submitted can remain unused in Storage; periodically remove confirmed unreferenced objects. Existing local SQLite rows and `data/uploads` are not copied automatically. Back them up and plan a separate data import if they need preserving.

## Vercel

Import the repository with its root as the Vercel Root Directory. `vercel.json` supplies the build command, `public` output, Node API function in `api/index.js`, API routing and SPA fallback. Choose Node 22.x in project settings.

Add the variables above in Vercel's environment settings, also `NODE_ENV=production` and `TRUST_PROXY=1`. Set `SUPABASE_URL` for both build and runtime: the build uses its origin in the browser CSP. Set Preview variables separately if deploying previews. Redeploy after changing variables. No persistent filesystem or background interval is required. Email delivery is awaited before the API responds.

No deployment, remote schema change or demo seed is performed by building. Verify login, photo upload, document upload/download, logout and deep links on a preview before production.

## Demo seed

```sh
npm run seed:demo
```

Uses `DATABASE_URL` and Storage; no SQLite. It takes a database transaction/advisory lock, refuses to add demo data when any user exists, and does not delete records. `--force` is no longer supported. Use a demo project: demo users have known PINs printed by the script. Optional `DEMO_DOCS` points to local sample PDFs. Database changes roll back on failure; Storage uploads are separate and may require cleanup after an interrupted seed.

## Validation

```sh
npm test
npm run build
# Optional: point only at a dedicated test Postgres database:
TEST_DATABASE_URL='...' npm run test:postgres
```

The API tests call the handler without listening on a network port, using an asynchronous SQLite test double and mocked Storage. They cover route behavior, permissions, signed receipts and async results; they do not prove compatibility with the existing Supabase schema. The opt-in Postgres test creates a random isolated schema and removes that schema afterwards, checking generated IDs, parameter binding, conflict handling, transactions and rollback. It never uses application tables.

Remaining operational consideration: the IP rate limiter is per instance. Account lockouts are persisted in Postgres, but a shared/distributed rate limiter is advisable for high-traffic public deployments.
