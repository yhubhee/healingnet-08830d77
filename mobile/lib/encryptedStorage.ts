// "Large secure store": the secure store can only hold small values, so each value is
// encrypted with a fresh AES-256 key; the key lives in the secure store (Keychain /
// Keystore) and the encrypted value in AsyncStorage. Used for the session and for the
// saved (offline) data.
import * as aesjs from "aes-js";

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface EncryptedStorageDeps {
  /** Holds the AES keys (expo-secure-store). */
  keys: KeyValueStore;
  /** Holds the encrypted values (AsyncStorage). */
  values: KeyValueStore;
  randomBytes(count: number): Uint8Array;
}

export function createEncryptedStorage({ keys, values, randomBytes }: EncryptedStorageDeps): KeyValueStore {
  return {
    async getItem(key) {
      const encrypted = await values.getItem(key);
      if (!encrypted) return null;
      const keyHex = await keys.getItem(key);
      if (!keyHex) return null;
      try {
        const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(keyHex), new aesjs.Counter(1));
        return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(encrypted)));
      } catch {
        return null;
      }
    },
    async setItem(key, value) {
      const aesKey = randomBytes(32);
      const cipher = new aesjs.ModeOfOperation.ctr(aesKey, new aesjs.Counter(1));
      const encrypted = aesjs.utils.hex.fromBytes(cipher.encrypt(aesjs.utils.utf8.toBytes(value)));
      await keys.setItem(key, aesjs.utils.hex.fromBytes(aesKey));
      await values.setItem(key, encrypted);
    },
    async removeItem(key) {
      await values.removeItem(key);
      await keys.removeItem(key);
    },
  };
}
