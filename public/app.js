document.addEventListener("DOMContentLoaded", () => {
  /* =====================================================
     FORMAT NOMOR (Fix 628xxxx → 08xxxx tanpa hilang angka)
  ====================================================== */
  function formatMsisdn(num) {
    if (!num) return "";
    let s = String(num).trim();

    if (s.startsWith("+62")) return "0" + s.slice(3);
    if (s.startsWith("62")) return "0" + s.slice(2);
    if (s.startsWith("0")) return s;

    return s;
  }

  /* Helper sensor 4 digit terakhir */
  function maskLast4(num) {
    if (!num) return "";
    const s = String(num);
    if (s.length <= 4) return s + "****";
    return s.slice(0, -4) + "****";
  }

  /* =====================================================
     NAVIGASI BOTTOM BAR
  ====================================================== */
  const navButtons = document.querySelectorAll(".nav-btn");
  const screens = document.querySelectorAll(".screen");

  function showScreen(name) {
    screens.forEach((s) => (s.style.display = "none"));

    if (!name) {
      const def = document.getElementById("screen-default");
      if (def) def.style.display = "flex";
      return;
    }

    const target = document.getElementById("screen-" + name);
    if (target) {
      target.style.display = name === "cek" ? "block" : "flex";
    }
  }

  function setActiveNav(name) {
    navButtons.forEach((btn) => btn.classList.remove("active"));
    navButtons.forEach((btn) => {
      if (btn.dataset.screen === name) btn.classList.add("active");
    });
  }

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.screen;
      showScreen(name);
      setActiveNav(name);

      if (name === "users") {
        loadUsers();
      }
    });
  });

  // screen awal: profile (isi-nya bisa login form atau dashboard tergantung session)
  showScreen("profile");
  setActiveNav("profile");

  /* =====================================================
     DASHBOARD PROFIL + SESSION
  ====================================================== */

  // RENDER DASHBOARD PROFIL BARU
  function renderProfile(user) {
    const container = document.querySelector(
      "#screen-profile .profile-container"
    );
    if (!container) return;

    const name = user.name || "-";
    const whatsapp = user.whatsapp || user.msisdn || "";
    const xl = user.xl || user.no_xl || "";

    const avatarLetter = name.trim().charAt(0).toUpperCase() || "?";
    const shortWa = whatsapp ? maskLast4(whatsapp) : "********";

    // nilai saldo / kuota / bonus – sementara 0 kalau belum ada di KV
    const saldo = user.saldo ?? 0;
    const sisaKuota = user.sisaKuota ?? "-";
    const bonus = user.bonus ?? 0;

    container.innerHTML = `
      <div class="profile-dashboard">
        <!-- Baris 1: avatar + nama -->
        <div class="profile-header-row">
          <div class="profile-avatar-col">
            <div class="profile-avatar-circle">${avatarLetter}</div>
            <button type="button" class="profile-edit-photo">Edit photo</button>
          </div>
          <div class="profile-header-info">
            <div class="profile-header-name">${name}</div>
            <div class="profile-header-phone">${shortWa}</div>
          </div>
        </div>

        <!-- Form 1: saldo / kuota / bonus -->
        <div class="profile-card profile-balance-card">
          <div class="profile-balance-item">
            <div class="profile-balance-value" id="balance-saldo">${saldo}</div>
            <div class="profile-balance-label">Saldo</div>
          </div>
          <div class="profile-balance-item">
            <div class="profile-balance-value" id="balance-kuota">${sisaKuota}</div>
            <div class="profile-balance-label">Sisa kuota</div>
          </div>
          <div class="profile-balance-item">
            <div class="profile-balance-value" id="balance-bonus">${bonus}</div>
            <div class="profile-balance-label">Koin bonus</div>
          </div>
        </div>

        <!-- Form 2: tombol cepat -->
        <div class="profile-card profile-actions-card">
          <button type="button" class="profile-action">
            <div class="profile-action-icon">💰</div>
            <div class="profile-action-label">Tambah saldo</div>
          </button>
          <button type="button" class="profile-action">
            <div class="profile-action-icon">📶</div>
            <div class="profile-action-label">Tambah kuota</div>
          </button>
          <button type="button" class="profile-action">
            <div class="profile-action-icon">🎁</div>
            <div class="profile-action-label">Dapatkan bonus</div>
          </button>
        </div>

        <!-- Form 3: info akun -->
        <div class="profile-card profile-info-card">
          <div class="profile-info-row">
            <span class="profile-info-label">Nama</span>
            <span class="profile-info-value">${name}</span>
          </div>
          <div class="profile-info-row">
            <span class="profile-info-label">No WhatsApp</span>
            <span class="profile-info-value">${whatsapp || "-"}</span>
          </div>
          <div class="profile-info-row">
            <span class="profile-info-label">No XL</span>
            <span class="profile-info-value">${xl || "-"}</span>
          </div>
        </div>

        <!-- 4 form kosong -->
        <div class="profile-card profile-empty-card"></div>
        <div class="profile-card profile-empty-card"></div>
        <div class="profile-card profile-empty-card"></div>
        <div class="profile-card profile-empty-card"></div>

        <!-- Tombol keluar -->
        <button type="button" id="logout-btn" class="profile-btn profile-logout-btn">
          Keluar
        </button>
      </div>
    `;

    const logoutBtn = container.querySelector("#logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("vpnUser");
        location.reload();
      });
    }

    const editPhotoBtn = container.querySelector(".profile-edit-photo");
    if (editPhotoBtn) {
      editPhotoBtn.addEventListener("click", () => {
        alert("Fitur upload foto profil akan ditambahkan nanti.");
      });
    }
  }

  // Ambil session dari localStorage (kalau ada)
  function initSessionFromStorage() {
    const raw = localStorage.getItem("vpnUser");
    if (!raw) return;
    try {
      const user = JSON.parse(raw);
      if (user && user.name) {
        renderProfile(user);
        showScreen("profile");
        setActiveNav("profile");
      } else {
        localStorage.removeItem("vpnUser");
      }
    } catch {
      localStorage.removeItem("vpnUser");
    }
  }

  /* =====================================================
     HELPER — FORMAT KUOTA
  ====================================================== */
  function normalizeAmount(str) {
    if (!str) return "";
    return String(str)
      .replace(/([0-9])([A-Za-z])/g, "$1 $2")
      .replace(/([A-Za-z])([0-9])/g, "$1 $2")
      .trim();
  }

  function createLine(label, value) {
    if (!value) return "";
    const isSisa = label.toLowerCase() === "sisa";

    const valueHtml = isSisa
      ? `<span style="font-weight:600;color:#16a34a;">${normalizeAmount(
          value
        )}</span>`
      : `<span style="font-weight:600;">${normalizeAmount(value)}</span>`;

    return `
      <div class="paket-line">
        <span class="label">${label}:</span>
        ${valueHtml}
      </div>`;
  }

  function typeToClass(tipe) {
    if (!tipe) return "";
    const t = tipe.toLowerCase();
    if (t.includes("voice") || t.includes("telp")) return "voice";
    if (t.includes("sms")) return "sms";
    if (t.includes("data")) return "data";
    return "";
  }

  /* =====================================================
     PARSE HEADER
  ====================================================== */
  function parseHeaderFromHasil(hasilHtml) {
    if (!hasilHtml) return {};

    const lines = hasilHtml
      .replace(/<br\s*\/?>/gi, "\n")
      .split("\n")
      .map((a) => a.trim())
      .filter(Boolean);

    const header = {};

    for (const line of lines) {
      if (line.startsWith("MSISDN:")) {
        header.msisdn = formatMsisdn(line.replace("MSISDN:", "").trim());
      } else if (line.startsWith("Tipe Kartu:")) {
        header.tipeKartu = line.replace("Tipe Kartu:", "").trim();
      } else if (line.startsWith("Masa Aktif:")) {
        header.masaAktif = line.replace("Masa Aktif:", "").trim();
      } else if (line.startsWith("Masa Berakhir Tenggang")) {
        header.masaTenggang = line.split(":").slice(1).join(":").trim();
      }
    }

    return header;
  }

  /* =====================================================
     PARSE PAKET
  ====================================================== */
  function parsePaketsFromQuotas(quotasValue) {
    const pakets = [];
    if (!Array.isArray(quotasValue)) return pakets;

    quotasValue.forEach((group) => {
      if (!Array.isArray(group)) return;

      group.forEach((item) => {
        const expDate = item?.packages?.expDate || "";
        const benefits = item?.benefits || [];

        benefits.forEach((b) => {
          pakets.push({
            nama: b.bname || "Paket",
            tipe: b.type || "",
            total: b.quota || "",
            sisa: b.remaining || "",
            masaAktif: expDate ? expDate.replace("T", " ") : "",
          });
        });
      });
    });

    return pakets;
  }

  function buildParsedResult(hasilHtml, quotasValue) {
    return {
      header: parseHeaderFromHasil(hasilHtml),
      pakets: parsePaketsFromQuotas(quotasValue),
    };
  }

  /* =====================================================
     RENDER CEK KUOTA
  ====================================================== */
  const cekResultBody = document.getElementById("cek-result-body");

  function renderParsedResult(parsed, fallbackText) {
    if (!cekResultBody) return;

    let html = "";

    const h = parsed.header;
    const hasHeader = h.msisdn || h.tipeKartu || h.masaAktif || h.masaTenggang;
    const hasPakets = parsed.pakets.length > 0;

    if (hasHeader) {
      html += `<div class="cek-summary">`;

      if (h.msisdn) {
        html += `<div class="summary-main">${h.msisdn}</div>`;
      }

      if (h.tipeKartu) {
        html += `<div class="cek-summary-line"><span class="label">Kartu:</span> ${h.tipeKartu}</div>`;
      }

      if (h.masaAktif) {
        html += `<div class="cek-summary-line"><span class="label">Masa aktif:</span> ${h.masaAktif}</div>`;
      }

      if (h.masaTenggang) {
        html += `<div class="cek-summary-line"><span class="label">Tenggang:</span> ${h.masaTenggang}</div>`;
      }

      html += `</div>`;
    }

    if (!hasPakets) {
      html += `<div class="no-paket-msg">Anda tidak memiliki kuota aktif.</div>`;
      cekResultBody.innerHTML = html;
      return;
    }

    html += `<div class="paket-list">`;

    parsed.pakets.forEach((p) => {
      html += `<div class="paket-card ${typeToClass(p.tipe)}">`;
      html += `<div class="paket-title">${p.nama}</div>`;
      html += createLine("Tipe", p.tipe);
      html += createLine("Kuota", p.total);
      html += createLine("Sisa", p.sisa);
      if (p.masaAktif) html += createLine("Masa aktif", p.masaAktif);
      html += `</div>`;
    });

    html += `</div>`;
    cekResultBody.innerHTML = html;
  }

  /* =====================================================
     CEK KUOTA FORM
  ====================================================== */
  const cekForm = document.getElementById("cek-form");
  const cekNumberInput = document.getElementById("cek-number");

  if (cekForm && cekNumberInput && cekResultBody) {
    cekForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const nomor = cekNumberInput.value.trim();
      if (!nomor) {
        cekResultBody.textContent = "Nomor belum diisi.";
        return;
      }

      cekResultBody.textContent = "Memeriksa kuota...\nMohon tunggu.";

      try {
        const res = await fetch(
          "/api/cek-kuota?msisdn=" + encodeURIComponent(nomor)
        );
        const text = await res.text();

        let json;
        try {
          json = JSON.parse(text);
        } catch {
          cekResultBody.textContent = text;
          return;
        }

        const hasilHtml = json?.data?.hasil || "";
        const quotasValue = json?.data?.data_sp?.quotas?.value || [];

        const parsed = buildParsedResult(hasilHtml, quotasValue);
        const fallbackText = hasilHtml.replace(/<br\s*\/?>/gi, "\n");

        renderParsedResult(parsed, fallbackText);
      } catch (err) {
        cekResultBody.textContent = "Error: " + err.message;
      }
    });
  }

  /* =====================================================
     LOGIN / REGISTER SWITCH (text di bawah form)
  ====================================================== */
  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");
  const switchToRegister = document.getElementById("go-register");
  const switchToLogin = document.getElementById("go-login");

  function showLoginTab() {
    if (tabLogin && tabRegister) {
      tabLogin.classList.add("active");
      tabRegister.classList.remove("active");
    }
  }

  function showRegisterTab() {
    if (tabLogin && tabRegister) {
      tabRegister.classList.add("active");
      tabLogin.classList.remove("active");
    }
  }

  if (switchToRegister) {
    switchToRegister.addEventListener("click", showRegisterTab);
  }

  if (switchToLogin) {
    switchToLogin.addEventListener("click", showLoginTab);
  }

  /* =====================================================
     FORM DAFTAR AKUN BARU
  ====================================================== */
  const regForm = document.getElementById("register-form");
  const regName = document.getElementById("reg-name");
  const regWa = document.getElementById("reg-wa");
  const regPassword = document.getElementById("reg-password");
  const regXl = document.getElementById("reg-xl");

  if (regForm && regName && regWa && regPassword && regXl) {
    regForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = regName.value.trim();
      const whatsapp = regWa.value.trim();
      const password = regPassword.value.trim();
      const xl = regXl.value.trim();

      if (!name || !whatsapp || !password || !xl) {
        alert("Semua data daftar wajib diisi.");
        return;
      }

      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, whatsapp, password, xl }),
        });

        const data = await res.json();

        if (!data.status) {
          alert(data.message || "Gagal mendaftar.");
          return;
        }

        alert("Daftar berhasil. Silakan masuk.");
        showLoginTab();
      } catch (err) {
        alert("Gagal menghubungi server: " + err.message);
      }
    });
  }

  /* =====================================================
     FORM LOGIN
  ====================================================== */
  const loginForm = document.getElementById("login-form");
  const loginIdentifier = document.getElementById("login-identifier");
  const loginPassword = document.getElementById("login-password");

  if (loginForm && loginIdentifier && loginPassword) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const identifier = loginIdentifier.value.trim();
      const password = loginPassword.value.trim();

      if (!identifier || !password) {
        alert("Nama / No WhatsApp dan password wajib diisi.");
        return;
      }

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, password }),
        });

        const data = await res.json();

        if (!data.status) {
          alert(data.message || "Gagal masuk.");
          return;
        }

        const user = data.data || {};
        alert("Login berhasil sebagai " + (user.name || ""));

        // SIMPAN SESSION DI BROWSER
        localStorage.setItem("vpnUser", JSON.stringify(user));

        // TAMPILKAN DASHBOARD PROFIL
        renderProfile(user);
        showScreen("profile");
        setActiveNav("profile");
      } catch (err) {
        alert("Gagal menghubungi server: " + err.message);
      }
    });
  }

  /* =====================================================
     LIST USER
  ====================================================== */
  const userListEl = document.getElementById("user-list");
  const reloadUsersBtn = document.getElementById("reload-users");

  async function loadUsers() {
    if (!userListEl) return;
    userListEl.innerHTML = "Memuat data user...";

    try {
      const res = await fetch("/api/users");
      const data = await res.json();

      if (!data.ok) {
        userListEl.innerHTML =
          "<div class='user-item'>Gagal memuat user.</div>";
        return;
      }

      const users = data.users || [];

      if (!users.length) {
        userListEl.innerHTML =
          "<div class='user-item'>Belum ada user terdaftar.</div>";
        return;
      }

      userListEl.innerHTML = users
        .map((u, idx) => {
          const name = u.name || "-";
          const wa = u.whatsapp || "";
          const xl = u.xl || "";
          const waMasked = wa ? maskLast4(wa) : "****";
          const xlMasked = xl ? maskLast4(xl) : "****";

          return `
            <div class="user-item">
              <div class="user-item-header">
                <span>${idx + 1}. ${name}</span>
              </div>
              <div class="user-item-body">
                <div>No WhatsApp: ${waMasked}</div>
                <div>No XL: ${xlMasked}</div>
              </div>
            </div>
          `;
        })
        .join("");
    } catch (err) {
      userListEl.innerHTML =
        "<div class='user-item'>Error: " + err.message + "</div>";
    }
  }

  if (reloadUsersBtn && userListEl) {
    reloadUsersBtn.addEventListener("click", loadUsers);
  }

  /* =====================================================
     TERAPKAN SESSION JIKA ADA (setelah semua fungsi siap)
  ====================================================== */
  initSessionFromStorage();
});
