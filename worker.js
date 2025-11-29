export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ============================
    // CORS preflight
    // ============================
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // ============================
    // API: CEK KUOTA
    // GET /api/cek-kuota?msisdn=...
    // ============================
    if (url.pathname === "/api/cek-kuota") {
      const msisdn = url.searchParams.get("msisdn");

      if (!msisdn) {
        return jsonResponse(
          { ok: false, message: "Parameter msisdn wajib diisi" },
          400
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
        return jsonResponse(
          {
            ok: false,
            message: "Gagal menghubungi API upstream",
            error: err.message,
          },
          500
        );
      }
    }

    // ============================
    // API: REGISTER
    // POST /api/auth/register
    // body: { name, whatsapp, password, xl }
    // ============================
    if (url.pathname === "/api/auth/register" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return jsonResponse(
          { status: false, message: "Body harus JSON" },
          400
        );
      }

      const name = (body.name || "").trim();
      const whatsapp = (body.whatsapp || "").trim();
      const password = (body.password || "").trim();
      const xl = (body.xl || "").trim();

      if (!name || !whatsapp || !password || !xl) {
        return jsonResponse(
          { status: false, message: "Semua data daftar wajib diisi." },
          400
        );
      }

      // key di KV
      const keyByWa = "wa:" + whatsapp;
      const keyByName = "name:" + name.toLowerCase();

      // cek sudah ada
      const existingWa = await env.USER_VPN.get(keyByWa);
      if (existingWa) {
        return jsonResponse(
          { status: false, message: "No WhatsApp sudah terdaftar." },
          400
        );
      }

      const existingName = await env.USER_VPN.get(keyByName);
      if (existingName) {
        return jsonResponse(
          { status: false, message: "Nama sudah terdaftar." },
          400
        );
      }

      const userData = {
        name,
        whatsapp,
        password, // kalau mau aman nanti bisa di-hash
        xl,
        createdAt: new Date().toISOString(),
      };

      // simpan di 2 key: berdasarkan WA dan berdasarkan nama
      await env.USER_VPN.put(keyByWa, JSON.stringify(userData));
      await env.USER_VPN.put(keyByName, JSON.stringify(userData));

      return jsonResponse({
        status: true,
        message: "Register berhasil",
        data: { name, whatsapp, xl },
      });
    }

    // ============================
    // API: LOGIN
    // POST /api/auth/login
    // body: { identifier, password }
    // identifier = nama ATAU no WhatsApp
    // ============================
    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return jsonResponse(
          { status: false, message: "Body harus JSON" },
          400
        );
      }

      const identifier = (body.identifier || "").trim();
      const password = (body.password || "").trim();

      if (!identifier || !password) {
        return jsonResponse(
          {
            status: false,
            message: "Nama / No WhatsApp dan password wajib diisi.",
          },
          400
        );
      }

      let userJson = null;

      // kalau diawali 08 → dianggap WA
      if (identifier.startsWith("08")) {
        userJson = await env.USER_VPN.get("wa:" + identifier);
      } else {
        // dianggap nama
        userJson = await env.USER_VPN.get("name:" + identifier.toLowerCase());
      }

      if (!userJson) {
        return jsonResponse(
          { status: false, message: "Akun tidak ditemukan." },
          404
        );
      }

      const user = JSON.parse(userJson);

      if (user.password !== password) {
        return jsonResponse(
          { status: false, message: "Password salah." },
          401
        );
      }

      return jsonResponse({
        status: true,
        message: "Login berhasil",
        data: {
          name: user.name,
          whatsapp: user.whatsapp,
          xl: user.xl,
        },
      });
    }

    // ============================
    // Static file dari ASSETS
    // ============================
    try {
      return await env.ASSETS.fetch(request);
    } catch (e) {
      const fallbackUrl = new URL("/", request.url);
      const fallbackRequest = new Request(fallbackUrl.toString(), request);
      return await env.ASSETS.fetch(fallbackRequest);
    }
  },
};

// helper untuk response JSON + CORS
function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json;charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
