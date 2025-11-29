export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ==========================
    // Helper response JSON + CORS
    // ==========================
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: {
          "content-type": "application/json;charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        },
      });

    // ==========================
    // Handle OPTIONS (preflight)
    // ==========================
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        },
      });
    }

    // ==========================
    // API: Cek Kuota
    // ==========================
    if (url.pathname === "/api/cek-kuota") {
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

    // ==========================
    // API: Auth Register
    // ==========================
    if (url.pathname === "/api/auth/register" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json(
          { status: false, message: "Body harus JSON." },
          400
        );
      }

      const name = (body.name || "").trim();
      const whatsapp = (body.whatsapp || "").trim();
      const password = (body.password || "").trim();
      const xl = (body.xl || "").trim();

      if (!name || !whatsapp || !password || !xl) {
        return json(
          { status: false, message: "Semua data daftar wajib diisi." },
          400
        );
      }

      if (!env.USER_VPN) {
        return json(
          {
            status: false,
            message:
              "Binding KV USER_VPN tidak ditemukan. Cek pengaturan Worker.",
          },
          500
        );
      }

      // Normalisasi WA agar konsisten
      const normWa = normalizePhone(whatsapp);
      const keyWa = `wa:${normWa}`;
      const keyName = `name:${name.toLowerCase()}`;

      // Cek duplikat by WA
      const existingByWa = await env.USER_VPN.get(keyWa);
      if (existingByWa) {
        return json(
          { status: false, message: "Nomor WhatsApp sudah terdaftar." },
          409
        );
      }

      // Opsional: cek duplikat by name
      const existingByName = await env.USER_VPN.get(keyName);
      if (existingByName) {
        return json(
          { status: false, message: "Nama sudah terdaftar, gunakan nama lain." },
          409
        );
      }

      const userData = {
        name,
        whatsapp: normWa,
        password, // NOTE: untuk demo saja; produksi sebaiknya di-hash
        xl,
        createdAt: new Date().toISOString(),
      };

      const value = JSON.stringify(userData);

      await env.USER_VPN.put(keyWa, value);
      await env.USER_VPN.put(keyName, value);

      return json({
        status: true,
        message: "Pendaftaran berhasil.",
        data: userData,
      });
    }

    // ==========================
    // API: Auth Login
    // ==========================
    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json(
          { status: false, message: "Body harus JSON." },
          400
        );
      }

      const identifier = (body.identifier || "").trim();
      const password = (body.password || "").trim();

      if (!identifier || !password) {
        return json(
          {
            status: false,
            message: "Nama / No WhatsApp dan password wajib diisi.",
          },
          400
        );
      }

      if (!env.USER_VPN) {
        return json(
          {
            status: false,
            message:
              "Binding KV USER_VPN tidak ditemukan. Cek pengaturan Worker.",
          },
          500
        );
      }

      // Coba cari sebagai WA dulu
      const normWa = normalizePhone(identifier);
      const keyWa = `wa:${normWa}`;
      let raw = await env.USER_VPN.get(keyWa);

      // Kalau tidak ketemu, coba sebagai nama
      if (!raw) {
        const keyName = `name:${identifier.toLowerCase()}`;
        raw = await env.USER_VPN.get(keyName);
      }

      if (!raw) {
        return json(
          { status: false, message: "Akun tidak ditemukan." },
          404
        );
      }

      let user;
      try {
        user = JSON.parse(raw);
      } catch {
        return json(
          { status: false, message: "Data akun rusak di server." },
          500
        );
      }

      if (user.password !== password) {
        return json(
          { status: false, message: "Password salah." },
          401
        );
      }

      return json({
        status: true,
        message: "Login berhasil.",
        data: {
          name: user.name,
          whatsapp: user.whatsapp,
          xl: user.xl,
        },
      });
    }

    // ==========================
    // Static assets (HTML, CSS, JS)
    // ==========================
    try {
      return await env.ASSETS.fetch(request);
    } catch (e) {
      const fallbackUrl = new URL("/", request.url);
      const fallbackRequest = new Request(fallbackUrl.toString(), request);
      return await env.ASSETS.fetch(fallbackRequest);
    }
  },
};

/**
 * Normalisasi nomor HP:
 *  - "+628123" -> "08123"
 *  - "628123"  -> "08123"
 *  - "08123"   -> "08123"
 */
function normalizePhone(num) {
  if (!num) return "";
  let s = String(num).trim();
  if (s.startsWith("+62")) return "0" + s.slice(3);
  if (s.startsWith("62")) return "0" + s.slice(2);
  return s;
}
