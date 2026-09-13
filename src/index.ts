export interface Env {
  DB: D1Database;
}

type AllianceRow = {
  id: number;
  name: string;
  tag: string | null;
  created_at: string;
  updated_at: string;
};

type SettingRow = {
  key: string;
  value: string;
};

const json = (data: unknown, init: ResponseInit = {}): Response => {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers,
  });
};

const getSettings = async (env: Env, keys: string[]): Promise<Record<string, string>> => {
  if (keys.length === 0) return {};

  const placeholders = keys.map(() => "?").join(", ");
  const result = await env.DB.prepare(
    `SELECT key, value FROM settings WHERE key IN (${placeholders})`,
  )
    .bind(...keys)
    .all<SettingRow>();

  return Object.fromEntries((result.results ?? []).map((row) => [row.key, row.value]));
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    if (url.pathname === "/") {
      return json({
        name: "Alliance Platform",
        status: "ok",
        version: "0.1.0",
      });
    }

    if (url.pathname === "/api/health") {
      return json({
        status: "ok",
        service: "worker",
        timestamp: new Date().toISOString(),
      });
    }

    if (url.pathname === "/api/health/db") {
      try {
        const result = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();

        return json({
          status: result?.ok === 1 ? "ok" : "error",
          service: "d1",
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("D1 health check failed", error);

        return json(
          {
            status: "error",
            service: "d1",
            message: "Database health check failed",
          },
          { status: 500 },
        );
      }
    }

    if (url.pathname === "/api/alliance") {
      try {
        const alliance = await env.DB.prepare(
          "SELECT id, name, tag, created_at, updated_at FROM alliance WHERE id = 1",
        ).first<AllianceRow>();

        if (!alliance) {
          return json({ error: "Alliance record not found" }, { status: 404 });
        }

        const settings = await getSettings(env, ["alliance_timezone", "platform_name"]);

        return json({
          alliance: {
            id: alliance.id,
            name: alliance.name,
            tag: alliance.tag,
            timezone: settings.alliance_timezone ?? "UTC",
            createdAt: alliance.created_at,
            updatedAt: alliance.updated_at,
          },
          platform: {
            name: settings.platform_name ?? "Alliance Platform",
          },
        });
      } catch (error) {
        console.error("Alliance lookup failed", error);
        return json({ error: "Unable to load alliance" }, { status: 500 });
      }
    }

    if (url.pathname === "/api/setup/status") {
      try {
        const settings = await getSettings(env, [
          "setup_complete",
          "schema_version",
          "alliance_timezone",
        ]);
        const owner = await env.DB.prepare(
          "SELECT id FROM accounts WHERE is_owner = 1 AND is_active = 1 LIMIT 1",
        ).first<{ id: number }>();

        const setupComplete = settings.setup_complete === "true" && Boolean(owner);

        return json({
          setupComplete,
          ownerAccountExists: Boolean(owner),
          schemaVersion: Number(settings.schema_version ?? "0"),
          timezone: settings.alliance_timezone ?? "UTC",
          nextStep: setupComplete ? null : "create-owner",
        });
      } catch (error) {
        console.error("Setup status lookup failed", error);
        return json({ error: "Unable to determine setup status" }, { status: 500 });
      }
    }

    return json({ error: "Not found" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
