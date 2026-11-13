// Pages opened in the in-app browser: the video visit, the privacy policy and the terms.
import * as WebBrowser from "expo-web-browser";
import { Linking } from "react-native";
import { webPage } from "@/shared/links";
import { WEB_URL } from "./env";

export async function openUrl(url: string): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    await Linking.openURL(url).catch(() => {});
  }
}

/** Opens a page on the HealingNet website, e.g. openWeb("/privacy"). */
export const openWeb = (path: string) => openUrl(webPage(WEB_URL, path));
