const apiOrigin = __TYPEDASH_API_ORIGIN__;

const errorHeaders = {
  'Content-Type': 'application/json',
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    // The upstream is build-time configuration, never a client-supplied URL.
    const upstreamUrl = new URL(url.pathname + url.search, apiOrigin);
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('x-forwarded-for');
    headers.delete('x-real-ip');
    headers.delete('forwarded');
    try {
      const upstream = await fetch(new Request(upstreamUrl, request), {
        headers, redirect: 'manual',
        signal: AbortSignal.timeout(60000),
        cf: { cacheTtl: 0, cacheEverything: false },
      });
      if (upstream.status === 101) return upstream;
      const response = new Response(upstream.body, upstream);
      response.headers.set('Cache-Control', 'private, no-store');
      // Streaming preserves multiple Set-Cookie headers and bounded memory.
      return response;
    } catch {
      return new Response(JSON.stringify({error: {
        code: 'backend_unavailable', message: 'The backend is unavailable. Please retry.',
      }}), {status: 502, headers: errorHeaders});
    }
  },
};
