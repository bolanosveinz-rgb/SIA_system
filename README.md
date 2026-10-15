# ServeLink

ServeLink is a community reporting and information platform connecting residents of Tupi, South Cotabato with their Local Government Unit. It is built with Next.js App Router, TypeScript, Tailwind CSS, Prisma/PostgreSQL (Supabase), Leaflet/OpenStreetMap, Cloudinary, and the Google Gemini API.

## What is included

- Resident registration and email/phone sign-in; invite-only administrator sign-in.
- HTTP-only signed JWT session cookies, bcrypt password hashes, Zod validation, role checks on API routes, same-origin mutation checks, and per-process authentication/API rate limits.
- Public community home and official news feed, with expandable long descriptions. Residents sign in to use the Gemini chatbot, like or comment on updates, and open the report map, their reports, or their profile.
- Community news previews show up to six words before expanding to the full description.
- Community news displays all published updates, including image and video media; video controls appear on interaction and auto-hide after three seconds.
- Public Install app button on the home page linking to the ServeLink download shared through Google Drive.
- ServeLink brand logo and site icon use `public/municipal_design_download.svg`.
- Administrator sign-in uses a responsive split-panel layout with LGU access guidance.
- Interactive Tupi boundary map, report pins, report-density heat layer, reverse geocoding, signed Cloudinary uploads, and resident report/status tracking in the signed-in resident portal.
- LGU dashboard, live report notifications using database-backed notification records and short polling, reports with filters/status/remarks, resident directory, news moderation/CRUD, and editable administrator profile/password.
- PostgreSQL schema, initial migration, and an idempotent seed script. Production seeding creates only the administrator; local seeding also creates sample data.

## Project structure

```text
prisma/
  migrations/                 PostgreSQL migration history
  schema.prisma               Data models, relations, roles and indexes
  seed.ts                     Admin account and local demo data
src/
  app/
    admin/                    Protected LGU dashboard and workspace
    api/                      Next.js Route Handlers
    login/ register/          Resident authentication pages
    map/ my-reports/          Community map and resident report status
  components/                 Responsive UI, auth, news feed and Leaflet map
  data/tupi-boundary.json     OpenStreetMap municipal GeoJSON
  lib/                        Auth, validation, Prisma, uploads and domain helpers
render.yaml                   Render blueprint
.env.example                  Required environment-variable template
```

## Requirements

- Node.js 22 LTS and npm.
- A Supabase PostgreSQL database.
- Cloudinary credentials for media uploads.
- A Google Gemini API key for AI answers. The rest of the application runs without this key; the assistant reports that it is unconfigured.

## Local setup

1. Install Node.js 22 and clone the repository:

   ```powershell
   git clone https://github.com/bolanosveinz-rgb/SIA_system.git
   cd SIA_system
   ```

2. Install dependencies and prepare environment variables:

   ```powershell
   npm ci
   Copy-Item .env.example .env
   ```

3. Create a Supabase project. In the Supabase dashboard, open **Connect** and choose the shared pooler connection details. Set both connection URLs in `.env`:

   ```dotenv
   DATABASE_URL="postgresql://postgres.YOUR_PROJECT_REF:YOUR_DATABASE_PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.YOUR_PROJECT_REF:YOUR_DATABASE_PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
   JWT_SECRET="use-a-unique-random-secret-at-least-32-characters-long"
   ADMIN_EMAIL="admin@tupi.gov.ph"
   ADMIN_PASSWORD="use-a-unique-long-password"
   ```

   `DATABASE_URL` uses the transaction-mode pooler on port `6543` for app queries and seeding. `DIRECT_URL` uses the session-mode pooler on port `5432` for Prisma migrations. Replace the project reference and password with values from Supabase; URL-encode reserved password characters such as `@`, `:`, `/`, `#`, or `?`. Keep `.env` private; it is ignored by Git.

4. Apply the checked-in migration, generate the Prisma client, and seed:

   ```powershell
   npm run db:deploy
   npm run db:generate
   npm run db:seed
   ```

   The seed script enforces the configured administrator role and password; rerunning it resets that account to the `ADMIN_*` values above. For local development, `NODE_ENV` is normally unset, so seeding also creates a sample resident (`resident@example.com` / `Resident123!`), a welcome news post, and a sample report. These sample accounts and records are **not** seeded when `NODE_ENV=production`.

5. Start the application:

   ```powershell
   npm run dev
   ```

   Open <http://localhost:3000>. Resident registration is public; administrator credentials come from the seed environment variables. Do not use the sample administrator values in production.

