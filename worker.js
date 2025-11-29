export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ==============================
    // 1) AUTH: REGISTER USER
    // ==============================
    if (path === "/api/auth/register" && request.method === "POST") {
      return registerUser(request, env);
    }

    // ==============================
    // 2) AUTH: LOGIN USER
    // ==============================
    if (path === "/api/auth/login" && request.method === "POST") {
      return loginUser(request, env);
    }

    // ==============================
    // 3) API PROXY: /api/cek-kuota
    // ==============================
    if (path === "/api/cek-kuota") {
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

    // ==============================
    // 4) STATIC FILES (ASSETS)
    // ==============================
    try {
      return await env.ASSETS.fetch(request);
    } catch (e) {
      // fallback ke index.html ("/")
      const fallbackUrl = new URL("/", request.url);
      const fallbackRequest = new Request(fallbackUrl.toString(), request);
      return await env.ASSETS.fetch(fallbackRequest);
    }
  },
};

//
// ================================
// FUNGSI REGISTER
// ================================
async function registerUser(request, env) {
  try {
    const body = await request.json();

    const name = (body.name || "").trim();
    const whatsapp = (body.whatsapp || "").trim();
    const password = (body.password || "").trim();
    const xl = (body.xl || "").trim();

    if (!name || !whatsapp || !password || !xl) {
      return json(
        { status: false, message: "Semua data wajib diisi." },
        400
      );
    }

    // cek apakah WA sudah terdaftar
    const exists = await env.USER_VPN.get("user:wa:" + whatsapp);
    if (exists) {
      return json(
        { status: false, message: "Nomor WhatsApp sudah terdaftar!" },
        409
      );
    }

    const userData = {
      name,
      whatsapp,
      password, // NOTE: belum di-hash (boleh kita upgrade nanti)
      xl,
      createdAt: new Date().toISOString(),
    };

    // simpan user berdasarkan WA & nama
    await env.USER_VPN.put("user:wa:" + whatsapp, JSON.stringify(userData));
    await env.USER_VPN.put(
      "user:name:" + name.toLowerCase(),
      JSON.stringify(userData)
    );

    return json({
      status: true,
      message: "Registrasi berhasil!",
    });
  } catch (err) {
    return json(
      { status: false, message: "Error: " + err.message },
      500
    );
  }
}

//
// ================================
// FUNGSI LOGIN
// ================================
async function loginUser(request, env) {
  try {
    const body = await request.json();

    const identifier = (body.identifier || "").trim(); // nama atau no WA
    const password = (body.password || "").trim();

    if (!identifier || !password) {
      return json(
        { status: false, message: "Lengkapi semua data login." },
        400
      );
    }

    // cari berdasarkan WA dulu
    let userStr = await env.USER_VPN.get("user:wa:" + identifier);

    // kalau tidak ada, cari berdasarkan nama (lowercase)
    if (!userStr) {
      userStr = await env.USER_VPN.get(
        "user:name:" + identifier.toLowerCase()
      );
    }

    if (!userStr) {
      return json(
        { status: false, message: "Akun tidak ditemukan." },
        404
      );
    }

    const user = JSON.parse(userStr);

    if (user.password !== password) {
      return json(
        { status: false, message: "Password salah!" },
        401
      );
    }

    // sukses
    return json({
      status: true,
      message: "Login berhasil!",
      data: {
        name: user.name,
        whatsapp: user.whatsapp,
        xl: user.xl,
      },
    });
  } catch (err) {
    return json(
      { status: false, message: "Error: " + err.message },
      500
    );
  }
}

//
// ================================
// HELPER RESPONSE JSON + CORS
// ================================
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json;charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
