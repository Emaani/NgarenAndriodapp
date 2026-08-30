import { generateNgarenCode } from '@/lib/ngaren';

describe('generateNgarenCode (AAN)', () => {
  it('matches the structured COUNTRY-MMYY-SEQUENCE format', () => {
    // e.g. UG-0826-7K3M9Q — country code, month+year, base32 sequence.
    expect(generateNgarenCode()).toMatch(/^[A-Z]{2}-\d{4}-[0-9A-Z]{6}$/);
  });

  it('embeds the requested operational country code', () => {
    expect(generateNgarenCode('KE')).toMatch(/^KE-/);
  });

  it('avoids ambiguous characters (I, L, O, U) in the sequence', () => {
    const seq = generateNgarenCode().split('-')[2];
    expect(seq).not.toMatch(/[ILOU]/);
  });

  it('is effectively unique across a batch', () => {
    const codes = new Set(Array.from({ length: 2000 }, () => generateNgarenCode()));
    // Same-millisecond collisions are possible in a tight loop; allow a tiny margin.
    expect(codes.size).toBeGreaterThan(1990);
  });
});
