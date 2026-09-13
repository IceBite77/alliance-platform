export interface Env {
  DB: D1Database;
  APP_URL: string;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  SETUP_KEY: string;
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

type DiscordTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
};

type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
};

const DISCORD_API = "https://discord.com/api/v10";
const SETUP_COOKIE = "ap_setup_oauth";

const json = (data: unknown, init: ResponseInit = {}): Response => {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers,
  });
};

const html = (body: string, init: ResponseInit = {}): Response => {
  const headers = new Headers(init.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");

  return new Response(body, {
    ...init,
    headers,
  });
};

const redirect = (location: string, headers?: HeadersInit): Response => {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("location", location);
  responseHeaders.set("cache-control", "no-store");
  return new Response(null, { status: 302, headers: responseHeaders });
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

const ownerExists = async (env: Env): Promise<boolean> => {
  const owner = await env.DB.prepare(
    "SELECT id FROM accounts WHERE is_owner = 1 LIMIT 1",
  ).first<{ id: number }>();
  return Boolean(owner);
};

const setupComplete = async (env: Env): Promise<boolean> => {
  const settings = await getSettings(env, ["setup_complete"]);
  return settings.setup_complete === "true" && (await ownerExists(env));
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const setupPage = (message?: string): string => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Alliance Platform Setup</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0c1220; color: #eef3ff; }
    main { width: min(92vw, 520px); background: #151d2e; border: 1px solid #2b3850; border-radius: 18px; padding: 28px; box-shadow: 0 24px 70px rgba(0,0,0,.35); }
    h1 { margin: 0 0 8px; font-size: 1.7rem; }
    p { color: #b8c4d9; line-height: 1.55; }
    label { display: block; margin: 22px 0 8px; font-weight: 700; }
    input { width: 100%; box-sizing: border-box; padding: 13px 14px; border-radius: 10px; border: 1px solid #3a4964; background: #0e1626; color: white; font-size: 1rem; }
    button { width: 100%; margin-top: 14px; padding: 13px 16px; border: 0; border-radius: 10px; background: #5865f2; color: white; font-size: 1rem; font-weight: 800; cursor: pointer; }
    .notice { margin: 14px 0 0; padding: 12px; border-radius: 10px; background: #24191c; color: #ffd5dc; }
    .small { font-size: .9rem; color: #90a0bb; }
  </style>
</head>
<body>
  <main>
    <h1>Create the first owner</h1>
    <p>Enter the one-time setup key you stored in Cloudflare. You will then be sent to Discord to verify your identity.</p>
    ${message ? `<div class="notice">${escapeHtml(message)}</div>` : ""}
    <form method="post" action="/setup/discord/start" autocomplete="off">
      <label for="setup_key">Setup key</label>
      <input id="setup_key" name="setup_key" type="password" required autocomplete="off">
      <button type="submit">Verify with Discord</button>
    </form>
    <p class="small">The setup key is never stored in the database or written to application logs.</p>
  </main>
</body>
</html>`;

const setupDonePage = (name: string): string => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Owner Connected</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0c1220; color: #eef3ff; }
    main { width: min(92vw, 520px); background: #151d2e; border: 1px solid #2b3850; border-radius: 18px; padding: 28px; }
    h1 { margin-top: 0; }
    p { color: #b8c4d9; line-height: 1.55; }
    strong { color: white; }
  </style>
</head>
<body>
  <main>
    <h1>Discord owner verified</h1>
    <p><strong>${escapeHtml(name)}</strong> is now the installation owner.</p>
    <p>The owner-creation route is locked. The next stage is configuring the alliance and Discord server, then enabling normal player sign-up and approval.</p>
  </main>
</body>
</html>`;

const sha256 = async (value: string): Promise<Uint8Array> => {
  const data = new TextEncoder().encode(value);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
};

const constantTimeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
};

const secureStringEqual = async (a: string, b: string): Promise<boolean> =>
  constantTimeEqual(await sha256(a), await sha256(b));

const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};

const signState = async (state: string, secret: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(state));
  return bytesToBase64Url(new Uint8Array(signature));
};

const readCookie = (request: Request, name: string): string | null => {
  const cookies = request.headers.get("cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === name) return rest.join("=");
  }
  return null;
};

const clearSetupCookie = (): string =>
  `${SETUP_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

const validateSetupState = async (request: Request, state: string, secret: string): Promise<boolean> => {
  const cookie = readCookie(request, SETUP_COOKIE);
  if (!cookie) return false;
  const separator = cookie.lastIndexOf(".");
  if (separator <= 0) return false;
  const cookieState = cookie.slice(0, separator);
  const cookieSignature = cookie.slice(separator + 1);
  if (!(await secureStringEqual(cookieState, state))) return false;
  const expected = await signState(cookieState, secret);
  return secureStringEqual(cookieSignature, expected);
};

const beginDiscordSetup = async (request: Request, env: Env): Promise<Response> => {
  if (await ownerExists(env)) {
    return html(setupPage("An owner account already exists. First-owner setup is locked."), { status: 409 });
  }

  const form = await request.formData();
  const submittedKey = String(form.get("setup_key") ?? "");
  if (!submittedKey || !(await secureStringEqual(submittedKey, env.SETUP_KEY))) {
    return html(setupPage("That setup key is not valid."), { status: 403 });
  }

  const state = crypto.randomUUID();
  const signature = await signState(state, env.SETUP_KEY);
  const cookie = `${SETUP_COOKIE}=${state}.${signature}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`;

  const redirectUri = `${env.APP_URL}/auth/discord/callback`;
  const authorize = new URL("https://discord.com/oauth2/authorize");
  authorize.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", "identify guilds");
  authorize.searchParams.set("state", state);

  return redirect(authorize.toString(), { "set-cookie": cookie });
};

const exchangeDiscordCode = async (code: string, env: Env): Promise<DiscordTokenResponse> => {
  const body = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: `${env.APP_URL}/auth/discord/callback`,
  });

  const response = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) throw new Error(`Discord token exchange failed with ${response.status}`);
  return response.json<DiscordTokenResponse>();
};

const fetchDiscordUser = async (accessToken: string): Promise<DiscordUser> => {
  const response = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Discord user lookup failed with ${response.status}`);
  return response.json<DiscordUser>();
};

const finishDiscordSetup = async (request: Request, env: Env): Promise<Response> => {
  if (await ownerExists(env)) {
    return html(setupPage("An owner account already exists. First-owner setup is locked."), {
      status: 409,
      headers: { "set-cookie": clearSetupCookie() },
    });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  if (!code || !state || !(await validateSetupState(request, state, env.SETUP_KEY))) {
    return html(setupPage("Discord verification could not be validated. Please start again."), {
      status: 400,
      headers: { "set-cookie": clearSetupCookie() },
    });
  }

  try {
    const token = await exchangeDiscordCode(code, env);
    const discordUser = await fetchDiscordUser(token.access_token);
    const displayName = discordUser.global_name || discordUser.username;
    const publicId = crypto.randomUUID();
    const auditId = crypto.randomUUID();

    const existingIdentity = await env.DB.prepare(
      "SELECT id FROM account_identities WHERE provider = 'discord' AND provider_subject = ? LIMIT 1",
    )
      .bind(discordUser.id)
      .first<{ id: number }>();

    if (existingIdentity) {
      return html(setupPage("That Discord account is already linked to this installation."), {
        status: 409,
        headers: { "set-cookie": clearSetupCookie() },
      });
    }

    const insertAccount = env.DB.prepare(
      `INSERT INTO accounts
        (public_id, display_name, is_active, is_owner, approval_status, approved_at)
       VALUES (?, ?, 1, 1, 'active', CURRENT_TIMESTAMP)`,
    ).bind(publicId, displayName);

    const accountResult = await insertAccount.run();
    const accountId = Number(accountResult.meta.last_row_id);

    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO account_identities
          (account_id, provider, provider_subject, provider_username)
         VALUES (?, 'discord', ?, ?)`,
      ).bind(accountId, discordUser.id, discordUser.username),
      env.DB.prepare(
        `INSERT INTO audit_log
          (public_id, actor_account_id, actor_display_name, action, entity_type, entity_id, source, new_values)
         VALUES (?, ?, ?, 'owner.created', 'account', ?, 'discord-oauth', ?)`,
      ).bind(
        auditId,
        accountId,
        displayName,
        publicId,
        JSON.stringify({ discordUserId: discordUser.id, owner: true, approvalStatus: "active" }),
      ),
    ]);

    return html(setupDonePage(displayName), {
      headers: { "set-cookie": clearSetupCookie() },
    });
  } catch (error) {
    console.error("Discord owner bootstrap failed", error);
    return html(setupPage("Discord verification failed. Please try again."), {
      status: 502,
      headers: { "set-cookie": clearSetupCookie() },
    });
  }
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return json({
        name: "Alliance Platform",
        status: "ok",
        version: "0.1.0",
      });
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({
        status: "ok",
        service: "worker",
        timestamp: new Date().toISOString(),
      });
    }

    if (request.method === "GET" && url.pathname === "/api/health/db") {
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

    if (request.method === "GET" && url.pathname === "/api/alliance") {
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

    if (request.method === "GET" && url.pathname === "/api/setup/status") {
      try {
        const settings = await getSettings(env, [
          "setup_complete",
          "schema_version",
          "alliance_timezone",
        ]);
        const owner = await env.DB.prepare(
          "SELECT id FROM accounts WHERE is_owner = 1 AND is_active = 1 LIMIT 1",
        ).first<{ id: number }>();

        const complete = settings.setup_complete === "true" && Boolean(owner);

        return json({
          setupComplete: complete,
          ownerAccountExists: Boolean(owner),
          schemaVersion: Number(settings.schema_version ?? "0"),
          timezone: settings.alliance_timezone ?? "UTC",
          nextStep: complete ? null : owner ? "configure-alliance" : "create-owner",
        });
      } catch (error) {
        console.error("Setup status lookup failed", error);
        return json({ error: "Unable to determine setup status" }, { status: 500 });
      }
    }

    if (request.method === "GET" && url.pathname === "/setup") {
      if (await ownerExists(env)) {
        return html(setupPage("An owner account already exists. First-owner setup is locked."), { status: 409 });
      }
      return html(setupPage());
    }

    if (request.method === "POST" && url.pathname === "/setup/discord/start") {
      return beginDiscordSetup(request, env);
    }

    if (request.method === "GET" && url.pathname === "/auth/discord/callback") {
      return finishDiscordSetup(request, env);
    }

    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    return json({ error: "Not found" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
