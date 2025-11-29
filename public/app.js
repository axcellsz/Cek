document.addEventListener("DOMContentLoaded", () => {
  // ======= NAVIGASI BOTTOM BAR =======
  const navButtons = document.querySelectorAll(".nav-btn");
  const screens = document.querySelectorAll(".screen");

  function showScreen(name) {
    screens.forEach((s) => {
      s.style.display = "none";
    });

    if (!name) {
      const def = document.getElementById("screen-default");
      def.style.display = "flex";
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
    btn.addEventListener("click", function () {
      const name = this.dataset.screen;
      showScreen(name);
      setActiveNav(name);
    });
  });

  // Tampilkan screen default saat awal
  showScreen(null);

  // ======= PARSING HASIL KUOTA =======
  function parseHasilString(hasilHtml) {
    const text = hasilHtml.replace(/<br\s*\/?>/gi, "\n").replace(/\r/g, "");
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const header = {};
    const pakets = [];
    let current = null;

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

      if (line.startsWith("🎁 Benefit:") || line.startsWith("Benefit:")) {
        if (current) pakets.push(current);
        current = { nama: line.split(":").slice(1).join(":").trim() };
      } else if (
        current &&
        (line.includes("Tipe Kuota:") || line.includes("Tipe Kuota"))
      ) {
        current.tipe = line.split(":").slice(1).join(":").trim();
      } else if (current && line.includes("Sisa Kuota:")) {
        current.sisa = line.split(":").slice(1).join(":").trim();
      } else if (current && line.includes("Kuota:") && !line.includes("Sisa Kuota")) {
        current.total = line.split(":").slice(1).join(":").trim();
      }
    }

    if (current) pakets.push(current);

    return { header, pakets };
  }

  function typeToClass(tipe) {
    if (!tipe) return "";
    const t = tipe.toLowerCase();
    if (t.includes("voice") || t.includes("nelp") || t.includes("telp")) return "voice";
    if (t.includes("sms")) return "sms";
    if (t.includes("data")) return "data";
    return "";
  }

  function renderResultParsed(container, parsed, rawFallback) {
    if (!parsed.header.msisdn && !parsed.pakets.length && rawFallback) {
      container.textContent = rawFallback;
      return;
    }

    let html = "";

    // SUMMARY
    if (parsed.header.msisdn || parsed.header.tipeKartu || parsed.header.masaAktif) {
      html += '<div class="cek-summary">';
      if (parsed.header.msisdn) {
        html += '<div class="summary-main">' + parsed.header.msisdn + "</div>";
      }
      if (parsed.header.tipeKartu) {
        html +=
          '<div class="cek-summary-line"><span class="label">Kartu</span><strong>' +
          parsed.header.tipeKartu +
          "</strong></div>";
      }
      if (parsed.header.masaAktif) {
        html +=
          '<div class="cek-summary-line"><span class="label">Masa aktif</span>' +
          parsed.header.masaAktif +
          "</div>";
      }
      if (parsed.header.masaTenggang) {
        html +=
          '<div class="cek-summary-line"><span class="label">Tenggang</span>' +
          parsed.header.masaTenggang +
          "</div>";
      }
      html += "</div>";
    }

    // PAKET
    if (parsed.pakets.length) {
      html += '<div class="paket-section-title">Daftar kuota</div>';
      html += '<div class="paket-list">';
      parsed.pakets.forEach(function (p) {
        const cls = typeToClass(p.tipe);
        html += '<div class="paket-card ' + cls + '">';
        html += '<div class="paket-title">' + (p.nama || "Paket") + "</div>";
        if (p.tipe) {
          html +=
            '<div class="paket-line"><span class="label">Tipe</span>' +
            p.tipe +
            "</div>";
        }
        if (p.total) {
          html +=
            '<div class="paket-line"><span class="label">Kuota</span><span class="value-strong">' +
            p.total +
            "</span></div>";
        }
        if (p.sisa) {
          html +=
            '<div class="paket-line"><span class="label">Sisa</span><span class="value-strong">' +
            p.sisa +
            "</span></div>";
        }
        html += "</div>";
      });
      html += "</div>";
    }

    if (!html && rawFallback) {
      container.textContent = rawFallback;
      return;
    }

    container.innerHTML = html;
  }

  // ====== CEK KUOTA via Worker Proxy ======
  const cekForm = document.getElementById("cek-form");
  const cekNumberInput = document.getElementById("cek-number");
  const cekResultBody = document.getElementById("cek-result-body");

  cekForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const nomor = (cekNumberInput.value || "").trim();
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
      } catch (err) {
        cekResultBody.textContent = text;
        return;
      }

      if (!json || !json.data || !json.data.hasil) {
        cekResultBody.textContent = JSON.stringify(json, null, 2);
        return;
      }

      const hasil = json.data.hasil;
      const parsed = parseHasilString(hasil);
      const fallbackText = hasil.replace(/<br\s*\/?>/gi, "\n");
      renderResultParsed(cekResultBody, parsed, fallbackText);
    } catch (err) {
      cekResultBody.textContent = "Terjadi kesalahan: " + err.message;
    }
  });
});
