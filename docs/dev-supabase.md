# Local Supabase Development

This repository tracks database schema changes in `supabase/migrations`.

## Prerequisites

- Docker running locally
- Supabase CLI available (`npx supabase ...` is used by npm scripts)

## Start local Supabase

```bash
npm run supabase:start
```

This starts the local Supabase stack for the project.

## Reset local DB from migrations

```bash
npm run supabase:reset
```

This rebuilds the local database and reapplies all migrations from `supabase/migrations`, giving a clean schema state.

## Push pending migrations

```bash
npm run supabase:push
```

Use this to apply new local migration files to the current database.

## Recommended new developer flow

1. `npm install`
2. `npm run supabase:start`
3. `npm run supabase:reset`
4. Start the app (`npm run dev`)

Following this flow ensures every developer gets the same schema from versioned migrations.
