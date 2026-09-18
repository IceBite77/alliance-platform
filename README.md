# Alliance Platform

A self-hosted alliance management platform built on Cloudflare Workers and Cloudflare D1.

The project is intentionally designed so each alliance can deploy and own its own copy rather than relying on a centrally hosted service.

## Foundation

- Cloudflare Worker (TypeScript)
- Cloudflare D1 (SQLite)
- Versioned D1 migrations
- API-first structure
- Health endpoints for Worker and database checks

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Log in to Cloudflare:

   ```bash
   npx wrangler login
   ```

3. Create the D1 database:

   ```bash
   npx wrangler d1 create alliance-platform
   ```

4. Copy the returned database ID into `wrangler.jsonc`.

5. Apply migrations locally:

   ```bash
   npm run db:migrate:local
   ```

6. Start the Worker:

   ```bash
   npm run dev
   ```

## Deploy

Production deployment is intentionally migration-aware. Running:

```bash
npm run deploy
```

first applies any pending D1 migrations to the remote database and then deploys the Worker.

Cloudflare Builds is configured to use this command for the production branch, so future pushes to `main` will keep the Worker and D1 schema in step.

## Optional screenshot imports

AI-assisted screenshot imports require an OpenAI API key stored as a Cloudflare Worker secret:

```bash
npx wrangler secret put OPENAI_API_KEY
```

The vision model defaults to `gpt-4.1-mini`. A deployment can override it with the optional `OPENAI_VISION_MODEL` Worker variable. Screenshots are sent directly to the OpenAI Responses API with storage disabled and are not written to D1 or R2 by the platform.

After the first owner has been created, operational credentials can be added or
replaced from **Alliance Settings → Integrations & Keys**. Console-managed
credentials are encrypted with AES-GCM using the installation `AUTH_SECRET` and
are never displayed again or included in audit data. The ICE installation key is
verified by ICE Licensing and is not retained locally.

## Initial API

- `GET /` — service information
- `GET /api/health` — Worker health check
- `GET /api/health/db` — verifies the D1 binding and database query path

## Project structure

```text
migrations/      D1 schema migrations
src/             Worker source
wrangler.jsonc   Cloudflare Worker configuration
```

## Status

The initial Worker + D1 foundation is deployed. Authentication, alliance setup, member management, statistics, VS/DS history, profile self-service and Discord integrations will be layered on top of this base.
