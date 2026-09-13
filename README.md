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

Apply migrations to the production D1 database:

```bash
npm run db:migrate:remote
```

Then deploy the Worker:

```bash
npm run deploy
```

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

This is the initial platform foundation. Authentication, alliance setup, member management, statistics, VS/DS history, profile self-service and Discord integrations will be layered on top of this base.
