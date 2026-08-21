/**
 * Image compression + upload for animal / device photos.
 *
 * Captured photos are downscaled to a max width and re-encoded as JPEG to cut
 * bandwidth (management ask), then uploaded to the Supabase `animal-photos`
 * Storage bucket so they sync cross-device instead of living as device-only file
 * URIs. Every step is best-effort: on any failure the caller keeps the local URI
 * and on-device display still works.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../services/supabase';
import { isSupabaseConfigured } from '../config';

const BUCKET = 'animal-photos';
const MAX_WIDTH = 1280;
const COMPRESS = 0.6;

/** Downscale + JPEG-compress an image; returns the compressed base64 (no header). */
async function compress(uri: string): Promise<string | null> {
  try {
    const rendered = await ImageManipulator.manipulate(uri).resize({ width: MAX_WIDTH }).renderAsync();
    const out = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: COMPRESS, base64: true });
    return out.base64 ?? null;
  } catch {
    return null;
  }
}

/** Compress + upload a single photo; returns its public URL, or null on failure. */
export async function uploadPhoto(uri: string, path: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  // Already a remote URL — nothing to upload.
  if (/^https?:\/\//.test(uri)) return uri;
  try {
    const base64 = await compress(uri);
    if (!base64) return null;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: true });
    if (error) return null;
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

/**
 * Compress + upload a set of photos for an animal. Returns the public URLs of the
 * ones that uploaded successfully (order preserved, failures dropped).
 */
export async function uploadAnimalPhotos(uris: string[], userId: string, aan: string): Promise<string[]> {
  const results = await Promise.all(
    uris.map((uri, i) => uploadPhoto(uri, `${userId}/${aan}/${i}-${Date.now()}.jpg`)),
  );
  return results.filter((u): u is string => !!u);
}
