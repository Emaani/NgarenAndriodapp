/**
 * Encrypted, AsyncStorage-shaped storage backed by expo-secure-store.
 *
 * Supabase persists the session (access + refresh token + user) through a
 * simple getItem/setItem/removeItem interface. Storing that in plain
 * AsyncStorage leaves refresh tokens readable on a rooted/compromised device.
 * SecureStore keeps them in the Android Keystore / iOS keychain instead.
 *
 * SecureStore rejects large values on some platforms (~2 KB on iOS keychain),
 * and a Supabase session JSON can exceed that, so values are transparently
 * split into chunks. A one-time migration lifts any existing AsyncStorage
 * session into SecureStore on first read, so users already signed in are not
 * logged out by the upgrade.
 */
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Conservative per-chunk char budget; well under the ~2 KB byte ceiling even
// with multi-byte characters in a user's display name.
const CHUNK_SIZE = 1500;

// SecureStore keys allow only [A-Za-z0-9._-]; Supabase keys already comply, but
// normalise defensively so an unexpected key can never throw.
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');
const countKey = (key: string) => `${safeKey(key)}__n`;
const chunkKey = (key: string, i: number) => `${safeKey(key)}__${i}`;

async function clearChunks(key: string): Promise<void> {
  const nStr = await SecureStore.getItemAsync(countKey(key));
  const n = nStr ? parseInt(nStr, 10) : 0;
  const deletions: Promise<void>[] = [SecureStore.deleteItemAsync(countKey(key))];
  for (let i = 0; i < n; i++) deletions.push(SecureStore.deleteItemAsync(chunkKey(key, i)));
  await Promise.all(deletions);
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const nStr = await SecureStore.getItemAsync(countKey(key));
      if (nStr) {
        const n = parseInt(nStr, 10);
        const parts: string[] = [];
        for (let i = 0; i < n; i++) {
          const part = await SecureStore.getItemAsync(chunkKey(key, i));
          if (part == null) return null; // corrupt/partial write — treat as absent
          parts.push(part);
        }
        return parts.join('');
      }

      // One-time migration from a pre-SecureStore install.
      const legacy = await AsyncStorage.getItem(key);
      if (legacy != null) {
        await this.setItem(key, legacy);
        await AsyncStorage.removeItem(key);
        return legacy;
      }
      return null;
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      await clearChunks(key);
      const chunks = Math.ceil(value.length / CHUNK_SIZE) || 1;
      const writes: Promise<void>[] = [SecureStore.setItemAsync(countKey(key), String(chunks))];
      for (let i = 0; i < chunks; i++) {
        writes.push(SecureStore.setItemAsync(chunkKey(key, i), value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)));
      }
      await Promise.all(writes);
    } catch {
      // Storage failures must not crash auth; the session simply won't persist.
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await clearChunks(key);
    } catch {
      // ignore
    }
  },
};
