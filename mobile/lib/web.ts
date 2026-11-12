// Hand-offs to the website (in-app browser) for the parts that arrive in a later version.
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

/** Opens a page on the HealingNet website, e.g. openWeb("/patient/messages"). */
export const openWeb = (path: string) => openUrl(webPage(WEB_URL, path));
