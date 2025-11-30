export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // ======= API: REGISTER USER =======
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

    // ======= API: LOGIN USER =======
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

        // ambil user dari KV berdasarkan nomor WA
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

    // ======= API: LIST SEMUA USER =======
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

    // ======= API: FOTO PROFIL (GET / POST) =======
    // GET  /api/profile-photo?whatsapp=08xxxx
    if (pathname === "/api/profile-photo" && request.method === "GET") {
      const wa = url.searchParams.get("whatsapp");
      if (!wa) {
        return json({ ok: false, message: "whatsapp wajib diisi" }, 400);
      }

      try {
        const key = "pfp:" + wa;
        const value = await env.PROFILE_PIC.get(key);

        // kalau belum ada, tetap ok, tapi image = null
        return json({ ok: true, image: value || null });
      } catch (e) {
        return json(
          { ok: false, message: "Error get photo: " + e.message },
          500
        );
      }
    }

    // POST /api/profile-photo
    // body: { whatsapp, image } ATAU { whatsapp, imageData }
    if (pathname === "/api/profile-photo" && request.method === "POST") {
      try {
        const body = await request.json();

        // front-end kirim imageData, tapi kita juga dukung image
        let { whatsapp, image, imageData } = body;
        whatsapp = whatsapp && String(whatsapp).trim();

        let finalImage = imageData || image;

        if (!whatsapp || !finalImage) {
          return json(
            { ok: false, message: "whatsapp dan image wajib diisi" },
            400
          );
        }

        // kalau belum ada prefix data: tambahkan
        if (!finalImage.startsWith("data:")) {
          finalImage = "data:image/jpeg;base64," + finalImage;
        }

        const key = "pfp:" + whatsapp;
        // PUT selalu overwrite, jadi foto lama diganti foto baru
        await env.PROFILE_PIC.put(key, finalImage);

        return json({ ok: true, message: "Foto tersimpan" });
      } catch (e) {
        return json(
          { ok: false, message: "Error save photo: " + e.message },
          500
        );
      }
    }

    // ======= API: CEK KUOTA =======
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

    // ======= SERVE FILE STATIC =======
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
