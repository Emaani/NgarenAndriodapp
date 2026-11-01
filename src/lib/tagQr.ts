/**
 * Matching a scanned QR code to an animal. ELA prints the AAN on each tag's
 * label and QR (TAGSET02), and a code may hold it alone or inside a link.
 */
import { Animal } from '../data/types';
import { normalizeBleMac } from './bleFrame';

const AAN_IN_TEXT = /[A-Z]{2}-\d{4}-[0-9A-Z]{6}/;

export function matchQrToHerd(code: string, animals: Animal[]): Animal | undefined {
  const text = code.trim().toUpperCase();
  if (!text) return undefined;
  const aan = AAN_IN_TEXT.exec(text)?.[0];
  if (aan) {
    const byAan = animals.find((a) => a.ngarenCode?.toUpperCase() === aan);
    if (byAan) return byAan;
  }
  const mac = normalizeBleMac(text);
  return animals.find(
    (a) =>
      a.accountNumber?.toUpperCase() === text ||
      a.tag.toUpperCase() === text ||
      (!!mac && (a.devices ?? []).some((d) => normalizeBleMac(d.bleMac ?? d.serial) === mac)),
  );
}
