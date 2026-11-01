/** Stable numeric id from a uuid (48 bits - safe integer, collision-safe at farm scale). */
export function uuidToId(uuid: string): number {
  const hex = uuid.replace(/[^0-9a-f]/gi, '').slice(0, 12) || '0';
  return parseInt(hex, 16);
}

/** Stable numeric id from any text, such as a tag serial or a place name (FNV-1a). */
export function textToId(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
