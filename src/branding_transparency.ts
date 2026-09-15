import app from "./runtime";

const TRANSPARENT_BRANDING_CSS = `<style id="ap-transparent-branding">
.brandmark.has-image{background:transparent!important;background-image:none!important;box-shadow:none!important}
.loginlogo:has(img){background:transparent!important;border-color:transparent!important}
.brandpreview:has(img){background:transparent!important}
.brandvisual.crest:has(img),.pendingbrand.crest:has(img){background:transparent!important;background-image:none!important;border-radius:0!important;box-shadow:none!important}
</style>`;

export default {
  async fetch(request: Request, env: unknown, ctx: ExecutionContext): Promise<Response> {
    const response = await (app as any).fetch(request, env, ctx);
    if (!(response instanceof Response) || !response.headers.get("content-type")?.includes("text/html")) return response;
    const html = await response.text();
    if (!html.includes("</head>")) return response;
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(html.replace("</head>", `${TRANSPARENT_BRANDING_CSS}</head>`), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
} satisfies ExportedHandler<any>;
