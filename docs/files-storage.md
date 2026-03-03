# Files Storage Bucket Notes

This project stores file binaries in Supabase Storage and metadata in `public.files`.

## Bucket setup

- Create one or more private buckets in Supabase Storage (for example: `project-files`).
- Keep buckets private unless a specific public use case requires otherwise.
- Use path conventions that keep entities grouped, for example:
  - `{pathPrefix}/{entityType}/{entityId}/{timestamp}-{random}.{ext}`
- Configure bucket access through Supabase RLS/storage policies, not hardcoded credentials.

## Environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY` for trusted server-side jobs only

Do not commit real keys or secrets to git. Keep credentials in local/hosted environment configuration.

## Realtime setup for `public.files`

If file list updates are not arriving in other tabs, enable Postgres changes replication for `public.files`:

1. In Supabase Dashboard, open `Database` -> `Replication` (or `Realtime` -> `Database` in some UI versions).
2. Ensure `public.files` is added to the `supabase_realtime` publication.
3. Ensure Realtime is enabled for the project.
4. Keep RLS enabled on `public.files`; subscriptions follow auth/RLS rules for the connected user.

After this is enabled, client subscriptions in `src/features/files/realtimeFiles.ts` receive INSERT/UPDATE/DELETE and `useFiles` invalidates/refetches the matching `['files', entityType, entityId]` cache key.

## Post-insert processing webhook (`public.files`)

This project includes a placeholder processor route at:

- `/api/files/process` -> `src/app/api/files/process/route.ts`

It expects a Supabase Database Webhook payload for `INSERT` on `public.files` and updates metadata:

- `image/*` -> `metadata.previewReady = true`
- `application/pdf` -> `metadata.needsOcr = false`, `metadata.pageCount = null`

### Configure Supabase Database Webhook

1. Open Supabase Dashboard -> `Database` -> `Webhooks`.
2. Create webhook:
   - Name: `files-post-insert-processor`
   - Table: `public.files`
   - Events: `INSERT`
   - Type: `HTTP Request`
   - Method: `POST`
   - URL:
     - Cloud/dev deployment: `https://<your-app-domain>/api/files/process`
     - Local with Supabase Docker stack: `http://host.docker.internal:3000/api/files/process`
3. Add header:
   - `x-webhook-secret: <FILES_WEBHOOK_SECRET>`
4. Set `FILES_WEBHOOK_SECRET` in your app environment (same value as webhook header).

No UI changes are required; metadata updates happen asynchronously after insert.
