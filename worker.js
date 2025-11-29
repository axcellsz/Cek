export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // === API PROXY: /api/cek-kuota?msisdn=... ===
    if (url.pathname === "/api/cek-kuota") {
      const msisdn = url.searchParams.get("msisdn");

      if (!msisdn) {
        return new Response(
          JSON.stringify({ ok: false, message: "Parameter msisdn wajib diisi" }),
          {
            status: 400,
            headers: {
              "content-type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      }

      const upstreamUrl =
        "https://apigw.kmsp-store.com/sidompul/v4/cek_kuota" +
        `?msisdn=${encodeURIComponent(msisdn)}&isJSON=true`;

      try {
        const upstreamRes = await fetch(upstreamUrl, {
          method: "GET",
          headers: {
            Authorization: `Basic ${env.AUTH_BASIC}`,
            "X-API-Key": env.X_API_KEY,
            "X-App-Version": env.X_APP_VERSION,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });

        const bodyText = await upstreamRes.text();

        return new Response(bodyText, {
          status: upstreamRes.status,
          headers: {
            "content-type":
              upstreamRes.headers.get("content-type") ||
              "application/json;charset=utf-8",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (err) {
        return new Response(
          JSON.stringify({
            ok: false,
            message: "Gagal menghubungi API upstream",
            error: err.message,
          }),
          {
            status: 500,
            headers: {
              "content-type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      }
    }

    // === Static file dari folder public ===
    try {
      return await env.ASSETS.fetch(request);
    } catch (e) {
      const fallbackUrl = new URL("/", request.url);
      const fallbackRequest = new Request(fallbackUrl.toString(), request);
      return await env.ASSETS.fetch(fallbackRequest);
    }
  },
};
