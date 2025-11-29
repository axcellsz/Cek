export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Helper: JSON response
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), {
        status,
        headers: {
          "content-type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });

    // Helper: baca JSON body
    async function readJSON(req) {
      try {
        return await req.json();
      } catch {
        return null;
      }
    }

    // ==========================================
    // 1. REGISTER USER
    // ==========================================
    if (pathname === "/api/auth/register") {
      if (request.method !== "POST") {
        return json(
          { status: false, message: "Gunakan method POST untuk register." },
          405,
        );
      }

      const body = await readJSON(request);
      if (!body) {
        return json({ status: false, message: "Body harus JSON." }, 400);
      }

      const { name, whatsapp, password, xl } = body;

      if (!name || !whatsapp || !password || !xl) {
        return json(
          { status: false, message: "Semua data daftar wajib diisi." },
          400,
        );
      }

      const key = `user:${whatsapp}`;

      // cek apakah sudah terdaftar
      const exist = await env.USER_VPN.get(key);
      if (exist) {
        return json(
          { status: false, message: "Nomor WhatsApp sudah terdaftar." },
          400,
        );
      }

      const data = {
        name,
        whatsapp,
        password,
        xl,
        created_at: Date.now(),
      };

      await env.USER_VPN.put(key, JSON.stringify(data));

      return json({
        status: true,
        message: "Register berhasil.",
        data,
      });
    }

    // ==========================================
    // 2. LOGIN USER
    // ==========================================
    if (pathname === "/api/auth/login") {
      if (request.method !== "POST") {
        return json(
          { status: false, message: "Gunakan method POST untuk login." },
          405,
        );
      }

      const body = await readJSON(request);
      if (!body) {
        return json({ status: false, message: "Body harus JSON." }, 400);
      }

      const { username, password } = body;

      if (!username || !password) {
        return json(
          { status: false, message: "Semua field login wajib diisi." },
          400,
        );
      }

      const key = `user:${username}`;
      const raw = await env.USER_VPN.get(key);

      if (!raw) {
        return json({ status: false, message: "Akun tidak ditemukan." }, 404);
      }

      const user = JSON.parse(raw);

      if (user.password !== password) {
        return json({ status: false, message: "Password salah." }, 403);
      }

      return json({
        status: true,
        message: "Login berhasil.",
        data: user,
      });
    }

    // ==========================================
    // 3. CEK KUOTA
    // ==========================================
    if (pathname === "/api/cek-kuota") {
      const msisdn = url.searchParams.get("msisdn");

      if (!msisdn) {
        return json(
          { ok: false, message: "Parameter msisdn wajib diisi" },
          400,
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
            ok: false,
            message: "Gagal menghubungi API upstream",
            error: err.message,
          },
          500,
        );
      }
    }

    // ==========================================
    // 4. STATIC FILE
    // ==========================================
    try {
      return await env.ASSETS.fetch(request);
    } catch (e) {
      const fallbackUrl = new URL("/", request.url);
      const fallbackReq = new Request(fallbackUrl.toString(), request);
      return await env.ASSETS.fetch(fallbackReq);
    }
  },
};
