import app from "./player_account_link";

interface Env {
  DB: D1Database;
  ASSETS: R2Bucket;
  APP_URL: string;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  DISCORD_BOT_TOKEN: string;
  SETUP_KEY: string;
  AUTH_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const result = await (app as any).fetch(request, env);
    if (result instanceof Response) return result;
    if (typeof result === "string") {
      return new Response(result, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "x-frame-options": "DENY",
          "referrer-policy": "no-referrer"
        }
      });
    }
    throw new TypeError("Worker handler did not return a Response");
  }
} satisfies ExportedHandler<Env>;
