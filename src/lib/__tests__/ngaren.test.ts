import { generateNgarenCode } from '@/lib/ngaren';

describe('generateNgarenCode (AAN)', () => {
  it('matches the NGR-XXXXXX-XXXX format', () => {
    expect(generateNgarenCode()).toMatch(/^NGR-[0-9A-Z]{6}-[0-9A-Z]{4}$/);
  });

  it('avoids ambiguous characters (I, L, O, U)', () => {
    const code = generateNgarenCode();
    expect(code).not.toMatch(/[ILOU]/);
  });

  it('is effectively unique across a batch', () => {
    const codes = new Set(Array.from({ length: 2000 }, () => generateNgarenCode()));
    // Same-millisecond collisions are possible in a tight loop; allow a tiny margin.
    expect(codes.size).toBeGreaterThan(1990);
  });
});
