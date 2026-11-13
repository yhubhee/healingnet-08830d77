// The QR pattern for a piece of text, as rows of dark (true) and light (false) squares.
// Used for the on-screen code and for the PDF, so the app needs only one QR library.
import QRCode from "qrcode";

export function qrRows(text: string): boolean[][] | null {
  try {
    const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
    const rows: boolean[][] = [];
    for (let y = 0; y < modules.size; y++) {
      const row: boolean[] = [];
      for (let x = 0; x < modules.size; x++) row.push(!!modules.data[y * modules.size + x]);
      rows.push(row);
    }
    return rows;
  } catch {
    return null;
  }
}

/** One SVG path for all the dark squares; each run of dark squares in a row is one rectangle. */
export function qrPath(rows: boolean[][]): string {
  let d = "";
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) { x++; continue; }
      let end = x;
      while (end < row.length && row[end]) end++;
      d += `M${x} ${y}h${end - x}v1h-${end - x}z`;
      x = end;
    }
  });
  return d;
}
