export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { USER_VPN } = env;

    // ===========================================
    // Helper response JSON
    // ===========================================
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), {
        status,
        headers: {
          "content-type": "application/json;charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
      });

    // ===========================================
    // 1) REGISTER: POST /api/auth/register
    // ===========================================
    if (url.pathname === "/api/auth/register" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json(
          { ok: false, status: false, message: "Body harus JSON." },
          400,
        );
      }

      const name = (body.name || "").trim();
      const whatsapp = (body.whatsapp || "").trim();
      const password = (body.password || "").trim();
      const xl = (body.xl || "").trim();

      if (!name || !whatsapp || !password || !xl) {
        return json(
          {
            ok: false,
            status: false,
            message: "Semua data daftar wajib diisi.",
          },
          400,
        );
      }

      const key = "user:" + whatsapp;
      const exist = await USER_VPN.get(key);
      if (exist) {
        return json(
          {
            ok: false,
            status: false,
            message: "No WhatsApp sudah terdaftar.",
          },
          400,
        );
      }

      // hash password
      const enc = new TextEncoder();
      const digest = await crypto.subtle.digest(
        "SHA-256",
        enc.encode(password),
      );
      const hashArr = Array.from(new Uint8Array(digest));
      const hashHex = hashArr.map((b) => b.toString(16).padStart(2, "0")).join(
        "",
      );

      const user = {
        name,
        whatsapp,
        password: hashHex,
        xl,
        createdAt: new Date().toISOString(),
      };

      await USER_VPN.put(key, JSON.stringify(user));

      return json({
        ok: true,
        status: true,
        message: "Pendaftaran berhasil.",
        data: user,
      });
    }

    // ===========================================
    // 2) LOGIN: POST /api/auth/login
    // ===========================================
    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json(
          { ok: false, status: false, message: "Body harus JSON." },
          400,
        );
      }

      // Bisa kirim: { identifier, password }
      // atau { whatsapp, password } atau { name, password }
      const identifier = (
        body.identifier ||
        body.whatsapp ||
        body.name ||
        ""
      ).trim();
      const password = (body.password || "").trim();

      // >>> Pesan ini yang muncul di alert <<<
      if (!identifier || !password) {
        return json(
          {
            ok: false,
            status: false,
            message: "Nama/No WhatsApp dan password wajib diisi.",
          },
          400,
        );
      }

      // Di KV kita menyimpan key "user:<whatsapp>"
      // anggap identifier = no WhatsApp yang dipakai saat daftar
      const key = "user:" + identifier;
      const stored = await USER_VPN.get(key);

      if (!stored) {
        return json(
          {
            ok: false,
            status: false,
            message: "User tidak ditemukan.",
          },
          404,
        );
      }

      const user = JSON.parse(stored);

      // hash password input lalu bandingkan
      const enc = new TextEncoder();
      const digest = await crypto.subtle.digest(
        "SHA-256",
        enc.encode(password),
      );
      const hashArr = Array.from(new Uint8Array(digest));
      const hashHex = hashArr.map((b) => b.toString(16).padStart(2, "0")).join(
        "",
      );

      if (hashHex !== user.password) {
        return json(
          { ok: false, status: false, message: "Password salah." },
          401,
        );
      }

      return json({
        ok: true,
        status: true,
        message: "Login berhasil.",
        data: {
          name: user.name,
          whatsapp: user.whatsapp,
          xl: user.xl,
        },
      });
    }

    // ===========================================
    // 3) CEK KUOTA: /api/cek-kuota?msisdn=...
    //    (bagian ini sama seperti versi lu sebelumnya)
    // ===========================================
    if (url.pathname === "/api/cek-kuota") {
      const msisdn = url.searchParams.get("msisdn");

      if (!msisdn) {
        return json(
          {
            ok: false,
            message: "Parameter msisdn wajib diisi",
          },
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

    // ===========================================
    // 4) Static file dari folder public
    // ===========================================
    try {
      return await env.ASSETS.fetch(request);
    } catch (e) {
      const fallbackUrl = new URL("/", request.url);
      const fallbackRequest = new Request(fallbackUrl.toString(), request);
      return await env.ASSETS.fetch(fallbackRequest);
    }
  },
};
