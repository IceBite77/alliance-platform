export interface Env {
  DB: D1Database;
}

const json = (data: unknown, init: ResponseInit = {}): Response => {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers,
  });
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

    return json({ error: "Not found" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
