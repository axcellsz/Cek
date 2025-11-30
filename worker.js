export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // =====================================================
    // API: REGISTER USER
    // =====================================================
    if (pathname === "/api/auth/register" && request.method === "POST") {
      try {
        const body = await request.json();
        const { name, whatsapp, password, xl } = body;

        if (!name || !whatsapp || !password || !xl) {
          return json({ status: false, message: "Semua field wajib diisi" });
        }

        // Cek apakah nomor WA sudah ada
        const existing = await env.USER_VPN.get(whatsapp);
        if (existing) {
          return json({
            status: false,
            message: "Nomor WhatsApp sudah terdaftar",
          });
        }

        const userData = {
          name,
          whatsapp,
          password,
          xl,
          createdAt: new Date().toISOString(),
        };

        await env.USER_VPN.put(whatsapp, JSON.stringify(userData));

        return json({
          status: true,
          message: "Berhasil mendaftar",
          data: userData,
        });
      } catch (e) {
        return json({ status: false, message: "Error register: " + e.message });
      }
    }

    // =====================================================
    // API: LOGIN USER
    // =====================================================
    if (pathname === "/api/auth/login" && request.method === "POST") {
      try {
        const body = await request.json();
        const { identifier, password } = body;

        if (!identifier || !password) {
          return json({
            status: false,
            message: "Nama/No WhatsApp dan password wajib diisi.",
          });
        }

        // Sekarang backend menganggap identifier = nomor WhatsApp (key di KV)
        const raw = await env.USER_VPN.get(identifier);
        if (!raw) {
          return json({ status: false, message: "User tidak ditemukan." });
        }

        const user = JSON.parse(raw);

        if (user.password !== password) {
          return json({ status: false, message: "Password salah." });
        }

        return json({
          status: true,
          message: "Login berhasil",
          data: user,
        });
      } catch (e) {
        return json({ status: false, message: "Error login: " + e.message });
      }
    }

    // =====================================================
    // API: LIST SEMUA USER
    // =====================================================
    if (pathname === "/api/users") {
      try {
        const list = [];
        const { keys } = await env.USER_VPN.list();

        for (const key of keys) {
          const raw = await env.USER_VPN.get(key.name);
          if (raw) list.push(JSON.parse(raw));
        }

        return json({ ok: true, users: list });
      } catch (e) {
        return json({ ok: false, message: "Gagal ambil user: " + e.message });
      }
    }

    // =====================================================
    // API: PROFILE PHOTO (KV: PROFILE_PIC)
    // =====================================================
    // Kontrak:
    //  POST /api/profile-photo
    //    body JSON: { whatsapp: "08xxxx", imageData: "data:image/jpeg;base64,...." }
    //
    //  GET /api/profile-photo?whatsapp=08xxxx
    //    response: { ok: true, imageData: "data:image/jpeg;base64,...." }
    //
    // Frontend nanti bakal pakai src=imageData untuk <img>.
    // -----------------------------------------------------

    // === SIMPAN / UPDATE FOTO PROFIL ===
    if (pathname === "/api/profile-photo" && request.method === "POST") {
      try {
        const body = await request.json();
        const { whatsapp, imageData } = body || {};

        if (!whatsapp || !imageData) {
          return json(
            { ok: false, message: "whatsapp dan imageData wajib diisi" },
            400
          );
        }

        // (opsional) Batasi panjang dataURL biar nggak kebablasan besar
        // Misal: ~1MB base64 ≈ 1.3M karakter, kita batasi 2.5M karakter
        if (imageData.length > 2_500_000) {
          return json({
            ok: false,
            message: "Ukuran gambar terlalu besar setelah kompresi.",
          });
        }

        const key = `pfp:${whatsapp}`;

        // Simpan langsung sebagai string data URL di KV PROFILE_PIC
        await env.PROFILE_PIC.put(key, imageData);

        return json({ ok: true, message: "Foto profil tersimpan." });
      } catch (e) {
        return json({
          ok: false,
          message: "Gagal menyimpan foto profil: " + e.message,
        });
      }
    }

    // === AMBIL FOTO PROFIL ===
    if (pathname === "/api/profile-photo" && request.method === "GET") {
      try {
        const whatsapp = url.searchParams.get("whatsapp");
        if (!whatsapp) {
          return json(
            { ok: false, message: "Parameter whatsapp wajib diisi" },
            400
          );
        }

        const key = `pfp:${whatsapp}`;
        const imageData = await env.PROFILE_PIC.get(key);

        if (!imageData) {
          // Tidak dianggap error fatal, cuma info kalau belum ada foto
          return json({ ok: false, message: "Foto profil belum ada." }, 404);
        }

        return json({ ok: true, imageData });
      } catch (e) {
        return json({
          ok: false,
          message: "Gagal mengambil foto profil: " + e.message,
        });
      }
    }

    // =====================================================
    // API: CEK KUOTA (punya kamu, tetap sama)
    // =====================================================
    if (pathname === "/api/cek-kuota") {
      const msisdn = url.searchParams.get("msisdn");

      if (!msisdn) {
        return json({ ok: false, message: "Parameter msisdn wajib diisi" }, 400);
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

    // =====================================================
    // SERVE FILE STATIC (index.html, app.js, dll)
    // =====================================================
    try {
      return await env.ASSETS.fetch(request);
    } catch (e) {
      const fallback = new URL("/", request.url);
      return await env.ASSETS.fetch(new Request(fallback, request));
    }
  },
};

// Fungsi helper respon JSON
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
