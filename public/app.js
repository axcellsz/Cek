document.addEventListener("DOMContentLoaded", () => {

  function loadHomeBanners() {
  const container = document.getElementById("home-banner-list");
  if (!container) return;

  const MAX_BANNER = 10;  

  for (let i = 1; i <= MAX_BANNER; i++) {
    const wrapper = document.createElement("div");
    wrapper.className = "home-banner-item";

    const img = document.createElement("img");
    img.src = `/img/banner${i}.jpg`;
    img.alt = `Banner ${i}`;
    img.loading = "lazy";

    img.onerror = () => {
      wrapper.remove();
    };

    wrapper.appendChild(img);
    container.appendChild(wrapper);
  }
}
  
  
  
  /* =====================================================
     HELPER FORMAT NOMOR
  ====================================================== */
  function formatMsisdn(num) {
    if (!num) return "";
    let s = String(num).trim();

    if (s.startsWith("+62")) return "0" + s.slice(3);
    if (s.startsWith("62")) return "0" + s.slice(2);
    if (s.startsWith("0")) return s;

    return s;
  }

  function maskLast4(num) {
    if (!num) return "";
    const s = String(num);
    if (s.length <= 4) return s + "****";
    return s.slice(0, -4) + "****";
  }

  /* =====================================================
     HELPER: KOMPRES GAMBAR DI BROWSER
     - Resize proporsional (maxSize px)
     - Kompres ke JPEG (quality 0..1)
     - Return base64 TANPA prefix data:image
  ====================================================== */
  function compressImage(file, maxSize = 320, quality = 0.7) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;

        img.onload = () => {
          let width = img.width;
          let height = img.height;

          // Resize proporsional
          if (width > height) {
            if (width > maxSize) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          // Export JPEG
          const base64 = canvas.toDataURL("image/jpeg", quality);
          const cleanBase64 = base64.split(",")[1]; // buang prefix

          resolve(cleanBase64);
        };

        img.onerror = () => reject(new Error("Gambar tidak bisa diproses"));
      };

      reader.onerror = () => reject(new Error("Gagal membaca file"));
    });
  }

  // =====================================================
  // KEY LOCALSTORAGE UNTUK FOTO PROFIL
  // (disimpan sebagai data URL lengkap: "data:image/jpeg;base64,...")
  // =====================================================
  const AVATAR_KEY = "vpnUserPhoto";

  // =====================================================
  // HELPER BACKEND FOTO PROFIL (KV PROFILE_PIC)
  // =====================================================

  // Kirim foto ke backend untuk disimpan di KV
  async function uploadProfilePhotoToServer(whatsapp, dataUrl) {
    try {
      if (!whatsapp) return;

      const res = await fetch("/api/profile-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsapp,
          imageData: dataUrl, // data URL lengkap
        }),
      });

      let data = {};
      try {
        data = await res.json();
      } catch (_) {
        // kalau bukan JSON / kosong, biarkan saja
      }

      if (!res.ok || !data.ok) {
        console.error("Server menolak simpan foto:", res.status, data);
        alert(
          "Gagal menyimpan foto di server: " +
            (data.message || "status " + res.status)
        );
      } else {
        console.log("Foto profil tersimpan di KV:", data.message);
      }
    } catch (err) {
      console.error("Gagal upload foto ke server:", err);
      alert("Gagal mengirim foto ke server: " + err.message);
    }
  }

  // Ambil foto dari backend KV
  async function downloadProfilePhotoFromServer(whatsapp) {
    try {
      if (!whatsapp) return null;

      const res = await fetch(
        "/api/profile-photo?whatsapp=" + encodeURIComponent(whatsapp)
      );

      if (!res.ok) {
        return null;
      }

      const data = await res.json();

      // Backend mengirim: { ok: true, image: "data:image..." }
      // Frontend baca imageData || image → kompatibel
      const imageData = data.imageData || data.image;

      if (!data.ok || !imageData) return null;

      return imageData;
    } catch (err) {
      console.error("Gagal ambil foto dari server:", err);
      return null;
    }
  }

  /* =====================================================
     NAVBAR BAWAH & SCREEN SWITCHING
  ====================================================== */
  const navButtons = document.querySelectorAll(".nav-btn");
  const screens = document.querySelectorAll(".screen");

  function showScreen(name) {
    // sembunyikan semua screen
    screens.forEach((s) => (s.style.display = "none"));

    // kalau tidak ada nama → tampilkan screen-default
    if (!name) {
      const def = document.getElementById("screen-default");
      if (def) def.style.display = "flex";
      return;
    }

    // tampilkan screen sesuai id
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

  // Klik nav-bottom
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

  /* =====================================================
     DASHBOARD PROFILE (SETELAH LOGIN)
     - Menangani avatar + upload foto + sinkron ke KV
  ====================================================== */
  function renderProfile(user) {
    const container = document.querySelector(
      "#screen-profile .profile-container"
    );
    if (!container) return;

    const name = user.name || "-";
    const waRaw = user.whatsapp || user.msisdn || "";
    const xlRaw = user.xl || user.no_xl || "";

    const wa = formatMsisdn(waRaw);
    const xl = formatMsisdn(xlRaw);

    const avatarLetter = name.trim().charAt(0).toUpperCase() || "?";
    const maskedWa = wa ? maskLast4(wa) : "********";

    // whatsappKey untuk KV: pakai field whatsapp yang disimpan user
    const whatsappKey = user.whatsapp || wa || waRaw;

    // baca foto dari localStorage (data URL lengkap)
    const savedPhoto = localStorage.getItem(AVATAR_KEY);

    container.innerHTML = `
      <div class="profile-dashboard">
        <!-- Baris 1: Avatar + Nama + Edit photo -->
        <div class="profile-header-row">
          <div class="profile-avatar-col">
            <div class="profile-avatar-circle" id="profile-avatar-circle">
              ${savedPhoto ? "" : avatarLetter}
            </div>
            <button type="button" class="profile-edit-photo">Edit photo</button>
            <input type="file" id="profile-photo-input" accept="image/*" style="display:none" />
          </div>
          <div class="profile-header-info">
            <div class="profile-header-name">${name}</div>
            <div class="profile-header-phone">${maskedWa}</div>
          </div>
        </div>

        <!-- Form 1: saldo / kuota / bonus (dummy) -->
        <div class="profile-card profile-balance-card">
          <div class="profile-balance-item">
            <div class="profile-balance-value" id="balance-saldo">0</div>
            <div class="profile-balance-label">Saldo</div>
          </div>
          <div class="profile-balance-item">
            <div class="profile-balance-value" id="balance-kuota">-</div>
            <div class="profile-balance-label">Sisa kuota</div>
          </div>
          <div class="profile-balance-item">
            <div class="profile-balance-value" id="balance-bonus">0</div>
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
            <span class="profile-info-value">${wa || "-"}</span>
          </div>
          <div class="profile-info-row">
            <span class="profile-info-label">No XL</span>
            <span class="profile-info-value">${xl || "-"}</span>
          </div>
        </div>

        <!-- Slot kosong + tombol keluar di bagian scroll -->
        <div class="profile-extra-scroll">
          <div class="profile-card profile-empty-card"></div>
          <div class="profile-card profile-empty-card"></div>
          <div class="profile-card profile-empty-card"></div>
          <div class="profile-card profile-empty-card"></div>

          <button type="button" id="logout-btn" class="profile-btn profile-logout-btn">
            Keluar
          </button>
        </div>
      </div>
    `;

    const avatarEl = container.querySelector("#profile-avatar-circle");
    const editBtn = container.querySelector(".profile-edit-photo");
    const photoInput = container.querySelector("#profile-photo-input");

    // 1) Kalau ada foto di localStorage → langsung pakai
    if (savedPhoto && avatarEl) {
      avatarEl.style.backgroundImage = `url(${savedPhoto})`;
      avatarEl.style.backgroundSize = "cover";
      avatarEl.style.backgroundPosition = "center";
      avatarEl.textContent = "";
    }

    // 2) Coba ambil foto dari server (KV PROFILE_PIC)
    if (whatsappKey && avatarEl) {
      (async () => {
        try {
          const remotePhoto = await downloadProfilePhotoFromServer(
            whatsappKey
          );
          if (remotePhoto) {
            avatarEl.style.backgroundImage = `url(${remotePhoto})`;
            avatarEl.style.backgroundSize = "cover";
            avatarEl.style.backgroundPosition = "center";
            avatarEl.textContent = "";
            localStorage.setItem(AVATAR_KEY, remotePhoto);
          }
        } catch (err) {
          console.error("Gagal sync foto dari server:", err);
        }
      })();
    }

    // 3) Handler upload foto (kompres + simpan local + kirim ke server)
    if (editBtn && photoInput && avatarEl) {
      editBtn.addEventListener("click", () => {
        photoInput.click();
      });

      photoInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
          alert("Harap pilih file gambar.");
          photoInput.value = "";
          return;
        }

        try {
          const base64 = await compressImage(file, 320, 0.7);
          const dataUrl = `data:image/jpeg;base64,${base64}`;

          localStorage.setItem(AVATAR_KEY, dataUrl);

          avatarEl.style.backgroundImage = `url(${dataUrl})`;
          avatarEl.style.backgroundSize = "cover";
          avatarEl.style.backgroundPosition = "center";
          avatarEl.textContent = "";

          await uploadProfilePhotoToServer(whatsappKey, dataUrl);

          alert("Foto profil disimpan.");
        } catch (err) {
          console.error(err);
          alert("Gagal memproses gambar: " + err.message);
        } finally {
          photoInput.value = "";
        }
      });
    }

    // tombol logout
    const logoutBtn = container.querySelector("#logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("vpnUser");
        // kalau mau sekalian hapus foto di device:
        // localStorage.removeItem(AVATAR_KEY);
        location.reload();
      });
    }
  }

  /* =====================================================
     SESSION: RESTORE DARI localStorage
  ====================================================== */
  function initSessionFromStorage() {
    const raw = localStorage.getItem("vpnUser");
    if (!raw) return false;

    try {
      const user = JSON.parse(raw);
      if (user && user.name) {
        renderProfile(user);
        return true;
      } else {
        localStorage.removeItem("vpnUser");
        return false;
      }
    } catch {
      localStorage.removeItem("vpnUser");
      return false;
    }
  }

  /* =====================================================
     HELPER KUOTA (PARSE & RENDER)
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
     SWITCH LOGIN / REGISTER
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

        localStorage.setItem("vpnUser", JSON.stringify(user));

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

      // --- render list dengan avatar lingkaran kecil di kiri ---
      userListEl.innerHTML = users
        .map((u, idx) => {
          const name = u.name || "-";
          const wa = u.whatsapp || "";
          const xl = u.xl || "";

          const waMasked = wa ? maskLast4(wa) : "****";
          const xlMasked = xl ? maskLast4(xl) : "****";

          const firstLetter = name.trim().charAt(0).toUpperCase() || "?";
          const whatsappKey = wa; // dipakai untuk ambil foto dari KV

          return `
            <div class="user-item">
              <div class="user-item-header">
                <div class="user-header-main">
                  <div
                    class="user-avatar-small"
                    data-whatsapp="${whatsappKey}"
                    data-first-letter="${firstLetter}"
                  >
                    ${firstLetter}
                  </div>
                  <span>${idx + 1}. ${name}</span>
                </div>
              </div>
              <div class="user-item-body">
                <div>No WhatsApp: ${waMasked}</div>
                <div>No XL: ${xlMasked}</div>
              </div>
            </div>
          `;
        })
        .join("");

      // --- setelah HTML jadi, load foto dari server per user ---
      const avatarEls = userListEl.querySelectorAll(".user-avatar-small");

      avatarEls.forEach(async (el) => {
        const waKey = el.dataset.whatsapp;
        const letter = el.dataset.firstLetter || "?";

        if (!waKey) {
          el.textContent = letter;
          return;
        }

        try {
          const photo = await downloadProfilePhotoFromServer(waKey);
          if (photo) {
            el.style.backgroundImage = `url(${photo})`;
            el.style.backgroundSize = "cover";
            el.style.backgroundPosition = "center";
            el.textContent = "";
          } else {
            // tidak ada foto di KV → pakai huruf
            el.textContent = letter;
          }
        } catch (err) {
          console.error("Gagal load foto list user:", err);
          el.textContent = letter;
        }
      });
    } catch (err) {
      userListEl.innerHTML =
        "<div class='user-item'>Error: " + err.message + "</div>";
    }
  }

  if (reloadUsersBtn && userListEl) {
    reloadUsersBtn.addEventListener("click", loadUsers);
  }

  /* =====================================================
     INIT: RESTORE SESSION & TENTUKAN SCREEN PERTAMA
  ====================================================== */
  const hasSession = initSessionFromStorage();

  if (hasSession) {
    // kalau sudah login → langsung ke profile
    showScreen("profile");
    setActiveNav("profile");
  } else {
    // kalau belum login → tampilkan screen kosong / default
    showScreen(); // sama dengan showScreen(null)
    // tidak set active nav, biar semuanya netral
  }
});
