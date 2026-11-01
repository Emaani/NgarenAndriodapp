import { Animal } from '@/data/types';
import { matchQrToHerd } from '../tagQr';

const animal = (over: Partial<Animal>): Animal => ({
  id: 1,
  tag: 'T1',
  breed: { key: 'ankole', name: 'Ankole' },
  dateOfBirth: '',
  status: 'active',
  deviceSerial: null,
  ...over,
});

const zara = animal({ id: 1, tag: 'ZARA-EAR', ngarenCode: 'UG-1026-K7Q2MX', accountNumber: '000006-002' });
const amara = animal({
  id: 2,
  tag: 'A2',
  ngarenCode: 'KE-1126-AB12CD',
  devices: [{ type: 'ELA Blue COIN ID', serial: 'E4:15:F6:00:11:22', bleMac: 'E4:15:F6:00:11:22' }],
});
const herd = [zara, amara];

describe('matchQrToHerd', () => {
  it('finds an animal from the AAN on its label', () => {
    expect(matchQrToHerd('UG-1026-K7Q2MX', herd)).toBe(zara);
    expect(matchQrToHerd(' ug-1026-k7q2mx\n', herd)).toBe(zara);
  });

  it('finds the AAN inside a link', () => {
    expect(matchQrToHerd('https://ngaren.app/a/KE-1126-AB12CD?src=label', herd)).toBe(amara);
  });

  it('accepts the account number, farmer tag or tag MAC', () => {
    expect(matchQrToHerd('000006-002', herd)).toBe(zara);
    expect(matchQrToHerd('zara-ear', herd)).toBe(zara);
    expect(matchQrToHerd('e4:15:f6:00:11:22', herd)).toBe(amara);
  });

  it('never marks an animal from a code that is not in the herd', () => {
    expect(matchQrToHerd('UG-1026-ZZZZZZ', herd)).toBeUndefined();
    expect(matchQrToHerd('https://example.com/menu', herd)).toBeUndefined();
    expect(matchQrToHerd('   ', herd)).toBeUndefined();
  });
});
