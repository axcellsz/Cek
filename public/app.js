document.addEventListener("DOMContentLoaded", () => {
  /* =====================================================
     FORMAT NOMOR
  ====================================================== */
  function formatMsisdn(num) {
    if (!num) return "";
    let s = String(num).trim();

    if (s.startsWith("+62")) return "0" + s.slice(3);
    if (s.startsWith("62")) return "0" + s.slice(2);
    if (s.startsWith("0")) return s;

    return s;
  }

  /* =====================================================
     NAVIGASI MENU BOTTOM
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
    });
  });

  showScreen(null);

  /* =====================================================
     TAB LOGIN / REGISTER
  ====================================================== */
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const tab = btn.dataset.tab;
      tabContents.forEach((c) => c.classList.remove("active"));
      const target = document.getElementById("tab-" + tab);
      if (target) target.classList.add("active");
    });
  });

  /* =====================================================
     REGISTER FORM
  ====================================================== */
  const regForm = document.getElementById("register-form");
  const regName = document.getElementById("reg-name");
  const regWa = document.getElementById("reg-wa");
  const regPassword = document.getElementById("reg-password");
  const regXl = document.getElementById("reg-xl");

  if (regForm) {
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

        alert("Pendaftaran berhasil! Silakan masuk.");

        // ⬇⬇ AFTER REGISTER → otomatis pindah ke tab LOGIN
        const loginBtn = document.querySelector('[data-tab="login"]');
        if (loginBtn) loginBtn.click();

      } catch (err) {
        alert("Gagal menghubungi server: " + err.message);
      }
    });
  }

  /* =====================================================
     LOGIN FORM
  ====================================================== */
  const loginForm = document.getElementById("login-form");
  const loginIdentifier = document.getElementById("login-identifier");
  const loginPassword = document.getElementById("login-password");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const identifier = loginIdentifier.value.trim();
      const password = loginPassword.value.trim();

      if (!identifier || !password) {
        alert("Nama/No WhatsApp dan password wajib diisi.");
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
          alert(data.message || "Login gagal.");
          return;
        }

        alert("Login berhasil! Selamat datang " + data.data.name);

      } catch (err) {
        alert("Gagal menghubungi server: " + err.message);
      }
    });
  }
});
