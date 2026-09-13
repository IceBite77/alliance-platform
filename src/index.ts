export interface Env {
  DB: D1Database;
  APP_URL: string;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  SETUP_KEY: string;
  AUTH_SECRET: string;
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

type AccountRow = {
  id: number;
  public_id: string;
  display_name: string;
  is_active: number;
  is_owner: number;
  approval_status: string;
};

const DISCORD_API = "https://discord.com/api/v10";
const SETUP_COOKIE = "ap_setup_oauth";
const LOGIN_COOKIE = "ap_login_oauth";
const SESSION_COOKIE = "ap_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 14;

const json = (data: unknown, init: ResponseInit = {}): Response => {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data, null, 2), { ...init, headers });
};

const html = (body: string, init: ResponseInit = {}): Response => {
  const headers = new Headers(init.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "no-referrer");
  return new Response(body, { ...init, headers });
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
  const result = await env.DB.prepare(`SELECT key, value FROM settings WHERE key IN (${placeholders})`)
    .bind(...keys)
    .all<SettingRow>();
  return Object.fromEntries((result.results ?? []).map((row) => [row.key, row.value]));
};

const ownerExists = async (env: Env): Promise<boolean> => {
  const owner = await env.DB.prepare("SELECT id FROM accounts WHERE is_owner = 1 LIMIT 1").first<{ id: number }>();
  return Boolean(owner);
};

const escapeHtml = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

const shellStyles = `:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at top,#17243d 0,#0c1220 45%,#090e18 100%);color:#eef3ff;padding:24px}main{width:min(94vw,620px);background:#151d2e;border:1px solid #2b3850;border-radius:20px;padding:30px;box-shadow:0 24px 70px rgba(0,0,0,.35)}h1{margin:0 0 10px;font-size:1.8rem}h2{margin:26px 0 8px;font-size:1.1rem}p{color:#b8c4d9;line-height:1.55}.small{font-size:.9rem;color:#90a0bb}.notice{margin:16px 0 0;padding:12px 14px;border-radius:10px;background:#24191c;color:#ffd5dc}.success{background:#14251d;color:#baf4cf}.card{margin-top:18px;padding:16px;border-radius:14px;background:#0e1626;border:1px solid #2b3850}.row{display:flex;justify-content:space-between;gap:18px;padding:7px 0;border-bottom:1px solid #223047}.row:last-child{border-bottom:0}.muted{color:#90a0bb}.button,button{display:inline-block;width:100%;margin-top:16px;padding:13px 16px;border:0;border-radius:11px;background:#5865f2;color:white;text-decoration:none;text-align:center;font-size:1rem;font-weight:800;cursor:pointer}.button.secondary{background:#26344d}label{display:block;margin:22px 0 8px;font-weight:700}input{width:100%;padding:13px 14px;border-radius:10px;border:1px solid #3a4964;background:#0e1626;color:white;font-size:1rem}`;

const setupPage = (message?: string): string => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Alliance Platform Setup</title><style>${shellStyles}</style></head><body><main><h1>Create the first owner</h1><p>Enter the one-time setup key stored in Cloudflare. You will then be sent to Discord to verify your identity.</p>${message ? `<div class="notice">${escapeHtml(message)}</div>` : ""}<form method="post" action="/setup/discord/start" autocomplete="off"><label for="setup_key">Setup key</label><input id="setup_key" name="setup_key" type="password" required autocomplete="off"><button type="submit">Verify with Discord</button></form><p class="small">The setup key is never stored in the database or written to application logs.</p></main></body></html>`;

const setupDonePage = (name: string): string => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Owner Connected</title><style>${shellStyles}</style></head><body><main><h1>Discord owner verified</h1><p><strong>${escapeHtml(name)}</strong> is now the installation owner.</p><div class="notice success">Owner account created and secure session started.</div><a class="button" href="/setup/alliance">Continue to alliance setup</a></main></body></html>`;

const loginPage = (message?: string): string => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in</title><style>${shellStyles}</style></head><body><main><h1>Alliance Platform</h1><p>Sign in with Discord to continue.</p>${message ? `<div class="notice">${escapeHtml(message)}</div>` : ""}<a class="button" href="/auth/discord">Sign in with Discord</a></main></body></html>`;

const allianceSetupPage = (account: AccountRow, alliance: AllianceRow | null, timezone: string): string => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Set Up Your Alliance</title><style>${shellStyles}</style></head><body><main><h1>Set Up Your Alliance</h1><p>Signed in securely as <strong>${escapeHtml(account.display_name)}</strong>. Discord login and owner protection are working.</p><div class="notice success">Authentication complete ✓</div><div class="card"><div class="row"><span class="muted">Alliance</span><strong>${escapeHtml(alliance?.name ?? "My Alliance")}</strong></div><div class="row"><span class="muted">Tag</span><strong>${escapeHtml(alliance?.tag ?? "Not set")}</strong></div><div class="row"><span class="muted">Timezone</span><strong>${escapeHtml(timezone)}</strong></div><div class="row"><span class="muted">Owner</span><strong>${escapeHtml(account.display_name)}</strong></div></div><h2>Next stage</h2><p>We'll turn this into the short setup form for alliance name, tag, timezone and Discord server connection. Nothing DUCK-specific will be hard-coded, so the installation remains easy to move or reuse later.</p><a class="button secondary" href="/auth/logout">Sign out</a></main></body></html>`;

