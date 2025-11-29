export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // =====================================================================
    // 1. ==== REGISTER USER =================================================
    // =====================================================================
    if (pathname === "/api/auth/register" && request.method === "POST") {
      try {
        const body = await request.json();
        const { name, whatsapp, password, xl } = body;

        if (!name || !whatsapp || !password || !xl) {
          return json({ ok: false, message: "Semua data daftar wajib diisi." }, 400);
        }

        const wa = whatsapp.trim();
        const key = `user:${wa}`;

        const existing = await env.USER_VPN.get(key);
        if (existing) {
          return json({ ok: false, message: "User sudah terdaftar." }, 400);
        }

        const hashed = await hashPassword(password);

        const userData = {
          name,
          whatsapp: wa,
          password: hashed,
          xl,
          createdAt: Date.now()
        };

        await env.USER_VPN.put(key, JSON.stringify(userData));

        return json({ ok: true, message: "Pendaftaran berhasil.", data: userData });
      } catch (e) {
        return json({ ok: false, error: e.message }, 500);
      }
    }

    // =====================================================================
    // 2. ==== LOGIN USER ====================================================
    // =====================================================================
    if (pathname === "/api/auth/login" && request.method === "POST") {
      try {
        const body = await request.json();
        const { user, password } = body;

        if (!user || !password) {
          return json({ ok: false, message: "Nama/No WhatsApp dan password wajib diisi." }, 400);
        }

        const wa = user.trim();
        const key = `user:${wa}`;
        const data = await env.USER_VPN.get(key);

        if (!data) {
          return json({ ok: false, message: "User tidak ditemukan." }, 404);
        }

        const userData = JSON.parse(data);

        const valid = await verifyPassword(password, userData.password);
        if (!valid) {
          return json({ ok: false, message: "Password salah." }, 401);
        }

        return json({ ok: true, message: "Login berhasil.", data: userData });
      } catch (e) {
        return json({ ok: false, error: e.message }, 500);
      }
    }

    // =====================================================================
    // 3. ==== LIST USER =====================================================
    // =====================================================================
    if (pathname === "/api/auth/users" && request.method === "GET") {
      const list = [];
      const users = await env.USER_VPN.list({ prefix: "user:" });

      for (const item of users.keys) {
        const data = await env.USER_VPN.get(item.name);
        if (data) {
          const parsed = JSON.parse(data);
          delete parsed.password; // hide hash
          list.push(parsed);
        }
      }

      return json({ ok: true, users: list });
    }

    // =====================================================================
    // 4. ==== API CEK KUOTA ================================================
    // =====================================================================
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

    // =====================================================================
    // 5. ==== STATIC FILE ====================================================
    // =====================================================================
    try {
      return await env.ASSETS.fetch(request);
    } catch (e) {
      const fallbackUrl = new URL("/", request.url);
      return await env.ASSETS.fetch(new Request(fallbackUrl, request));
    }
  },
};


// =====================================================================
// HELPER: JSON RESPONSE
// =====================================================================
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}


// =====================================================================
// HELPER: PASSWORD HASHING
// =====================================================================
async function hashPassword(password) {
  const enc = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", enc);
  return hex(hashBuffer);
}

async function verifyPassword(password, hashed) {
  const hash2 = await hashPassword(password);
  return hash2 === hashed;
}

function hex(buffer) {
  const arr = Array.from(new Uint8Array(buffer));
  return arr.map(b => b.toString(16).padStart(2, "0")).join("");
}
