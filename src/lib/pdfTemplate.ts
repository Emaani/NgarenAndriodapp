/**
 * Brand-styled HTML templates for PDF export (Sep 5 2026 standup: reports and
 * the Health Score Card generated as branded PDFs). These build self-contained
 * HTML strings for expo-print — all styling is inline/embedded since the print
 * engine has no external assets.
 */

// Ngaren brand palette (kept in sync with the app's green accent).
const BRAND = '#6D874F';
const BRAND_DARK = '#3f4d2d';
const INK = '#1c2411';
const MUTED = '#6b7280';
const LINE = '#e5e7eb';

/** HTML-escape a value for safe interpolation into the document. */
export function esc(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Wrap document `body` in the branded Ngaren shell — green header with the
 * wordmark, the document title/subtitle, and a footer credit line.
 */
export function brandedHtml(opts: { title: string; subtitle?: string; body: string }): string {
  const generated = new Date().toLocaleString();
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', Roboto, Arial, sans-serif; color: ${INK}; margin: 0; padding: 0; }
  .header { background: ${BRAND}; color: #fff; padding: 28px 32px; }
  .wordmark { font-size: 13px; letter-spacing: 3px; text-transform: uppercase; opacity: .9; font-weight: 700; }
  .title { font-size: 24px; font-weight: 800; margin: 6px 0 2px; }
  .subtitle { font-size: 14px; opacity: .95; }
  .content { padding: 24px 32px 8px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: ${BRAND_DARK}; border-bottom: 2px solid ${BRAND}; padding-bottom: 6px; margin: 22px 0 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 4px 0 8px; }
  th { text-align: left; background: #f3f5ef; color: ${BRAND_DARK}; font-weight: 700; padding: 8px 10px; border-bottom: 1px solid ${LINE}; }
  td { padding: 7px 10px; border-bottom: 1px solid ${LINE}; vertical-align: top; }
  tr:nth-child(even) td { background: #fafbf8; }
  .kv { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .kv td { padding: 7px 0; border-bottom: 1px solid ${LINE}; }
  .kv td.k { color: ${MUTED}; width: 38%; text-transform: uppercase; font-size: 10.5px; letter-spacing: .5px; }
  .kv td.v { font-weight: 600; }
  .stats { display: flex; flex-wrap: wrap; gap: 10px; margin: 8px 0; }
  .stat { flex: 1 1 28%; border: 1px solid ${LINE}; border-radius: 10px; padding: 12px 14px; }
  .stat .n { font-size: 22px; font-weight: 800; color: ${BRAND_DARK}; }
  .stat .l { font-size: 11px; color: ${MUTED}; }
  .muted { color: ${MUTED}; font-size: 12px; }
  li { font-size: 12.5px; margin-bottom: 4px; }
  .footer { padding: 18px 32px 28px; color: ${MUTED}; font-size: 11px; border-top: 1px solid ${LINE}; margin-top: 16px; }
</style>
</head>
<body>
  <div class="header">
    <div class="wordmark">Ngaren</div>
    <div class="title">${esc(opts.title)}</div>
    ${opts.subtitle ? `<div class="subtitle">${esc(opts.subtitle)}</div>` : ''}
  </div>
  <div class="content">
    ${opts.body}
  </div>
  <div class="footer">
    Generated ${esc(generated)} with the Ngaren app · Ngaren Digital
  </div>
</body>
</html>`;
}

/** A branded table section: an <h2> heading plus a data table. */
export function tableSection(heading: string, headers: string[], rows: (string | number)[][]): string {
  const head = headers.map((h) => `<th>${esc(h)}</th>`).join('');
  const body = rows.length
    ? rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${headers.length}" class="muted">No records.</td></tr>`;
  return `<h2>${esc(heading)}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/** A key/value identity block. */
export function kvSection(heading: string, rows: [string, string | number | null | undefined][]): string {
  const body = rows
    .map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${v !== null && v !== undefined && String(v).trim() ? esc(v) : '—'}</td></tr>`)
    .join('');
  return `<h2>${esc(heading)}</h2><table class="kv">${body}</table>`;
}
