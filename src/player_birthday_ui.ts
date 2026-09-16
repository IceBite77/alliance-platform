import app from "./player_save_fix";

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

const decorateBirthday = async (res: Response, env: Env, playerId: number | null): Promise<Response> => {
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("text/html")) return res;

  let h = await res.text();
  const monthBlock = h.match(/<div><label>Birthday month<\/label>[\s\S]*?<select name="birthday_month">[\s\S]*?<\/select><\/div>/)?.[0];
  const dayBlock = h.match(/<div><label>Birthday day<\/label>[\s\S]*?<input name="birthday_day"[^>]*><\/div>/)?.[0];
  if (!monthBlock || !dayBlock) return new Response(h, { status: res.status, statusText: res.statusText, headers: res.headers });

  let month: number | null = null;
  let day: number | null = null;
  if (playerId !== null) {
    const stored = await env.DB.prepare("SELECT birthday_month,birthday_day FROM players WHERE id=? LIMIT 1").bind(playerId).first<{birthday_month:number|null;birthday_day:number|null}>();
    month = stored?.birthday_month ?? null;
    day = stored?.birthday_day ?? null;
  }

  const value = day && month ? `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}` : "";
  const birthday = `<div><label>Birthday</label><input name="birthday" type="text" inputmode="numeric" maxlength="5" placeholder="DD/MM" pattern="(?:0?[1-9]|[12][0-9]|3[01])\/(?:0?[1-9]|1[0-2])" value="${value}"><div class="hint">Day and month only · DD/MM</div></div>`;

  const first = h.indexOf(monthBlock);
  const second = h.indexOf(dayBlock);
  if (first < second) {
    h = h.replace(monthBlock, birthday).replace(dayBlock, "<div></div>");
  } else {
    h = h.replace(dayBlock, birthday).replace(monthBlock, "<div></div>");
  }

  return new Response(h, { status: res.status, statusText: res.statusText, headers: res.headers });
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const res = await (app as any).fetch(request, env);
    const p = new URL(request.url).pathname;
    const match = p.match(/^\/players\/(\d+)$/);
    if (res instanceof Response && request.method === "GET" && (p === "/players/new" || match)) {
      return decorateBirthday(res, env, match ? Number(match[1]) : null);
    }
    if (res instanceof Response) return res;
    return new Response(String(res ?? ""), { headers: { "content-type": "text/html; charset=utf-8" } });
  }
} satisfies ExportedHandler<Env>;
