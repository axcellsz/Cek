document.addEventListener("DOMContentLoaded", () => {
  /* ======================================================
     UTIL FORMAT
  ====================================================== */
  function formatMsisdn(num) {
    if (!num) return "";
    let s = String(num).trim();
    if (s.startsWith("+62")) return "0" + s.slice(3);
    if (s.startsWith("62")) return "0" + s.slice(2);
    if (s.startsWith("0")) return s;
    return s;
  }

  /* ======================================================
     NAVIGASI SCREEN
  ====================================================== */
  const screens = document.querySelectorAll(".screen");
  const navButtons = document.querySelectorAll(".nav-btn");

  function showScreen(name) {
    screens.forEach(s => (s.style.display = "none"));
    if (!name) {
      document.getElementById("screen-default").style.display = "flex";
      return;
    }
    const sc = document.getElementById("screen-" + name);
    if (sc) sc.style.display = name === "cek" ? "block" : "flex";
  }

  function setActiveNav(name) {
    navButtons.forEach(b => b.classList.remove("active"));
    navButtons.forEach(b => {
      if (b.dataset.screen === name) b.classList.add("active");
    });
  }

  navButtons.forEach(btn => {
    btn.onclick = () => {
      const nm = btn.dataset.screen;
      showScreen(nm);
      setActiveNav(nm);
    };
  });

  showScreen(null);

  /* ======================================================
     TAB LOGIN / REGISTER (fixed)
  ====================================================== */
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach(btn => {
    btn.onclick = () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const tab = btn.dataset.tab;

      tabContents.forEach(c => c.classList.remove("active"));
      document.getElementById("tab-" + tab).classList.add("active");
    };
  });

  /* ======================================================
     REGISTER (fixed redirect)
  ====================================================== */
  const regForm = document.getElementById("register-form");
  const regName = document.getElementById("reg-name");
  const regWa = document.getElementById("reg-wa");
  const regPassword = document.getElementById("reg-password");
  const regXl = document.getElementById("reg-xl");

  if (regForm) {
    regForm.onsubmit = async e => {
      e.preventDefault();

      const name = regName.value.trim();
      const whatsapp = regWa.value.trim();
      const password = regPassword.value.trim();
      const xl = regXl.value.trim();

      if (!name || !whatsapp || !password || !xl) {
        alert("Semua data wajib diisi.");
        return;
      }

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, whatsapp, password, xl })
      });

      const data = await res.json();

      if (!data.status) {
        alert(data.message || "Gagal daftar.");
        return;
      }

      alert("Daftar berhasil!");

      // FIX: langsung buka tab login
      const loginTabBtn = document.querySelector('.tab-btn[data-tab="login"]');
      loginTabBtn.click();
    };
  }

  /* ======================================================
     LOGIN (FIXED – tidak muncul alert palsu)
  ====================================================== */
  const loginForm = document.getElementById("login-form");
  const loginIdentifier = document.getElementById("login-identifier");
  const loginPassword = document.getElementById("login-password");

  if (loginForm) {
    loginForm.onsubmit = async e => {
      e.preventDefault();

      const identifier = loginIdentifier.value.trim();
      const password = loginPassword.value.trim();

      if (!identifier || !password) {
        alert("Nama/WhatsApp & password wajib diisi.");
        return;
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password })
      });

      const data = await res.json();

      if (!data.status) {
        alert(data.message || "Login gagal.");
        return;
      }

      alert("Login berhasil sebagai " + data.data.name);
    };
  }

  /* ======================================================
     CEK KUOTA (tidak diubah)
  ====================================================== */

  // ... (kode cek kuota kamu yang sudah benar)
});
