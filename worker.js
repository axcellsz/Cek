export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Helper buat response JSON
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: {
          "content-type": "application/json;charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
      });

    /* =====================================================
       API: Cek Kuota
    ====================================================== */
    if (pathname === "/api/cek-kuota") {
      const msisdn = url.searchParams.get("msisdn");

      if (!msisdn) {
        return json(
          { status: false, message: "Parameter msisdn wajib diisi" },
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
        return json(
          {
            status: false,
            message: "Gagal menghubungi API upstream",
            error: err.message,
          },
          500
        );
      }
    }

    /* =====================================================
       API: AUTH REGISTER
       POST /api/auth/register
       body: { name, whatsapp, password, xl }
    ====================================================== */
    if (pathname === "/api/auth/register" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json(
          { status: false, message: "Body harus JSON" },
          400
        );
      }

      const name = (body.name || "").trim();
      const whatsapp = (body.whatsapp || "").trim();
      const password = (body.password || "").trim();
      const xl = (body.xl || "").trim();

      if (!name || !whatsapp || !password || !xl) {
        return json(
          { status: false, message: "Semua field wajib diisi" },
          400
        );
      }

      // key utama pakai nomor WA
      const keyByWa = `wa:${whatsapp}`;
      const keyByName = `name:${name.toLowerCase()}`;

      // cek kalau nomor WA sudah terdaftar
      const existing = await env.USER_VPN.get(keyByWa);
      if (existing) {
        return json(
          { status: false, message: "Nomor WhatsApp sudah terdaftar" },
          409
        );
      }

      const userData = {
        name,
        whatsapp,
        xl,
        password, // NOTE: masih plain text; kalau mau lebih aman bisa di-hash
        createdAt: new Date().toISOString(),
      };

      // simpan dua index: by WA dan by nama
      await env.USER_VPN.put(keyByWa, JSON.stringify(userData));
      await env.USER_VPN.put(keyByName, JSON.stringify(userData));

      return json({
        status: true,
        message: "Registrasi berhasil",
        data: { name, whatsapp, xl },
      });
    }

    /* =====================================================
       API: AUTH LOGIN
       POST /api/auth/login
       body: { identifier, password }
       identifier = nama ATAU no WhatsApp
    ====================================================== */
    if (pathname === "/api/auth/login" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json(
          { status: false, message: "Body harus JSON" },
          400
        );
      }

      const identifier = (body.identifier || "").trim();
      const password = (body.password || "").trim();

      if (!identifier || !password) {
        return json(
          {
            status: false,
            message: "Nama / No WhatsApp dan password wajib diisi",
          },
          400
        );
      }

      // coba ambil by WA dulu
      let user = await env.USER_VPN.get(`wa:${identifier}`, "json");

      // kalau tidak ada, coba by nama (lowercase)
      if (!user) {
        user = await env.USER_VPN.get(
          `name:${identifier.toLowerCase()}`,
          "json"
        );
      }

      if (!user) {
        return json(
          { status: false, message: "Akun tidak ditemukan" },
          404
        );
      }

      if (user.password !== password) {
        return json(
          { status: false, message: "Password salah" },
          401
        );
      }

      // sukses login
      return json({
        status: true,
        message: "Login berhasil",
        data: {
          name: user.name,
          whatsapp: user.whatsapp,
          xl: user.xl,
        },
      });
    }

    /* =====================================================
       STATIC ASSETS (HTML, CSS, JS, dll)
    ====================================================== */
    try {
      // semua path lain di-handle oleh asset binding (public)
      return await env.ASSETS.fetch(request);
    } catch (e) {
      // fallback ke /
      const fallbackUrl = new URL("/", request.url);
      const fallbackRequest = new Request(fallbackUrl.toString(), request);
      return await env.ASSETS.fetch(fallbackRequest);
    }
  },
};
