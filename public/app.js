document.addEventListener("DOMContentLoaded", () => {
  // ============================
  // NAVIGASI BOTTOM BAR
  // ============================
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
      if (btn.dataset.screen === name) {
        btn.classList.add("active");
      }
    });
  }

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.screen;
      showScreen(name);
      setActiveNav(name);
    });
  });

  // Tampilkan screen awal
  showScreen(null);

  // ============================
  // HELPER UNTUK FORMAT STRING
  // ============================

  // Rapikan spasi antara angka dan huruf: 19GB -> 19 GB, 7.5GB -> 7.5 GB
  function normalizeAmount(str) {
    if (!str) return "";
    let s = String(str);
    s = s.replace(/([0-9])([A-Za-z])/g, "$1 $2");
    s = s.replace(/([A-Za-z])([0-9])/g, "$1 $2");
    return s.trim();
  }

  // label & value tebal, "Sisa" hijau
  function createLine(label, value, isSisa = false) {
    if (!value) return "";
    return `
      <div class="paket-line">
        <span class="label"><b>${label}:</b></span>
        <span class="value-strong" style="font-weight:700; ${isSisa ? "color:#16a34a;" : ""}">
          ${normalizeAmount(value)}
        </span>
      </div>
    `;
  }

  function typeToClass(tipe) {
    if (!tipe) return "";
    const t = tipe.toLowerCase();
    if (t.includes("voice") || t.includes("nelp") || t.includes("telp")) return "voice";
    if (t.includes("sms")) return "sms";
    if (t.includes("data")) return "data";
    return "";
  }

  // ============================
  // PARSE STRING "hasil" DARI API
  // ============================
  function parseHasilString(hasilHtml) {
    const text = hasilHtml
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/\r/g, "");
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const header = {};
    const pakets = [];
    let current = null;

    for (const line of lines) {
      // Header
      if (line.startsWith("MSISDN:")) {
        header.msisdn = line.replace("MSISDN:", "").trim();
      } else if (line.startsWith("Tipe Kartu:")) {
        header.tipeKartu = line.replace("Tipe Kartu:", "").trim();
      } else if (line.startsWith("Masa Aktif:")) {
        header.masaAktif = line.replace("Masa Aktif:", "").trim();
      } else if (
        line.startsWith("Masa Berakhir Tenggang:") ||
        line.startsWith("Masa Berakhir Tenggang")
      ) {
        header.masaTenggang = line.split(":").slice(1).join(":").trim();
      }

      // Paket baru
      if (line.startsWith("🎁 Benefit:") || line.startsWith("Benefit:")) {
        if (current) pakets.push(current);
        current = { nama: line.split(":").slice(1).join(":").trim() };
        continue;
      }

      // Detail paket
      if (!current) continue;

      if (line.toLowerCase().includes("tipe kuota")) {
        current.tipe = line.split(":").slice(1).join(":").trim();
      } else if (line.toLowerCase().includes("sisa kuota")) {
        current.sisa = line.split(":").slice(1).join(":").trim();
      } else if (
        line.toLowerCase().includes("kuota") &&
        !line.toLowerCase().includes("sisa kuota")
      ) {
        current.total = line.split(":").slice(1).join(":").trim();
      }
    }

    if (current) pakets.push(current);

    return { header, pakets };
  }

  // ============================
  // RENDER HASIL KE DOM
  // ============================
  const cekResultBody = document.getElementById("cek-result-body");

  function renderParsedResult(parsed, fallbackText) {
    if (!cekResultBody) return;

    let html = "";

    const h = parsed.header;
    const hasHeader = h.msisdn || h.tipeKartu || h.masaAktif || h.masaTenggang;
    const hasPakets = parsed.pakets && parsed.pakets.length > 0;

    // SUMMARY (kartu info nomor)
    if (hasHeader) {
      html += `<div class="cek-summary">`;

      if (h.msisdn) {
        html += `<div class="summary-main"><b>${h.msisdn}</b></div>`;
      }

      if (h.tipeKartu) {
        html += `
          <div class="cek-summary-line">
            <span class="label"><b>Kartu</b></span>
            <span class="value-strong" style="font-weight:700">${h.tipeKartu}</span>
          </div>`;
      }

      if (h.masaAktif) {
        html += `
          <div class="cek-summary-line">
            <span class="label"><b>Masa aktif</b></span>
            <span class="value-strong" style="font-weight:700">${h.masaAktif}</span>
          </div>`;
      }

      if (h.masaTenggang) {
        html += `
          <div class="cek-summary-line">
            <span class="label"><b>Tenggang</b></span>
            <span class="value-strong" style="font-weight:700">${h.masaTenggang}</span>
          </div>`;
      }

      html += `</div>`;
    }

    // DAFTAR PAKET
    if (hasPakets) {
      html += `<div class="paket-section-title">DAFTAR KUOTA</div>`;
      html += `<div class="paket-list">`;

      parsed.pakets.forEach((p) => {
        const cls = typeToClass(p.tipe);
        html += `<div class="paket-card ${cls}">`;
        html += `<div class="paket-title">${p.nama || "Paket"}</div>`;
        html += createLine("Tipe", p.tipe);
        html += createLine("Kuota", p.total);
        html += createLine("Sisa", p.sisa, true); // hijau & bold
        html += `</div>`;
      });

      html += `</div>`;
    }

    if (!html) {
      cekResultBody.textContent =
        fallbackText || "Tidak ada data kuota yang bisa ditampilkan.";
    } else {
      cekResultBody.innerHTML = html;
    }
  }

  // ============================
  // CEK KUOTA: LOGIKA FORM
  // ============================
  const cekForm = document.getElementById("cek-form");
  const cekNumberInput = document.getElementById("cek-number");

  if (cekForm && cekNumberInput && cekResultBody) {
    cekForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const nomor = (cekNumberInput.value || "").trim();
      if (!nomor) {
        cekResultBody.textContent =
          "Nomor belum diisi. Silakan masukkan nomor terlebih dahulu.";
        return;
      }

      cekResultBody.textContent = "Memeriksa kuota...\nMohon tunggu.";

      try {
        const res = await fetch(
          "/api/cek-kuota?msisdn=" + encodeURIComponent(nomor)
        );
        if (!res.ok) {
          cekResultBody.textContent =
            "Gagal mengakses server. Status: " + res.status;
          return;
        }

        const text = await res.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch {
          cekResultBody.textContent = text;
          return;
        }

        const hasilHtml = json?.data?.hasil;
        if (!hasilHtml) {
          cekResultBody.textContent =
            "Respons tidak berisi data kuota yang dikenali.";
          return;
        }

        const parsed = parseHasilString(hasilHtml);
        const fallbackText = hasilHtml.replace(/<br\s*\/?>/gi, "\n");
        renderParsedResult(parsed, fallbackText);
      } catch (err) {
        cekResultBody.textContent =
          "Terjadi kesalahan saat menghubungi server: " + err.message;
      }
    });
  }
});
