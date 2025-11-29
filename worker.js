export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // --- Contoh API route (opsional) ---
    if (url.pathname.startsWith("/api/hello")) {
      return new Response(
        JSON.stringify({ message: "Hello from cek_kuota_vpn" }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }

    // --- Static file dari folder public ---
    try {
      // Coba layani file persis sesuai path
      return await env.ASSETS.fetch(request);
    } catch (e) {
      // Kalau 404 (misalnya SPA), fallback ke / (index.html)
      const fallbackUrl = new URL("/", request.url);
      const fallbackRequest = new Request(fallbackUrl.toString(), request);
      return await env.ASSETS.fetch(fallbackRequest);
    }
  },
};
