/**
 * Photo persistence (Oct 2026 — permanent Photo ID fix).
 *
 * expo-image-picker returns a URI inside the app's CACHE directory, which
 * Android can purge at any time (low storage, app update, reinstall). That is
 * why captured Photo IDs "disappeared" for testers. We copy every freshly
 * captured image into the persistent document directory, whose files survive
 * cache clearing, app updates and reinstalls, and store that stable URI instead.
 *
 * Remote URLs and already-persisted files are returned unchanged. The copy is
 * best-effort — on any failure the original URI is returned, so this can never
 * make things worse.
 */
import { Directory, File, Paths } from 'expo-file-system';

const SUBDIR = 'ngaren-photos';

/** Copy a captured/picked image into the persistent document directory. */
export function persistImage(uri: string | null | undefined): string | null {
  if (!uri) return null;
  if (/^https?:\/\//.test(uri)) return uri; // remote URL — already durable
  if (uri.includes(`/${SUBDIR}/`)) return uri; // already persisted by us
  if (!uri.startsWith('file:')) return uri; // content:// etc — leave as-is
  try {
    const dir = new Directory(Paths.document, SUBDIR);
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const ext = (/\.([a-zA-Z0-9]{1,5})(?:[?#]|$)/.exec(uri)?.[1] ?? 'jpg').toLowerCase();
    const dest = new File(dir, `p-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`);
    new File(uri).copy(dest);
    return dest.uri;
  } catch {
    return uri;
  }
}
