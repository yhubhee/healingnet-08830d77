// The device stores used by the app.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { createEncryptedStorage, type KeyValueStore } from "./encryptedStorage";

// Secure-store keys may only contain letters, numbers, ".", "-" and "_".
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, "_");

const secureKeys: KeyValueStore = {
  getItem: (key) => SecureStore.getItemAsync(safeKey(key)),
  setItem: (key, value) => SecureStore.setItemAsync(safeKey(key), value),
  removeItem: (key) => SecureStore.deleteItemAsync(safeKey(key)),
};

/** Encrypted storage for the session and the saved (offline) data. */
export const encryptedStorage = createEncryptedStorage({
  keys: secureKeys,
  values: AsyncStorage,
  randomBytes: (n) => Crypto.getRandomBytes(n),
});

/** Where the saved query data lives in encrypted storage. */
export const QUERY_CACHE_KEY = "hn.query-cache";

// ---- Small device settings (nothing personal): plain AsyncStorage --------------------
export const DEVICE_KEYS = {
  appLock: "hn.app-lock",
  pushToken: "hn.push-token",
  pushAsked: "hn.push-asked",
  labsSeen: "hn.labs-seen",
} as const;

export async function getFlag(key: string): Promise<string | null> {
  try { return await AsyncStorage.getItem(key); } catch { return null; }
}
export async function setFlag(key: string, value: string | null): Promise<void> {
  try {
    if (value === null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, value);
  } catch { /* a device setting that fails to save is not worth interrupting the user for */ }
}