6. If sign-up reports a database configuration/schema issue, open `/api/health` on the same app origin. A healthy response is `{"status":"ok","database":"ready"}`. For a missing or outdated schema, set `DATABASE_URL` and `DIRECT_URL` in the environment of the app actually serving the registration page, then run `npm run db:deploy` and restart/redeploy the app.

## Supabase PostgreSQL

1. Create a Supabase project and copy its shared pooler URLs from **Connect**. Configure the transaction pooler URL as `DATABASE_URL` and the session pooler URL as `DIRECT_URL`.
2. Run `npm run db:deploy` from this project. This applies the checked-in PostgreSQL migration and creates all ServeLink tables, enum types, indexes, and foreign keys in the Supabase `public` schema. Row-level security is enabled on app tables so they aren't exposed to Supabase's public API roles; the app connects server-side using the database owner credentials.
3. Run `npm run db:generate` and `npm run db:seed`. The seed requires `ADMIN_PASSWORD`; in production it creates only the administrator.
4. For schema changes, back up production data and use `npm run db:migrate -- --name describe_change` only in development. Deploy committed migrations using `npm run db:deploy`.

This PostgreSQL migration replaces the former MySQL migration history. It is intended for a new Supabase database; migrating existing MySQL data requires a separate data export/import and is not performed by Prisma migrations.

## Cloudinary

1. Create a Cloudinary account and copy the exact cloud name, API key, and API secret from the Cloudinary dashboard. `CLOUDINARY_CLOUD_NAME` is the account's Cloud name, not the app name `ServeLink`.
2. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in `.env` (or the hosting provider). If uploads report `Invalid cloud_name`, replace the value with the Cloud name from the dashboard and restart or redeploy the app.
3. ServeLink requests a short-lived signed upload authorization from its own server and sends selected files directly to Cloudinary. The API secret is never sent to the browser. Images are limited to JPG/PNG/WebP (10 MB); videos to MP4/WebM/MOV (50 MB). Admins can upload a profile picture and office logo from Settings; the profile picture is shown in the admin navigation and signed-in site header.
4. Report photos and news media use HTTPS Cloudinary URLs. The sample news post intentionally has no external media dependency.

## Google Gemini assistant

The Render Blueprint sets `GEMINI_CHAT_MODEL` to `gemini-2.5-flash-lite` and prompts for `GEMINI_API_KEY`. After changing the Gemini key in Render, save it and redeploy/restart the service so the running server uses the new secret. Rotate any key shared in chat, source control, or logs.

Create a Gemini API key in Google AI Studio and make sure Gemini API access is enabled for it. Set `GEMINI_API_KEY` in your local `.env` or hosting-provider environment; `.env.example` intentionally leaves it blank. If Google rejects the key, replace it with a valid AI Studio key and check that its API restrictions allow Gemini API requests. For hosted deployments, update the variable in the provider dashboard and restart or redeploy the app so the new value is loaded. Set `GEMINI_CHAT_MODEL` to a fast Gemini Flash model enabled for that key (the example uses `gemini-2.5-flash`); this setting takes precedence over the backward-compatible `GEMINI_API_MODEL` setting. On a temporary model failure or quota error, the assistant tries one alternate model; it only queries the model list when the configured and fallback models are not found. If both models fail, check Google AI Studio service status, key restrictions, and project quotas. The resident chatbot is a wide, fixed bottom chatbar on the community home page; its conversation panel appears after the resident sends a first message. The composer accepts detailed questions up to 20,000 characters; the application does not cap the number of questions, but Google API quotas and context limits still apply. Photo uploads and camera capture are supported; images are resized in the browser and sent to Gemini for analysis without being stored by ServeLink. Voice input uses browser speech recognition to transcribe the resident's message into the composer before it is sent; microphone permission and browser support are required. Think mode asks Gemini for a more thorough, well-organized answer, but does not expose private reasoning. The assistant indicator animates while live and respects reduced-motion preferences. Requests time out after 30 seconds; ordinary answers are limited to 1,024 output tokens and Think-mode answers to 4,096, reducing response latency. Timeouts preserve the message for retry and show guidance. The resident chatbot keeps the recent conversation context while the page remains open. Requests go through `POST /api/ai`; the key is sent server-to-server in the `x-goog-api-key` header and is never exposed to the browser.

## GitHub and branch workflow

1. Create a feature branch for each change, for example `feat/report-status-notifications`.
2. Run `npm run typecheck`, `npm run lint`, and the relevant database/build checks before opening a pull request.
3. Push your branch and open a pull request against `main`; require a review before merging.
4. Keep `.env`, credentials, database dumps, and Cloudinary exports out of commits. Rotate credentials immediately if they are exposed.

Example:

