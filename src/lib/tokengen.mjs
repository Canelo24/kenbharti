// Shared token/QR/PDF generation logic.
// Plain JS (.mjs) so BOTH the Next.js admin routes and the
// standalone `npm run generate` script can use it.

import { randomBytes } from "crypto";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** 10-char base58 slug from crypto randomness (unguessable). */
export function makeSlug() {
  const bytes = randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i++) out += BASE58[bytes[i] % 58];
  return out;
}

/**
 * Build 850 token records: 800 main (KB-0001..KB-0800) +
 * 50 reserve (KB-0801..KB-0850, is_reserve, inactive until enabled).
 */
export function makeTokenRecords(mainCount = 800, reserveCount = 50) {
  const records = [];
  const total = mainCount + reserveCount;
  for (let i = 1; i <= total; i++) {
    const isReserve = i > mainCount;
    records.push({
      slug: makeSlug(),
      display_code: `KB-${String(i).padStart(4, "0")}`,
      is_reserve: isReserve,
      active: !isReserve,
    });
  }
  return records;
}

/** tokens.csv content: code, slug, full URL. */
export function buildCsv(tokens, baseUrl) {
  const lines = ["display_code,slug,url"];
  for (const t of tokens) {
    lines.push(`${t.display_code},${t.slug},${baseUrl}/v/${t.slug}`);
  }
  return lines.join("\n");
}

/**
 * qr-cards.pdf — A4, 8 cards per page (2 x 4).
 * Each card: QR (>= 3cm), display code, event title, keep-this-card line.
 * Returns a Uint8Array of PDF bytes.
 */
export async function buildQrPdf(tokens, baseUrl) {
  const pdf = await PDFDocument.create();
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const A4 = { w: 595.28, h: 841.89 };
  const cols = 2;
  const rows = 4;
  const cardW = A4.w / cols;
  const cardH = A4.h / rows;
  const qrSize = 100; // ~3.5cm — comfortably scannable
  const navy = rgb(0.04, 0.06, 0.15);
  const saffron = rgb(1, 0.6, 0.2);

  let page = null;
  for (let i = 0; i < tokens.length; i++) {
    const posOnPage = i % (cols * rows);
    if (posOnPage === 0) page = pdf.addPage([A4.w, A4.h]);
    const col = posOnPage % cols;
    const row = Math.floor(posOnPage / cols);
    const x0 = col * cardW;
    const y0 = A4.h - (row + 1) * cardH;
    const t = tokens[i];

    // Card border (cutting guide)
    page.drawRectangle({
      x: x0 + 6,
      y: y0 + 6,
      width: cardW - 12,
      height: cardH - 12,
      borderColor: rgb(0.75, 0.75, 0.75),
      borderWidth: 0.7,
    });

    // Event title
    page.drawText("MAA TUJHE SALAAM", {
      x: x0 + 20,
      y: y0 + cardH - 32,
      size: 13,
      font: fontBold,
      color: navy,
    });
    page.drawText("Kenbharti", {
      x: x0 + 20,
      y: y0 + cardH - 46,
      size: 9,
      font,
      color: saffron,
    });

    // QR code
    const url = `${baseUrl}/v/${t.slug}`;
    const png = await QRCode.toBuffer(url, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 300,
    });
    const qrImg = await pdf.embedPng(png);
    page.drawImage(qrImg, {
      x: x0 + 20,
      y: y0 + cardH - 58 - qrSize,
      width: qrSize,
      height: qrSize,
    });

    // Display code — big, right of the QR
    page.drawText(t.display_code, {
      x: x0 + qrSize + 34,
      y: y0 + cardH / 2 - 4,
      size: 22,
      font: fontBold,
      color: navy,
    });
    if (t.is_reserve) {
      page.drawText("RESERVE", {
        x: x0 + qrSize + 34,
        y: y0 + cardH / 2 - 20,
        size: 9,
        font: fontBold,
        color: rgb(0.8, 0.2, 0.2),
      });
    }

    // Footer line
    page.drawText("Scan to vote & enter the raffle!", {
      x: x0 + 20,
      y: y0 + 30,
      size: 10,
      font: fontBold,
      color: navy,
    });
    page.drawText("Keep this card.", {
      x: x0 + 20,
      y: y0 + 17,
      size: 10,
      font,
      color: navy,
    });
  }

  return pdf.save();
}
