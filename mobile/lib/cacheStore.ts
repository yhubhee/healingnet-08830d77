// Where the saved (offline) data lives: an MMKV store that encrypts natively (AES-256),
// off the JavaScript thread. Its key is made once, kept in the phone's secure store
// (Keychain / Keystore) and reused: it is never rewritten on a save.
//
// MMKV is a native module, so it needs a development build (it is not in Expo Go).
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { createMMKV, deleteMMKV, existsMMKV } from "react-native-mmkv";
import { migrateOldCache, type SyncStore } from "@/shared/queryPersist";
import { encryptedStorage, QUERY_CACHE_KEY } from "./storage";

const STORE_ID = "hn-cache";
const KEY_NAME = "hn.cache-key";
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** 32 random bytes as 32 characters (AES-256 takes a key of up to 32 bytes). */
function newKey(): string {
  return Array.from(Crypto.getRandomBytes(32), (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Used if the encrypted store cannot be opened: the app still works, nothing is saved. */
function memoryStore(): SyncStore {
  const map = new Map<string, string>();
  return {
    getString: (k) => map.get(k),
    set: (k, v) => { map.set(k, v); },
    remove: (k) => { map.delete(k); },
    keys: () => [...map.keys()],
    clear: () => map.clear(),
  };
}

async function open(): Promise<SyncStore> {
  try {
    let key = await SecureStore.getItemAsync(KEY_NAME);
    if (!key || key.length !== 32) {
      // No key: any file left behind (a restored backup) cannot be read, so it is removed.
      if (existsMMKV(STORE_ID)) deleteMMKV(STORE_ID);
      key = newKey();
      await SecureStore.setItemAsync(KEY_NAME, key);
    }
    const mmkv = createMMKV({ id: STORE_ID, encryptionKey: key, encryptionType: "AES-256" });
    const store: SyncStore = {
      getString: (k) => mmkv.getString(k),
      set: (k, v) => mmkv.set(k, v),
      remove: (k) => { mmkv.remove(k); },
      keys: () => mmkv.getAllKeys(),
      clear: () => mmkv.clearAll(),
    };
    // First start of 0.4: bring the 0.3 blob across once, then delete it and its key.
    await migrateOldCache({
      store,
      now: Date.now(),
      readOld: () => encryptedStorage.getItem(QUERY_CACHE_KEY),
      deleteOld: async () => {
        await encryptedStorage.removeItem(QUERY_CACHE_KEY);
        await AsyncStorage.removeItem(QUERY_CACHE_KEY);
      },
    });
    return store;
  } catch {
    return memoryStore();
  }
}

/** Opened once, as soon as this file loads, while the fonts and the session are read. */
export const cacheStore: Promise<SyncStore> = open();