const sha256 = async (value: string): Promise<Uint8Array> => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));

const constantTimeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
};

const secureStringEqual = async (a: string, b: string): Promise<boolean> => constantTimeEqual(await sha256(a), await sha256(b));

const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};

const randomToken = (bytes = 32): string => {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return bytesToBase64Url(value);
};

const hashToken = async (token: string): Promise<string> => bytesToBase64Url(await sha256(token));

const signState = async (state: string, secret: string): Promise<string> => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
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

const clearCookie = (name: string): string => `${name}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
const oauthCookie = (name: string, value: string): string => `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`;
const sessionCookie = (token: string): string => `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}`;

const validateState = async (request: Request, cookieName: string, state: string, secret: string): Promise<boolean> => {
  const cookie = readCookie(request, cookieName);
  if (!cookie) return false;
  const separator = cookie.lastIndexOf(".");
  if (separator <= 0) return false;
  const cookieState = cookie.slice(0, separator);
  const cookieSignature = cookie.slice(separator + 1);
  if (!(await secureStringEqual(cookieState, state))) return false;
  const expected = await signState(cookieState, secret);
  return secureStringEqual(cookieSignature, expected);
};

const discordAuthorizeUrl = (env: Env, state: string): string => {
  const authorize = new URL("https://discord.com/oauth2/authorize");
  authorize.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", `${env.APP_URL}/auth/discord/callback`);
  authorize.searchParams.set("scope", "identify");
  authorize.searchParams.set("state", state);
  return authorize.toString();
};

const exchangeDiscordCode = async (code: string, env: Env): Promise<DiscordTokenResponse> => {
  const body = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: `${env.APP_URL}/auth/discord/callback`,
  });
  const response = await fetch(`${DISCORD_API}/oauth2/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) throw new Error(`Discord token exchange failed with ${response.status}`);
  return response.json<DiscordTokenResponse>();
};