```powershell
git switch -c feat/report-status-notifications
git add .
git commit -m "feat: add report status notifications"
git push -u origin feat/report-status-notifications
```

## Render deployment

The repository includes [`render.yaml`](./render.yaml) for a single-instance Node web service. One instance keeps the in-memory abuse limits consistent; move rate limiting to a shared store before horizontal scaling.

1. Push the project to GitHub and create a new Render Blueprint from the repository.
2. Set `DATABASE_URL` and `DIRECT_URL` to the Supabase pooler URLs described above.
3. Supply the Cloudinary and Google Gemini values when Render prompts for the `sync: false` variables. `JWT_SECRET` is generated by the blueprint; keep it stable across deploys or existing sessions will be invalidated.
4. Deploy. The build runs `prisma migrate deploy` before `next build`; `/api/health` checks the database connection.
5. In the Render service shell, with `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, and `ADMIN_PHONE` configured, run `npm run db:seed`. In production this creates only the administrator account/profile—no demo resident or sample report.
6. Confirm the `/admin/login` page, map tiles, AI configuration, and Cloudinary uploads. Set `NEXT_PUBLIC_APP_URL` to the deployed HTTPS origin.

Do not expose database, JWT, Google Gemini, or Cloudinary secrets as `NEXT_PUBLIC_*` variables. Use a unique database password and rotate it immediately if it is exposed.

## Map boundary and attribution

`src/data/tupi-boundary.json` contains the Tupi administrative boundary from OpenStreetMap relation 17221696, licensed under the Open Database License (ODbL 1.0). Its outline is drawn on both maps; click submission and server-side report validation use point-in-polygon checks against the same geometry. The map pans only within that boundary's bounding box, with clicks outside the municipality rejected. OSM attribution is shown on the map and in its overlay.

Tiles are provided by OpenStreetMap. Address lookup uses the public Nominatim reverse-geocoding service, with a one-request-per-second per-IP throttle; it is best-effort and report submission continues with coordinates if the lookup is unavailable.

## API and role overview

| Route | Access | Purpose |
| --- | --- | --- |
| `/api/auth/register`, `/login`, `/admin-login`, `/logout`, `/me` | Public/session | Resident registration and role-specific sign-in |
| `/api/ai` | Public, rate limited | Server-side Google Gemini assistant |
| `/api/news` and `/api/news/:id/*` | Public read; residents like/comment; admins manage | News, likes, comments, moderation |
| `/api/reports` | Residents see their reports; admins see/filter all | Report creation, review, status changes |
| `/api/reports/map` | Public | Minimal community map markers without reporter/contact details |
| `/api/admin/*` | Admin only | Dashboard, notifications, resident directory, settings |
| `/api/upload/signature` | Signed-in user | Short-lived Cloudinary upload authorization |
| `/api/geocode` | Public, rate limited | Tupi-bounded reverse geocoding |

## Verification and testing checklist

Run the available checks:

```powershell
npm run typecheck
npm run lint
npm run build
```

Resident flow:

- Register with valid/invalid values; verify barangay, password-confirmation, and duplicate-email messages.
- Sign in using email and phone; verify wrong credentials and sign-in throttling.
- Ask the home-page assistant a question with `GEMINI_API_KEY` configured and verify the unconfigured state without it.
- Verify long community-news descriptions show only the first sentence until “See more” is selected, then collapse again with “Show less.”
- Like a news post, reload, and confirm the like is retained; add a comment and confirm newest-first ordering.
- Open the heat map, confirm the municipal outline and heat layer, and verify clicks outside Tupi cannot submit.
- Submit a report with and without a photo; verify it appears in My Reports and retains status/remarks after reload.

LGU flow:

- Confirm a resident cannot load `/admin` or any `/api/admin/*` endpoint.
- Sign in with the seeded administrator and verify summary counts, map markers, and new-report toasts/badge updates.
- Search/paginate residents and inspect a profile and its reports.
- Create/edit/delete news with images/video, inspect comments, and remove a comment.
- Filter reports by status, barangay, search term, and date; change status/add a remark and confirm the resident sees the update.
- Edit office information, change the password, sign out, and confirm the updated credentials.

## Operational notes

- Run migrations as part of deployment; never edit an already-applied migration. Add a new migration for each schema change.
- The rate limiter is process-local and intentionally paired with the single Render instance in `render.yaml`. Use a shared Redis/database-backed limiter before enabling multiple instances.
- Community map markers shown to residents contain only report title, location, status, and time; reporter identity/contact details are restricted to the LGU.
- Monitor Render and Supabase logs, keep database backups, and rotate admin/API/database secrets on staff or credential changes.
