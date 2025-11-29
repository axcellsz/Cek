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
    // ---------- HEADER ----------
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

    // ---------- PAKET BARU ----------
    if (line.startsWith("🎁 Benefit:") || line.startsWith("Benefit:")) {
      if (current) pakets.push(current);
      current = { nama: line.split(":").slice(1).join(":").trim() };
      continue;
    }

    if (!current) continue;

    // ---------- DETAIL PAKET ----------
    if (line.toLowerCase().includes("tipe kuota")) {
      current.tipe = line.split(":").slice(1).join(":").trim();
      continue;
    }

    if (line.toLowerCase().includes("sisa kuota")) {
      current.sisa = line.split(":").slice(1).join(":").trim();
      continue;
    }

    if (
      line.toLowerCase().includes("kuota") &&
      !line.toLowerCase().includes("sisa kuota")
    ) {
      current.total = line.split(":").slice(1).join(":").trim();
      continue;
    }

    // ---------- MASA AKTIF KUOTA (yang kamu mau) ----------
    const aktifMatch = line.match(/Aktif\s*s\.d\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (aktifMatch) {
      current.masaAktif = aktifMatch[1];
      continue;
    }
  }

  if (current) pakets.push(current);

  return { header, pakets };
}
