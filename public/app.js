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
  // HELPER FORMAT STRING
  // ============================

  // Rapikan spasi antara angka dan huruf: 19GB -> 19 GB, 7.5GB -> 7.5 GB
  function normalizeAmount(str) {
    if (!str) return "";
    let s = String(str);
    s = s.replace(/([0-9])([A-Za-z])/g, "$1 $2");
    s = s.replace(/([A-Za-z])([0-9])/g, "$1 $2");
    return s.trim();
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
  // PARSE HEADER DARI "hasil"
  // ============================
  function parseHeaderFromHasil(hasilHtml) {
    if (!hasilHtml) return {};

    const text = hasilHtml
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/\r/g, "");

    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const header = {};

    for (const line of lines) {
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
    }

    return header;
  }

  // ============================
  // PARSE PAKET DARI data_sp.quotas
  // ============================
  function parsePaketsFromQuotas(quotasValue) {
    const pakets = [];

    if (!Array.isArray(quotasValue)) return pakets;

    // quotas.value adalah array 2D: [[{ packages, benefits }]]
    quotasValue.forEach((group) => {
      if (!Array.isArray(group)) return;

      group.forEach((item) => {
        const expDate = item?.packages?.expDate || null;
        const benefits = item?.benefits || [];

        benefits.forEach((b) => {
          pakets.push({
            nama: b.bname || "Paket",
            tipe: b.type || "",
            total: b.quota || "",
            sisa: b.remaining || "",
            masaAktif: expDate || "", // ISO 2025-12-04T23:59:59
          });
        });
      });
    });

    return pakets;
  }

  // ============================
  // GABUNG HEADER + PAKET
  // ============================
  function buildParsedResult(hasilHtml, quotasValue) {
    const header = parseHeaderFromHasil(hasilHtml);
    const pakets = parsePaketsFromQuotas(quotasValue);
    return { header, pakets };
  }

  // ============================
  // RENDER HASIL KE DOM
  // ============================
  const cekResultBody = document.getElementById("cek-result-body");

  function renderParsedResult(parsed, fallbackText) {
    if (!cekResultBody) return;

    let html = "";

    const h = parsed.header || {};
    const hasHeader =
      h.msisdn || h.tipeKartu || h.masaAktif || h.masaTenggang;
    const hasPakets = parsed.pakets && parsed.pakets.length > 0;

    // ---------- SUMMARY NOMOR ----------
    if (hasHeader) {
      html += `<div class="cek-summary">`;

      if (h.msisdn) {
        html += `<div class="summary-main">${h.msisdn}</div>`;
      }

      if (h.tipeKartu) {
        html += `
          <div class="cek-summary-line">
            <span class="label">Kartu</span>
            <span style="font-weight:600;">${h.tipeKartu}</span>
          </div>`;
      }

      if (h.masaAktif) {
        html += `
          <div class="cek-summary-line">
            <span class="label">Masa aktif</span>
            <span style="font-weight:600;">${h.masaAktif}</span>
          </div>`;
      }

      if (h.masaTenggang) {
        html += `
          <div class="cek-summary-line">
            <span class="label">Tenggang</span>
            <span style="font-weight:600;">${h.masaTenggang}</span>
          </div>`;
      }

      html += `</div>`;
    }

    // ---------- TIDAK ADA KUOTA ----------
    if (!hasPakets) {
      if (!hasHeader && fallbackText) {
        cekResultBody.textContent = fallbackText;
      } else {
        html += `<div class="no-paket-msg">Anda tidak memiliki kuota aktif.</div>`;
        cekResultBody.innerHTML = html;
      }
      return;
    }

    // ---------- DAFTAR PAKET ----------
    html += `<div class="paket-list">`;

    parsed.pakets.forEach((p) => {
      const cls = typeToClass(p.tipe);
      html += `<div class="paket-card ${cls}">`;
      html += `<div class="paket-title">${p.nama || "Paket"}</div>`;
      html += createLine("Tipe", p.tipe);
      html += createLine("Kuota", p.total);
      html += createLine("Sisa", p.sisa);

      // masa aktif paket (dari expDate)
      if (p.masaAktif) {
        let cleanDate = String(p.masaAktif).replace("T", " ");
        html += createLine("Masa aktif", cleanDate);
      }

      html += `</div>`;
    });

    html += `</div>`;

    cekResultBody.innerHTML = html;
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
        const quotasValue = json?.data?.data_sp?.quotas?.value;

        if (!hasilHtml && !quotasValue) {
          cekResultBody.textContent =
            "Respons tidak berisi data kuota yang dikenali.";
          return;
        }

        const parsed = buildParsedResult(hasilHtml, quotasValue);
        const fallbackText = hasilHtml
          ? hasilHtml.replace(/<br\s*\/?>/gi, "\n")
          : "";
        renderParsedResult(parsed, fallbackText);
      } catch (err) {
        cekResultBody.textContent =
          "Terjadi kesalahan saat menghubungi server: " + err.message;
      }
    });
  }
});
