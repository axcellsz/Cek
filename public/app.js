document.addEventListener("DOMContentLoaded", () => {
  // ============================
  // FORMAT NOMOR (Fix 628xx → 08xx)
  // ============================
  function formatMsisdn(num) {
    if (!num) return "";
    let s = String(num).trim();

    // +62877xxxx → 0877xxxx
    if (s.startsWith("+62")) return "0" + s.slice(3);
    // 62877xxxx → 0877xxxx
    if (s.startsWith("62")) return "0" + s.slice(2);
    // 08xxxxx → sudah benar
    if (s.startsWith("0")) return s;
    // 8xxxxx → tambahkan 0 di depan
    if (s.startsWith("8")) return "0" + s;

    return s;
  }

  // ============================
  // NAVIGASI BOTTOM BAR
  // ============================
  const navButtons = document.querySelectorAll(".nav-btn");
  const screens = document.querySelectorAll(".screen");

  function showScreen(name) {
    screens.forEach(s => s.style.display = "none");

    if (!name) {
      const def = document.getElementById("screen-default");
      if (def) def.style.display = "flex";
      return;
    }

    const target = document.getElementById("screen-" + name);
    if (target) target.style.display = name === "cek" ? "block" : "flex";
  }

  function setActiveNav(name) {
    navButtons.forEach(btn => btn.classList.remove("active"));
    navButtons.forEach(btn => {
      if (btn.dataset.screen === name) btn.classList.add("active");
    });
  }

  navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.screen;
      showScreen(name);
      setActiveNav(name);
    });
  });

  showScreen(null);

  // ============================
  // HELPER FORMAT KUOTA
  // ============================
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
      ? `<span style="font-weight:600;color:#16a34a;">${normalizeAmount(value)}</span>`
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
  // PARSE HEADER (hasil html)
  // ============================
  function parseHeaderFromHasil(hasilHtml) {
    if (!hasilHtml) return {};

    const text = hasilHtml.replace(/<br\s*\/?>/gi, "\n").replace(/\r/g, "");
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

    const header = {};

    for (const line of lines) {
      if (line.startsWith("MSISDN:"))
        header.msisdn = formatMsisdn(line.replace("MSISDN:", "").trim());
      else if (line.startsWith("Tipe Kartu:"))
        header.tipeKartu = line.replace("Tipe Kartu:", "").trim();
      else if (line.startsWith("Masa Aktif:"))
        header.masaAktif = line.replace("Masa Aktif:", "").trim();
      else if (line.startsWith("Masa Berakhir Tenggang"))
        header.masaTenggang = line.split(":").slice(1).join(":").trim();
    }

    return header;
  }

  // ============================
  // PARSE PAKET dari data_sp.quotas
  // ============================
  function parsePaketsFromQuotas(quotasValue) {
    const pakets = [];

    if (!Array.isArray(quotasValue)) return pakets;

    quotasValue.forEach(group => {
      if (!Array.isArray(group)) return;

      group.forEach(item => {
        const expDate = item?.packages?.expDate || null;
        const benefits = item?.benefits || [];

        benefits.forEach(b => {
          pakets.push({
            nama: b.bname || "Paket",
            tipe: b.type || "",
            total: b.quota || "",
            sisa: b.remaining || "",
            masaAktif: expDate || ""
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
    return {
      header: parseHeaderFromHasil(hasilHtml),
      pakets: parsePaketsFromQuotas(quotasValue)
    };
  }

  // ============================
  // RENDER HASIL
  // ============================
  const cekResultBody = document.getElementById("cek-result-body");

  function renderParsedResult(parsed, fallbackText) {
    if (!cekResultBody) return;

    let html = "";
    const h = parsed.header;
    const hasHeader = h.msisdn || h.tipeKartu || h.masaAktif || h.masaTenggang;
    const hasPakets = parsed.pakets && parsed.pakets.length > 0;

    // ===== SUMMARY HEADER =====
    if (hasHeader) {
      html += `<div class="cek-summary">`;

      if (h.msisdn) {
        html += `<div class="summary-main">${h.msisdn}</div>`;
      }

      if (h.tipeKartu) {
        html += `<div class="cek-summary-line"><span class="label">Kartu</span><span style="font-weight:600;">${h.tipeKartu}</span></div>`;
      }

      if (h.masaAktif) {
        html += `<div class="cek-summary-line"><span class="label">Masa aktif</span><span style="font-weight:600;">${h.masaAktif}</span></div>`;
      }

      if (h.masaTenggang) {
        html += `<div class="cek-summary-line"><span class="label">Tenggang</span><span style="font-weight:600;">${h.masaTenggang}</span></div>`;
      }

      html += `</div>`;
    }

    // ===== TIDAK ADA KUOTA =====
    if (!hasPakets) {
      html += `<div class="no-paket-msg">Anda tidak memiliki kuota aktif.</div>`;
      cekResultBody.innerHTML = html;
      return;
    }

    // ===== LIST KUOTA =====
    html += `<div class="paket-list">`;

    parsed.pakets.forEach(p => {
      html += `<div class="paket-card">`;
      html += `<div class="paket-title">${p.nama}</div>`;
      html += createLine("Tipe", p.tipe);
      html += createLine("Kuota", p.total);
      html += createLine("Sisa", p.sisa);

      if (p.masaAktif) {
        let cleanDate = p.masaAktif.replace("T", " ");
        html += createLine("Masa aktif", cleanDate);
      }

      html += `</div>`;
    });

    html += `</div>`;

    cekResultBody.innerHTML = html;
  }

  // ============================
  // FORM CEK KUOTA
  // ============================
  const cekForm = document.getElementById("cek-form");
  const cekNumberInput = document.getElementById("cek-number");

  if (cekForm && cekNumberInput && cekResultBody) {
    cekForm.addEventListener("submit", async e => {
      e.preventDefault();

      const nomor = cekNumberInput.value.trim();
      if (!nomor) {
        cekResultBody.textContent = "Nomor belum diisi.";
        return;
      }

      cekResultBody.textContent = "Memeriksa kuota...\nMohon tunggu.";

      try {
        const res = await fetch("/api/cek-kuota?msisdn=" + encodeURIComponent(nomor));
        if (!res.ok) {
          cekResultBody.textContent = "Gagal mengakses server. Status: " + res.status;
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
          cekResultBody.textContent = "Tidak ada data kuota.";
          return;
        }

        const parsed = buildParsedResult(hasilHtml, quotasValue);
        const fallbackText = hasilHtml ? hasilHtml.replace(/<br\s*\/?>/gi, "\n") : "";

        renderParsedResult(parsed, fallbackText);

      } catch (err) {
        cekResultBody.textContent = "Error: " + err.message;
      }
    });
  }
});
