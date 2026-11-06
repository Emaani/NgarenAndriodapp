import fs from 'fs';
import path from 'path';

// The Kiswahili dictionary falls back to English per key, so a missing
// translation shows English silently. Read the source to catch that.
const source = fs.readFileSync(path.join(__dirname, '..', 'strings.ts'), 'utf8');
const block = (start: string, end: string) => source.slice(source.indexOf(start), source.indexOf(end));
const entries = (text: string) =>
  Object.fromEntries([...text.matchAll(/^ {2}'([^']+)': '((?:[^'\\]|\\.)*)',/gm)].map((m) => [m[1], m[2]]));

const en = entries(block('const en: Dict = {', 'const sw: Dict = {'));
const sw = entries(block('const sw: Dict = {', 'export const DICTS'));
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('Kiswahili strings', () => {
  it('translates every English string', () => {
    expect(Object.keys(en).filter((k) => !(k in sw))).toEqual([]);
  });

  it('keeps the same placeholders as English', () => {
    const wrong = Object.keys(sw).filter((k) => k in en && placeholders(en[k]).join() !== placeholders(sw[k]).join());
    expect(wrong).toEqual([]);
  });
});