const fetchDiscordUser = async (accessToken: string): Promise<DiscordUser> => {
  const response = await fetch(`${DISCORD_API}/users/@me`, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Discord user lookup failed with ${response.status}`);
  return response.json<DiscordUser>();
};

const createSession = async (request: Request, env: Env, accountId: number): Promise<string> => {
  const token = randomToken();
  const tokenHash = await hashToken(token);
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP OR revoked_at IS NOT NULL").run();
  await env.DB.prepare("INSERT INTO sessions (token_hash, account_id, expires_at, user_agent) VALUES (?, ?, datetime('now', '+14 days'), ?)")
    .bind(tokenHash, accountId, userAgent)
    .run();
  return token;
};

const currentAccount = async (request: Request, env: Env): Promise<AccountRow | null> => {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await hashToken(token);
  const account = await env.DB.prepare(`
    SELECT a.id, a.public_id, a.display_name, a.is_active, a.is_owner, a.approval_status
    FROM sessions s
    JOIN accounts a ON a.id = s.account_id
    WHERE s.token_hash = ?
      AND s.revoked_at IS NULL
      AND s.expires_at > CURRENT_TIMESTAMP
      AND a.is_active = 1
      AND a.approval_status = 'active'
    LIMIT 1
  `).bind(tokenHash).first<AccountRow>();
  if (account) await env.DB.prepare("UPDATE sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE token_hash = ?").bind(tokenHash).run();
  return account ?? null;
};

const beginDiscordSetup = async (request: Request, env: Env): Promise<Response> => {
  if (await ownerExists(env)) return html(setupPage("An owner account already exists. First-owner setup is locked."), { status: 409 });
  const form = await request.formData();
  const submittedKey = String(form.get("setup_key") ?? "");
  if (!submittedKey || !(await secureStringEqual(submittedKey, env.SETUP_KEY))) return html(setupPage("That setup key is not valid."), { status: 403 });
  const state = randomToken(24);
  const signature = await signState(state, env.SETUP_KEY);
  return redirect(discordAuthorizeUrl(env, state), { "set-cookie": oauthCookie(SETUP_COOKIE, `${state}.${signature}`) });
};

const beginDiscordLogin = async (env: Env): Promise<Response> => {
  if (!(await ownerExists(env))) return redirect("/setup");
  const state = randomToken(24);
  const signature = await signState(state, env.AUTH_SECRET);
  return redirect(discordAuthorizeUrl(env, state), { "set-cookie": oauthCookie(LOGIN_COOKIE, `${state}.${signature}`) });
};

const finishDiscordSetup = async (request: Request, env: Env, code: string, state: string): Promise<Response> => {
  if (await ownerExists(env)) return html(setupPage("An owner account already exists. First-owner setup is locked."), { status: 409, headers: { "set-cookie": clearCookie(SETUP_COOKIE) } });
  if (!code || !state || !(await validateState(request, SETUP_COOKIE, state, env.SETUP_KEY))) return html(setupPage("Discord verification could not be validated. Please start again."), { status: 400, headers: { "set-cookie": clearCookie(SETUP_COOKIE) } });

  try {
    const token = await exchangeDiscordCode(code, env);
    const discordUser = await fetchDiscordUser(token.access_token);
    const displayName = discordUser.global_name || discordUser.username;
    const publicId = crypto.randomUUID();
    const auditId = crypto.randomUUID();
    const existingIdentity = await env.DB.prepare("SELECT id FROM account_identities WHERE provider = 'discord' AND provider_subject = ? LIMIT 1").bind(discordUser.id).first<{ id: number }>();
    if (existingIdentity) return html(setupPage("That Discord account is already linked to this installation."), { status: 409, headers: { "set-cookie": clearCookie(SETUP_COOKIE) } });

    const accountResult = await env.DB.prepare("INSERT INTO accounts (public_id, display_name, is_active, is_owner, approval_status, approved_at) VALUES (?, ?, 1, 1, 'active', CURRENT_TIMESTAMP)").bind(publicId, displayName).run();
    const accountId = Number(accountResult.meta.last_row_id);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO account_identities (account_id, provider, provider_subject, provider_username) VALUES (?, 'discord', ?, ?)").bind(accountId, discordUser.id, discordUser.username),
      env.DB.prepare("INSERT INTO audit_log (public_id, actor_account_id, actor_display_name, action, entity_type, entity_id, source, new_values) VALUES (?, ?, ?, 'owner.created', 'account', ?, 'discord-oauth', ?)").bind(auditId, accountId, displayName, publicId, JSON.stringify({ discordUserId: discordUser.id, owner: true, approvalStatus: "active" })),
    ]);
    const sessionToken = await createSession(request, env, accountId);
    const headers = new Headers();
    headers.append("set-cookie", clearCookie(SETUP_COOKIE));
    headers.append("set-cookie", sessionCookie(sessionToken));
    return html(setupDonePage(displayName), { headers });
  } catch (error) {
    console.error("Discord owner bootstrap failed", error);
    return html(setupPage("Discord verification failed. Please try again."), { status: 502, headers: { "set-cookie": clearCookie(SETUP_COOKIE) } });
  }
};

const finishDiscordLogin = async (request: Request, env: Env, code: string, state: string): Promise<Response> => {
  if (!code || !state || !(await validateState(request, LOGIN_COOKIE, state, env.AUTH_SECRET))) return html(loginPage("Discord sign-in could not be validated. Please try again."), { status: 400, headers: { "set-cookie": clearCookie(LOGIN_COOKIE) } });
  try {
    const token = await exchangeDiscordCode(code, env);
    const discordUser = await fetchDiscordUser(token.access_token);
    const account = await env.DB.prepare(`
      SELECT a.id, a.public_id, a.display_name, a.is_active, a.is_owner, a.approval_status
      FROM account_identities i
      JOIN accounts a ON a.id = i.account_id
      WHERE i.provider = 'discord' AND i.provider_subject = ?
      LIMIT 1
    `).bind(discordUser.id).first<AccountRow>();

    if (!account) return html(loginPage("That Discord account is not linked to this alliance yet."), { status: 403, headers: { "set-cookie": clearCookie(LOGIN_COOKIE) } });
    if (!account.is_active || account.approval_status !== "active") return html(loginPage("This account is not currently active."), { status: 403, headers: { "set-cookie": clearCookie(LOGIN_COOKIE) } });

    const displayName = discordUser.global_name || discordUser.username;
    await env.DB.batch([
      env.DB.prepare("UPDATE accounts SET display_name = ?, last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(displayName, account.id),
      env.DB.prepare("UPDATE account_identities SET provider_username = ?, updated_at = CURRENT_TIMESTAMP WHERE provider = 'discord' AND provider_subject = ?").bind(discordUser.username, discordUser.id),
    ]);

    const sessionToken = await createSession(request, env, account.id);
    const headers = new Headers();
    headers.append("set-cookie", clearCookie(LOGIN_COOKIE));
    headers.append("set-cookie", sessionCookie(sessionToken));
    return redirect(account.is_owner ? "/setup/alliance" : "/", headers);
  } catch (error) {
    console.error("Discord login failed", error);
    return html(loginPage("Discord sign-in failed. Please try again."), { status: 502, headers: { "set-cookie": clearCookie(LOGIN_COOKIE) } });
  }
};

const finishDiscordCallback = async (request: Request, env: Env): Promise<Response> => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  if (readCookie(request, LOGIN_COOKIE)) return finishDiscordLogin(request, env, code, state);
  return finishDiscordSetup(request, env, code, state);
};

const logout = async (request: Request, env: Env): Promise<Response> => {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) {
    const tokenHash = await hashToken(token);
    await env.DB.prepare("UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ?").bind(tokenHash).run();
  }
  return redirect("/login", { "set-cookie": clearCookie(SESSION_COOKIE) });
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      const account = await currentAccount(request, env);
      if (!account) return redirect((await ownerExists(env)) ? "/login" : "/setup");
      if (account.is_owner) return redirect("/setup/alliance");
      return json({ name: "Alliance Platform", status: "ok", signedInAs: account.display_name });
    }

    if (request.method === "GET" && url.pathname === "/api/health") return json({ status: "ok", service: "worker", timestamp: new Date().toISOString() });

    if (request.method === "GET" && url.pathname === "/api/health/db") {
      try {
        const result = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
        return json({ status: result?.ok === 1 ? "ok" : "error", service: "d1", timestamp: new Date().toISOString() });
      } catch (error) {
        console.error("D1 health check failed", error);
        return json({ status: "error", service: "d1", message: "Database health check failed" }, { status: 500 });
      }
    }

    if (request.method === "GET" && url.pathname === "/api/alliance") {
      try {
        const alliance = await env.DB.prepare("SELECT id, name, tag, created_at, updated_at FROM alliance WHERE id = 1").first<AllianceRow>();
        if (!alliance) return json({ error: "Alliance record not found" }, { status: 404 });
        const settings = await getSettings(env, ["alliance_timezone", "platform_name"]);
        return json({ alliance: { id: alliance.id, name: alliance.name, tag: alliance.tag, timezone: settings.alliance_timezone ?? "UTC", createdAt: alliance.created_at, updatedAt: alliance.updated_at }, platform: { name: settings.platform_name ?? "Alliance Platform" } });
      } catch (error) {
        console.error("Alliance lookup failed", error);
        return json({ error: "Unable to load alliance" }, { status: 500 });
      }
    }

    if (request.method === "GET" && url.pathname === "/api/setup/status") {
      try {
        const settings = await getSettings(env, ["setup_complete", "schema_version", "alliance_timezone"]);
        const owner = await env.DB.prepare("SELECT id FROM accounts WHERE is_owner = 1 AND is_active = 1 LIMIT 1").first<{ id: number }>();
        const complete = settings.setup_complete === "true" && Boolean(owner);
        return json({ setupComplete: complete, ownerAccountExists: Boolean(owner), schemaVersion: Number(settings.schema_version ?? "0"), timezone: settings.alliance_timezone ?? "UTC", nextStep: complete ? null : owner ? "configure-alliance" : "create-owner" });
      } catch (error) {
        console.error("Setup status lookup failed", error);
        return json({ error: "Unable to determine setup status" }, { status: 500 });
      }
    }

    if (request.method === "GET" && url.pathname === "/setup") {
      if (await ownerExists(env)) return redirect("/login");
      return html(setupPage());
    }

    if (request.method === "POST" && url.pathname === "/setup/discord/start") return beginDiscordSetup(request, env);
    if (request.method === "GET" && url.pathname === "/login") {
      const account = await currentAccount(request, env);
      return account ? redirect(account.is_owner ? "/setup/alliance" : "/") : html(loginPage());
    }
    if (request.method === "GET" && url.pathname === "/auth/discord") return beginDiscordLogin(env);
    if (request.method === "GET" && url.pathname === "/auth/discord/callback") return finishDiscordCallback(request, env);
    if (request.method === "GET" && url.pathname === "/auth/logout") return logout(request, env);

    if (request.method === "GET" && url.pathname === "/setup/alliance") {
      const account = await currentAccount(request, env);
      if (!account) return redirect("/login");
      if (!account.is_owner) return json({ error: "Owner access required" }, { status: 403 });
      const alliance = await env.DB.prepare("SELECT id, name, tag, created_at, updated_at FROM alliance WHERE id = 1").first<AllianceRow>();
      const settings = await getSettings(env, ["alliance_timezone"]);
      return html(allianceSetupPage(account, alliance ?? null, settings.alliance_timezone ?? "UTC"));
    }

    if (request.method !== "GET") return json({ error: "Method not allowed" }, { status: 405 });
    return json({ error: "Not found" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
