# Cloudflare Worker Deployment Guide

This document explains how to run Comprehendo on **Cloudflare Workers** with a **Cloudflare D1** database using the [OpenNext](https://github.com/opennextjs/opennext) toolchain. It complements the automated GitHub workflow (`.github/workflows/cloudflare-workers.yml`) and covers the manual steps required for initial setup, local development, and production maintenance.

## 1. Prerequisites

- Cloudflare account with access to **Workers** and **D1** (Workers Paid plan or higher for production).
- `wrangler` CLI (install globally with `npm install -g wrangler` or use `npx wrangler`).
- Ability to execute `npx @opennextjs/cloudflare@latest` commands (used by the project scripts).
- OAuth provider credentials (`GITHUB_ID`/`SECRET`, `GOOGLE_CLIENT_ID`/`SECRET`, etc.).
- Application secrets such as `AUTH_SECRET`, `ADMIN_EMAILS`, API keys for AI/translation providers.

## 2. Configure D1

1. **Create the database**

   ```bash
   npx wrangler d1 create comprehendo
   ```

   Copy the returned `database_id` and update `wrangler.toml` (replace the placeholder `00000000-0000-0000-0000-000000000000`).

2. **Apply migrations**

   ```bash
   npx wrangler d1 migrations apply comprehendo --remote
   ```

   Re-run this command whenever a new SQL file is added under `migrations/`.

## 3. Local development

1. Install dependencies: `npm install`
2. Apply migrations to the local D1 instance:

   ```bash
   npx wrangler d1 migrations apply comprehendo --local
   ```

3. Start the dev server (OpenNext provides the Workers bindings automatically):

   ```bash
   npm run dev
   ```

4. Open http://localhost:3000 and sign in using your configured providers.

Common D1 commands during development:

```bash
# Open interactive shell
npx wrangler d1 shell comprehendo --local

# Run a specific query
npx wrangler d1 execute comprehendo --local --command "SELECT COUNT(*) FROM quiz;"
```

## 4. Build & preview the Worker locally

1. Build the Worker bundle (outputs to `.open-next/`):

   ```bash
   npm run build
   ```

2. Preview the Worker with persisted local state:

   ```bash
   npm run cf:preview
   ```

   This runs `wrangler dev` against the generated Worker bundle and serves static assets from `.open-next/static`.

## 5. Cloudflare Worker project setup

1. Create (or reuse) a Worker in the Cloudflare dashboard whose script name matches the `name` in `wrangler.toml` (`comprehendo` by default).
2. Under **Settings → Variables**, add a D1 binding:
   - Binding name: `COMPREHENDO_DB`
   - Database: select the D1 instance created earlier.
3. Add the required secrets/environment variables (values from `.env.local`):
   - `AUTH_SECRET`, OAuth client IDs/secrets, optional AI keys, `ADMIN_EMAILS`, rate limit overrides, etc.
4. For asset hosting, ensure the Worker has Static Assets enabled or rely on the default OpenNext asset manifest (served from `.open-next/static`).

## 6. GitHub Actions automation

The `Cloudflare Workers Deploy` workflow expects the following repository configuration:

| Type     | Name                    | Purpose                                      |
| -------- | ----------------------- | -------------------------------------------- |
| Secret   | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account identifier                |
| Secret   | `CLOUDFLARE_API_TOKEN`  | API token with Workers + D1 edit permissions |
| Variable | `CLOUDFLARE_D1_NAME`    | D1 database name (e.g., `comprehendo`)       |

Once secrets/variables are in place, every push to `main` will:

1. Install dependencies & run `npm run verify`
2. Build the OpenNext Cloudflare Worker bundle (`npm run build`)
3. Apply pending D1 migrations (`wrangler d1 migrations apply ... --remote`)
4. Publish the Worker via `wrangler deploy`

## 7. Troubleshooting

- **Build fails with missing OpenNext CLI:** Ensure you have network access to install `@opennextjs/cloudflare` when running `npm run build`/`npm run dev`.
- **D1 binding missing at runtime:** Confirm the Worker has a `COMPREHENDO_DB` binding and that local dev uses `npm run dev` (OpenNext) or `npm run cf:preview` after running migrations.
- **Migrations fail in CI:** Confirm the API token has `Account.CloudflareWorkersScripts.Edit`, `Account.CloudflareWorkersKV.Edit`, and `Account.D1.Edit` permissions. Re-run locally with `npx wrangler d1 migrations apply comprehendo --remote` to check for SQL errors.
- **Auth redirects to localhost in production:** Set `NEXTAUTH_URL` to your production Worker domain (e.g., `https://comprehendo.example.workers.dev`). Update OAuth provider redirect URLs accordingly.
- **Rate limiting or caching behaves unexpectedly:** Inspect the D1 tables (`quiz`, `rate_limits`) via Wrangler or the Admin panel. Remember that D1 is eventually consistent; avoid relying on immediate read-after-write for cross-region operations.
- **Local dev cannot find D1 binding:** Ensure you're using `npm run dev` (OpenNext dev server) rather than `next dev`.

## 8. Maintenance checklist

- Periodically export D1 backups (`wrangler d1 backup create comprehendo`) and store them securely.
- Rotate OAuth/API credentials stored in Cloudflare Secrets.
- Monitor Cloudflare Workers analytics for errors/latency.
- When changing SQL schema, add a new file to `migrations/` and commit it so CI can apply the migration automatically.

With these steps, Comprehendo can be developed locally and deployed globally on Cloudflare Workers with a managed D1 database.
