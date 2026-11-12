// Share a prescription as a PDF (the same content as the website's print page).
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import QRCode from "qrcode";
import { verifyUrl } from "@/shared/links";
import type { RxPayload } from "@/shared/pharmacy";
import { rxHtml } from "@/shared/rxHtml";
import { WEB_URL } from "./env";

function qrRows(text: string): boolean[][] | null {
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

export async function shareRxPdf(doc: RxPayload): Promise<"shared" | "unavailable"> {
  const html = rxHtml(doc, WEB_URL, doc.code ? qrRows(verifyUrl(WEB_URL, doc.code)) : null);
  const { uri } = await Print.printToFileAsync({ html });
  if (!(await Sharing.isAvailableAsync())) return "unavailable";
  await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Share prescription" });
  return "shared";
}
