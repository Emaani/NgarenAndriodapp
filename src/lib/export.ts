import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

type Cell = string | number | boolean | null | undefined;

/** Escape a single CSV cell (RFC 4180 quoting for commas, quotes, newlines). */
function escapeCell(value: Cell): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a CSV string from a header row and data rows. */
export function toCsv(headers: string[], rows: Cell[][]): string {
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) lines.push(row.map(escapeCell).join(','));
  return lines.join('\r\n');
}

/**
 * Write `csv` to a cache file and open the system share sheet so the user can
 * save it, email it, or send it to Drive/WhatsApp. Returns false if writing or
 * sharing isn't available (e.g. web), so callers can surface a message.
 */
export async function exportCsv(filename: string, csv: string): Promise<boolean> {
  try {
    const file = new File(Paths.cache, filename);
    // Replace any earlier export of the same name so we never append stale data.
    if (file.exists) file.delete();
    file.create();
    file.write(csv);
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/csv',
      dialogTitle: 'Export report',
      UTI: 'public.comma-separated-values-text',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Write `text` to a cache file and open the system share sheet. Used for
 * human-readable reports (e.g. the animal Health Score Card). Returns false if
 * writing or sharing isn't available.
 */
export async function exportText(filename: string, text: string): Promise<boolean> {
  try {
    const file = new File(Paths.cache, filename);
    if (file.exists) file.delete();
    file.create();
    file.write(text);
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/plain',
      dialogTitle: 'Share report',
      UTI: 'public.plain-text',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Render `html` to a PDF and open the share sheet. Used for brand-styled
 * documents — the Health Score Card and vet practice reports (Sep 5 2026
 * standup: reports in branded PDF). Returns false if printing or sharing isn't
 * available (e.g. web), so callers can fall back to CSV/text.
 */
export async function exportPdf(filename: string, html: string): Promise<boolean> {
  try {
    const { uri } = await Print.printToFileAsync({ html });
    // Give the PDF a meaningful name in the share sheet where we can.
    let shareUri = uri;
    try {
      const dest = new File(Paths.cache, filename);
      if (dest.exists) dest.delete();
      new File(uri).move(dest);
      shareUri = dest.uri;
    } catch {
      // Fall back to the print engine's temp uri if the rename fails.
    }
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(shareUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share report',
      UTI: 'com.adobe.pdf',
    });
    return true;
  } catch {
    return false;
  }
}
