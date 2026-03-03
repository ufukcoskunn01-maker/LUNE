# Hourly Attendance Sync Setup

This repo includes an hourly sync route that imports attendance XLSX files from Supabase Storage into database-backed attendance tables.

## Routes
- `POST /api/jobs/sync-attendance-hourly`
  - Optional JSON body: `{ "projectCode": "A27", "lookbackDays": 3 }`
- `POST /api/jobs/attendance-sync` (alias route to avoid 404 on old path)
- `GET /api/cron/attendance-sync`
  - Intended for scheduler/cron.
- `GET /api/cron/sync-attendance` (alias route to avoid 404 on old path)

Both routes check `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set.

## Required environment variables
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_BASE_URL` (for internal calls to your import endpoints, e.g. `https://your-app.vercel.app`)

## Optional environment variables
- `SUPABASE_STORAGE_BUCKET` (default: `import`)
- `CRON_SECRET`

## File convention expected
The sync scans paths like:
- `<bucket>/<projectCode>/attendance/YYYY/MM-Month/*.xlsx`

and imports files matching:
- `<projectCode>-E-IN-YYMMDD_revNN.xlsx`

Example:
- `import/A27/attendance/2026/02-February/A27-E-IN-100226_rev00.xlsx`

## Scheduler
`vercel.json` includes hourly cron:
- `0 * * * *` -> `/api/cron/attendance-sync`

If you use another platform, schedule this URL hourly with the same auth header.