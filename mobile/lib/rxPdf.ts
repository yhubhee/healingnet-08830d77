// Share a prescription as a PDF (the same content as the website's print page).
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { verifyUrl } from "@/shared/links";
import type { RxPayload } from "@/shared/pharmacy";
import { rxHtml } from "@/shared/rxHtml";
import { WEB_URL } from "./env";
import { qrRows } from "./qr";

export async function shareRxPdf(doc: RxPayload): Promise<"shared" | "unavailable"> {
  const html = rxHtml(doc, WEB_URL, doc.code ? qrRows(verifyUrl(WEB_URL, doc.code)) : null);
  const { uri } = await Print.printToFileAsync({ html });
  if (!(await Sharing.isAvailableAsync())) return "unavailable";
  await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Share prescription" });
  return "shared";
}
