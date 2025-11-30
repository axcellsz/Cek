document.addEventListener("DOMContentLoaded", () => {
  /* =====================================================
     FORMAT NOMOR & MASKING
  ====================================================== */

  // Ubah format 62xxxx / +62xxxx → 08xxxx
  function formatMsisdn(num) {
    if (!num) return "";
    let s = String(num).trim();

    if (s.startsWith("+62")) return "0" + s.slice(3);
    if (s.startsWith("62")) return "0" + s.slice(2);
    if (s.startsWith("0")) return s;

    return s;
  }

  // Menyensor 4 digit terakhir nomor
  function maskLast4(num) {
    if (!num) return "";
    const s = String(num);
    if (s.length <= 4) return s + "****";
    return s.slice(0, -4) + "****";
  }

  /* =====================================================
     NAVBAR BAWAH (GANTI SCREEN)
  ====================================================== */

  const navButtons = document.querySelectorAll(".nav-btn");
  const screens = document.querySelectorAll(".screen");

  // Menampilkan screen berdasarkan nama: "profile", "users", "beli", "cek"
  // Kalau name tidak diisi → tampilkan screen-default
  function showScreen(name) {
    // Sembunyikan semua screen dulu
    screens.forEach((s) => (s.style.display = "none"));

    // Kalau tidak ada nama → tampil screen-default
    if (!name) {
      const def = document.getElementById("screen-default");
      if (def) def.style.display = "flex";
      return;
    }

    // Tampilkan screen yang diminta
    const target = document.getElementById("screen-" + name);
    if (target) {
      // khusus "cek" pakai block biar scrollnya enak
      target.style.display = name === "cek" ? "block" : "flex";
    }
  }

  // Mengatur status aktif di navbar bawah
  function setActiveNav(name) {
    navButtons.forEach((btn) => btn.classList.remove("active"));
    navButtons.forEach((btn) => {
      if (btn.dataset.screen === name) btn.classList.add("active");
    });
  }

  // Klik tombol di navbar → ganti screen
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.screen;
      showScreen(name);
      setActiveNav(name);

      // Kalau buka tab "users", otomatis load user
      if (name === "users") {
        loadUsers();
      }
    });
  });

  // NOTE:
  // Tidak memanggil showScreen("profile") di sini.
  // Screen awal ditentukan oleh initSessionFromStorage():
  // - kalau sudah login → langsung ke profile
  // - kalau belum login → screen-default

  /* =====================================================
     DASHBOARD PROFILE (SETELAH LOGIN)
  ====================================================== */

  // Mengganti isi .profile-container menjadi dashboard baru
  /* =====================================================
     DASHBOARD PROFILE (setelah login)
  ====================================================== */

  // helper upload foto ke server
  async function uploadProfilePhoto(file, user) {
    const formData = new FormData();
    formData.append("photo", file);
    // kirim identitas user (silakan sesuaikan dengan backend-mu)
    formData.append("userId", user.id || user.whatsapp || user.name || "");

    const res = await fetch("/api/profile/photo", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Gagal upload foto (status " + res.status + ")");
    }

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error("Respon server tidak valid.");
    }

    if (!data.photoUrl) {
      throw new Error(data.message || "photoUrl tidak ditemukan di respon server.");
    }

    return data.photoUrl;
  }

  function renderProfile(user) {
    const container = document.querySelector("#screen-profile .profile-container");
    if (!container) return;

    const name = user.name || "-";
    const wa = user.whatsapp || user.msisdn || "";
    const xl = user.xl || user.no_xl || "";
    const avatarLetter = name.trim().charAt(0).toUpperCase() || "?";
    const maskedWa = wa ? maskLast4(wa) : "********";

    // kalau user sudah punya photoUrl dari server / localStorage
    const photoUrl = user.photoUrl || "";

    container.innerHTML = `
      <div class="profile-dashboard">
        <!-- Bagian atas: avatar + nama -->
        <div class="profile-hero">
          <div class="profile-hero-main">
            <div class="profile-avatar-wrapper">
              <div class="profile-avatar">
                ${
                  photoUrl
                    ? `<img src="${photoUrl}" alt="Foto profil" />`
                    : avatarLetter
                }
              </div>
              <button type="button" class="profile-edit-photo">
                Edit photo
              </button>
              <!-- input file disembunyikan, dipanggil via JS -->
              <input
                type="file"
                accept="image/*"
                id="profile-photo-input"
                style="display:none"
              />
            </div>

            <div>
              <div class="profile-hero-name">${name}</div>
              <div class="profile-hero-phone">${maskedWa}</div>
            </div>
          </div>
        </div>

        <!-- Card info akun + tombol keluar -->
        <div class="profile-info-card">
          <div class="profile-info-row">
            <span class="profile-info-label">No WhatsApp</span>
            <span class="profile-info-value">${wa || "-"}</span>
          </div>
          <div class="profile-info-row">
            <span class="profile-info-label">No XL</span>
            <span class="profile-info-value">${xl || "-"}</span>
          </div>

          <button id="logout-btn" class="profile-btn profile-logout-btn">
            Keluar
          </button>
        </div>
      </div>
    `;

    // ===== tombol Keluar: hapus session & reload =====
    const logoutBtn = container.querySelector("#logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("vpnUser");
        location.reload();
      });
    }

    // ===== tombol Edit photo + input file =====
    const editBtn = container.querySelector(".profile-edit-photo");
    const fileInput = container.querySelector("#profile-photo-input");
    const avatarEl = container.querySelector(".profile-avatar");

    if (editBtn && fileInput && avatarEl) {
      // klik tulisan "Edit photo" → buka dialog file
      editBtn.addEventListener("click", () => {
        fileInput.click();
      });

      // ketika user memilih file
      fileInput.addEventListener("change", async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;

        // validasi sederhana
        if (!file.type.startsWith("image/")) {
          alert("File harus berupa gambar (jpg, png, dll).");
          fileInput.value = "";
          return;
        }

        const maxSize = 2 * 1024 * 1024; // 2MB
        if (file.size > maxSize) {
          alert("Ukuran foto maksimal 2MB.");
          fileInput.value = "";
          return;
        }

        // PREVIEW CEPAT di avatar pakai data URL
        const reader = new FileReader();
        reader.onload = () => {
          avatarEl.innerHTML = "";
          const img = document.createElement("img");
          img.src = reader.result;
          img.alt = "Foto profil";
          avatarEl.appendChild(img);
        };
        reader.readAsDataURL(file);

        // KIRIM KE SERVER
        try {
          const photoUrl = await uploadProfilePhoto(file, user);

          // simpan ke object user dan ke localStorage
          user.photoUrl = photoUrl;
          localStorage.setItem("vpnUser", JSON.stringify(user));
        } catch (err) {
          alert("Upload ke server gagal: " + err.message);
        } finally {
          fileInput.value = "";
        }
      });
    }
  }

  // Mengecek localStorage → kalau ada sesi, langsung render dashboard
  function initSessionFromStorage() {
    const raw = localStorage.getItem("vpnUser");

    // Tidak ada sesi → tampilkan screen-default
    if (!raw) {
      showScreen(); // tanpa argumen → screen-default
      return;
    }

    try {
      const user = JSON.parse(raw);
      if (user && user.name) {
        // Kalau ada sesi valid → render dashboard & buka screen profile
        renderProfile(user);
        showScreen("profile");
        setActiveNav("profile");
      } else {
        // Data sesi aneh → bersihkan
        localStorage.removeItem("vpnUser");
        showScreen();
      }
    } catch {
      // JSON rusak → bersihkan sesi
      localStorage.removeItem("vpnUser");
      showScreen();
    }
  }

  /* =====================================================
     HELPER KUOTA (FORMAT TEKS PAKET)
  ====================================================== */

  // Normalisasi nilai kuota (misal "10GB" → "10 GB")
  function normalizeAmount(str) {
    if (!str) return "";
    return String(str)
      .replace(/([0-9])([A-Za-z])/g, "$1 $2")
      .replace(/([A-Za-z])([0-9])/g, "$1 $2")
      .trim();
  }

  // Membuat satu baris teks paket
  function createLine(label, value) {
    if (!value) return "";
    const isSisa = label.toLowerCase() === "sisa";

    const valueHtml = isSisa
      ? `<span style="font-weight:600;color:#16a34a;">${normalizeAmount(value)}</span>`
      : `<span style="font-weight:600;">${normalizeAmount(value)}</span>`;

    return `
      <div class="paket-line">
        <span class="label">${label}:</span>
        ${valueHtml}
      </div>`;
  }

  // Menentukan kelas tambahan dari tipe paket
  function typeToClass(tipe) {
    if (!tipe) return "";
    const t = tipe.toLowerCase();
    if (t.includes("voice") || t.includes("telp")) return "voice";
    if (t.includes("sms")) return "sms";
    if (t.includes("data")) return "data";
    return "";
  }

  /* =====================================================
     PARSE HEADER HASIL KUOTA
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
     PARSE PAKET KUOTA
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
     FORM CEK KUOTA
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
     SWITCH LOGIN / REGISTER (TEKS BAWAH FORM)
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
     FORM DAFTAR
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

        // Simpan sesi user di localStorage
        localStorage.setItem("vpnUser", JSON.stringify(user));

        // Tampilkan dashboard profile
        renderProfile(user);
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
     TERAPKAN SESSION JIKA ADA (SCREEN AWAL)
  ====================================================== */
  initSessionFromStorage();
});
