import { monthsBetween, parentFit } from '@/lib/lineage';
import { serviceCode, serviceCodes } from '@/lib/serviceCodes';

describe('dam and sire eligibility', () => {
  const calfBorn = '2026-03-10';
  it('counts whole months', () => {
    expect(monthsBetween('2024-03-10', calfBorn)).toBe(24);
    expect(monthsBetween('2024-03-11', calfBorn)).toBe(23);
    expect(monthsBetween(undefined, calfBorn)).toBeNull();
  });

  it('offers only females of calving age as the dam', () => {
    expect(parentFit({ sex: 'female', dateOfBirth: '2024-01-01' }, 'dam', calfBorn)).toBe('ok');
    expect(parentFit({ sex: 'female', dateOfBirth: '2025-06-01' }, 'dam', calfBorn)).toBeNull();
    expect(parentFit({ sex: 'male', dateOfBirth: '2020-01-01' }, 'dam', calfBorn)).toBeNull();
    expect(parentFit({ sex: undefined, dateOfBirth: '2020-01-01' }, 'dam', calfBorn)).toBeNull();
  });

  it('offers only males old enough to have sired the calf as the sire', () => {
    expect(parentFit({ sex: 'male', dateOfBirth: '2024-09-01' }, 'sire', calfBorn)).toBe('ok');
    expect(parentFit({ sex: 'male', dateOfBirth: '2025-06-01' }, 'sire', calfBorn)).toBeNull();
  });

  it('offers a right-sex animal with no birth date, flagged', () => {
    expect(parentFit({ sex: 'female', dateOfBirth: '' }, 'dam', calfBorn)).toBe('age_unknown');
  });
});

describe('service codes', () => {
  it('gives every service a fixed code for KPI and finance reports', () => {
    expect(serviceCode('Registration')).toBe('NGS-REG');
    expect(serviceCode('Treatment')).toBe('NGS-HLT');
    expect(serviceCode('Stocktaking')).toBe('NGS-STK');
    expect(serviceCode('Something new')).toBe('NGS-OTH');
    expect(serviceCodes(['Registration', 'Treatment', 'Registration'])).toBe('NGS-REG, NGS-HLT');
  });
});
