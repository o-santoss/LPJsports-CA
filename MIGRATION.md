# Migration handoff

The original repository at `/Users/afonsosantos/Documents/GitHub/LPJsports-CA` was read-only in the execution sandbox. Changes were prepared in this separate working copy; the original files, including its existing package changes, were not modified.

From the original repository, apply the accompanying patch:

```sh
git apply --check /Users/afonsosantos/Documents/Codex/2026-10-14/new-chat/supabase-vercel.patch
git apply /Users/afonsosantos/Documents/Codex/2026-10-14/new-chat/supabase-vercel.patch
nvm use
npm ci
npm test
npm run build
```

Then fill environment variables following README.md and configure the two private buckets. The patch was generated against the repository as found, including the existing `postgres` dependency; it does not include environment secrets, data, node_modules or built assets.

Validated locally: production React build and 12 API behavior tests. The real Postgres integration test was skipped because no test database connection was provided. No Supabase data was written and no Vercel deployment was made.
