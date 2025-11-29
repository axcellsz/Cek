export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // Helper response JSON
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), {
        status,
        headers: {
          "content-type": "application/json;charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
      });

    // Helper hash password (harus sama dengan versi sebelumnya)
    async function hashPassword(pwd) {
      const enc = new TextEncoder().encode(pwd);
      const buf = await crypto.subtle.digest("SHA-256", enc);
      const arr = Array.from(new Uint8Array(buf));
      return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    // =====================================
    // 1) REGISTER
    // =====================================
    if (pathname === "/api/auth/register" && request.method === "POST") {
      try {
        const body = await request.json();
        const name = (body.name || "").trim();
        const whatsapp = (body.whatsapp || "").trim();
        const password = (body.password || "").trim();
        const xl = (body.xl || "").trim();

        if (!name || !whatsapp || !password || !xl) {
          return json(
            {
              status: false,
              message: "Semua data daftar wajib diisi.",
            },
            400
          );
        }

        const key = "user:" + whatsapp;
        const existing = await env.USER_VPN.get(key);
        if (existing) {
          return json(
            {
              status: false,
              message: "Nomor WhatsApp sudah terdaftar.",
            },
            400
          );
        }

        const hashed = await hashPassword(password);
        const dataToStore = {
          name,
          whatsapp,
          password: hashed,
          xl,
          createdAt: new Date().toISOString(),
        };

        await env.USER_VPN.put(key, JSON.stringify(dataToStore));

        return json({
          status: true,
          message: "Pendaftaran berhasil.",
          data: {
            name,
            whatsapp,
            xl,
            createdAt: dataToStore.createdAt,
          },
        });
      } catch (err) {
        return json(
          {
            status: false,
            message: "Gagal memproses data pendaftaran.",
            error: err.message,
          },
          500
        );
      }
    }

    // =====================================
    // 2) LOGIN
    // =====================================
    if (pathname === "/api/auth/login" && request.method === "POST") {
      try {
        const body = await request.json();
        const identifier = (body.identifier || "").trim();
        const password = (body.password || "").trim();

        if (!identifier || !password) {
          return json(
            {
              status: false,
              message: "Nama/No WhatsApp dan password wajib diisi.",
            },
            400
          );
        }

        // Untuk saat ini kita pakai identifier sebagai No WhatsApp
        const key = "user:" + identifier;
        const raw = await env.USER_VPN.get(key);
        if (!raw) {
          return json(
            {
              status: false,
              message: "User tidak ditemukan.",
            },
            404
          );
        }

        let user;
        try {
          user = JSON.parse(raw);
        } catch {
          return json(
            {
              status: false,
              message: "Data user rusak di KV.",
            },
            500
          );
        }

        const hashedInput = await hashPassword(password);
        if (!user.password || user.password !== hashedInput) {
          return json(
            {
              status: false,
              message: "Password salah.",
            },
            400
          );
        }

        return json({
          status: true,
          message: "Login berhasil.",
          data: {
            name: user.name,
            whatsapp: user.whatsapp,
            xl: user.xl,
            createdAt: user.createdAt,
          },
        });
      } catch (err) {
        return json(
          {
            status: false,
            message: "Gagal memproses data login.",
            error: err.message,
          },
          500
        );
      }
    }

    // =====================================
    // 3) LIST USER (BARU)
    // =====================================
    if (pathname === "/api/users" && request.method === "GET") {
      try {
        const list = await env.USER_VPN.list({ prefix: "user:" });
        const users = [];

        for (const item of list.keys) {
          const raw = await env.USER_VPN.get(item.name);
          if (!raw) continue;
          try {
            const u = JSON.parse(raw);
            users.push({
              name: u.name,
              whatsapp: u.whatsapp,
              xl: u.xl,
              createdAt: u.createdAt,
            });
          } catch {
            // skip jika JSON rusak
          }
        }

        // Bisa diurutkan berdasarkan createdAt (terbaru di atas)
        users.sort((a, b) => {
          const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
          const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
          return tb - ta;
        });

        return json({
          status: true,
          data: users,
        });
      } catch (err) {
        return json(
          {
            status: false,
            message: "Gagal mengambil data user.",
            error: err.message,
          },
          500
        );
      }
    }

    // =====================================
    // 4) PROXY CEK KUOTA (SAMA SEPERTI AWAL)
    // =====================================
    if (pathname === "/api/cek-kuota") {
      const msisdn = url.searchParams.get("msisdn");

      if (!msisdn) {
        return json(
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
        return json(
          {
            ok: false,
            message: "Gagal menghubungi API upstream",
            error: err.message,
          },
          500
        );
      }
    }

    // =====================================
    // 5) STATIC FILES (ASSETS)
    // =====================================
    try {
      return await env.ASSETS.fetch(request);
    } catch (e) {
      const fallbackUrl = new URL("/", request.url);
      const fallbackRequest = new Request(fallbackUrl.toString(), request);
      return await env.ASSETS.fetch(fallbackRequest);
    }
  },
};
