# ServeLink

ServeLink is a community reporting and information platform connecting residents of Tupi, South Cotabato with their Local Government Unit. It is built with Next.js App Router, TypeScript, Tailwind CSS, Prisma/MySQL, Leaflet/OpenStreetMap, Cloudinary, and the Anthropic Messages API.

## What is included

- Resident registration and email/phone sign-in; invite-only administrator sign-in.
- HTTP-only signed JWT session cookies, bcrypt password hashes, Zod validation, role checks on API routes, same-origin mutation checks, and per-process authentication/API rate limits.
- Resident home page with a server-side Claude-powered community assistant, official news feed, optimistic likes, newest-first comments, and dark/light theme.
- Interactive Tupi boundary map, report pins, report-density heat layer, reverse geocoding, signed Cloudinary uploads, and resident report/status tracking.
- LGU dashboard, live report notifications using database-backed notification records and short polling, reports with filters/status/remarks, resident directory, news moderation/CRUD, and editable administrator profile/password.
- MySQL schema, initial migration, and an idempotent seed script. Production seeding creates only the administrator; local seeding also creates sample data.

## Requirements

- Node.js 22 LTS and npm.
- A MySQL 8-compatible database (Railway MySQL is supported).
- Cloudinary credentials for media uploads.
- An Anthropic API key for AI answers. The rest of the application runs without this key; the assistant reports that it is unconfigured.

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

3. Create a MySQL database and update `.env`:

   ```dotenv
   DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/servelink"
   JWT_SECRET="use-a-unique-random-secret-at-least-32-characters-long"
   ADMIN_EMAIL="admin@tupi.gov.ph"
   ADMIN_PASSWORD="use-a-unique-long-password"
   ```

   Use a URL-encoded password if it contains reserved URL characters such as `@`, `:`, `/`, `#`, or `?`. Keep `.env` private; it is ignored by Git.

4. Apply the checked-in migration, generate the Prisma client, and seed:

   ```powershell
   npm run db:deploy
   npm run db:generate
   npm run db:seed
   ```

   For local development, `NODE_ENV` is normally unset, so seeding also creates a sample resident (`resident@example.com` / `Resident123!`), a welcome news post, and a sample report. These sample accounts and records are **not** seeded when `NODE_ENV=production`.

5. Start the application:

   ```powershell
   npm run dev
   ```

   Open <http://localhost:3000>. Resident registration is public; administrator credentials come from the seed environment variables. Do not use the sample administrator values in production.

## Railway MySQL

1. Create a Railway project and add a MySQL service.
2. In the MySQL service, copy its connection URL. For a local application use the Railway-provided public TCP proxy URL; a private Railway hostname is not reachable from a developer machine or Render.
3. Put that URL in `DATABASE_URL`. URL-encode special characters in credentials.
4. Run `npm run db:deploy` from this project to apply `prisma/migrations/`.
5. Back up production databases and use `npm run db:deploy` for deployed migrations. Use `npm run db:migrate -- --name describe_change` only when creating a new migration during development.

## Cloudinary

1. Create a Cloudinary account and copy the cloud name, API key, and API secret from the dashboard.
2. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in `.env` (or the hosting provider).
3. ServeLink requests a short-lived signed upload authorization from its own server and sends selected files directly to Cloudinary. The API secret is never sent to the browser. Images are limited to JPG/PNG/WebP (10 MB); videos to MP4/WebM/MOV (50 MB).
4. Report photos and news media use HTTPS Cloudinary URLs. The sample news post intentionally has no external media dependency.

## Anthropic assistant

Set `AI_API_KEY` to an Anthropic API key and `AI_MODEL` to a model enabled for that key (the default is `claude-sonnet-4-20250514`). Requests go through `POST /api/ai`; the key and system prompt remain server-side. The endpoint has a basic per-IP request limit and returns an explicit unavailable response when the key is missing.

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
2. Create a Railway MySQL database and use its **public TCP proxy** connection URL for Render's `DATABASE_URL` (Render cannot reach Railway private networking).
3. Supply the Cloudinary and Anthropic values when Render prompts for the `sync: false` variables. `JWT_SECRET` is generated by the blueprint; keep it stable across deploys or existing sessions will be invalidated.
4. Deploy. The build runs `prisma migrate deploy` before `next build`; `/api/health` checks the database connection.
5. In the Render service shell, with `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, and `ADMIN_PHONE` configured, run `npm run db:seed`. In production this creates only the administrator account/profile—no demo resident or sample report.
6. Confirm the `/admin/login` page, map tiles, AI configuration, and Cloudinary uploads. Set `NEXT_PUBLIC_APP_URL` to the deployed HTTPS origin.

Do not expose database, JWT, Anthropic, or Cloudinary secrets as `NEXT_PUBLIC_*` variables. Prefer a Railway public endpoint restricted to required sources where available, enable TLS when supported, and use a unique database password.

## Map boundary and attribution

`src/data/tupi-boundary.json` contains the Tupi administrative boundary from OpenStreetMap relation 17221696, licensed under the Open Database License (ODbL 1.0). Its outline is drawn on both maps; click submission and server-side report validation use point-in-polygon checks against the same geometry. The map pans only within that boundary's bounding box, with clicks outside the municipality rejected. OSM attribution is shown on the map and in its overlay.

Tiles are provided by OpenStreetMap. Address lookup uses the public Nominatim reverse-geocoding service, with a one-request-per-second per-IP throttle; it is best-effort and report submission continues with coordinates if the lookup is unavailable.

## API and role overview

| Route | Access | Purpose |
| --- | --- | --- |
| `/api/auth/register`, `/login`, `/admin-login`, `/logout`, `/me` | Public/session | Resident registration and role-specific sign-in |
| `/api/ai` | Public, rate limited | Server-side Anthropic assistant |
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
- Ask the home-page assistant a question with `AI_API_KEY` configured and verify the unconfigured state without it.
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
- Monitor Render and Railway logs, keep database backups, and rotate admin/API/database secrets on staff or credential changes.
