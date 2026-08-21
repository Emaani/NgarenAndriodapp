import { ROLE_FALLBACK_PERMISSIONS, SEAT_ROLE_TEMPLATES } from '@/lib/permissions';

// Mirrors auth.can(): admin passes everything; otherwise the effective set.
const can = (isAdmin: boolean, perms: readonly string[], p: string) => isAdmin || perms.includes(p);

describe('permission resolution', () => {
  it('farm_manager can approve records (Field-Operations validator)', () => {
    expect(can(false, SEAT_ROLE_TEMPLATES.farm_manager, 'approve_records')).toBe(true);
  });

  it('stockman is restricted (no register, no approve)', () => {
    expect(can(false, SEAT_ROLE_TEMPLATES.stockman, 'stock_take')).toBe(true);
    expect(can(false, SEAT_ROLE_TEMPLATES.stockman, 'register_animal')).toBe(false);
    expect(can(false, SEAT_ROLE_TEMPLATES.stockman, 'approve_records')).toBe(false);
  });

  it('viewer is read-only', () => {
    expect(can(false, SEAT_ROLE_TEMPLATES.viewer, 'view_animals')).toBe(true);
    expect(can(false, SEAT_ROLE_TEMPLATES.viewer, 'stock_take')).toBe(false);
  });

  it('solo farmer & admin keep full access (backward compatible)', () => {
    expect(can(false, ROLE_FALLBACK_PERMISSIONS.farmer, 'register_animal')).toBe(true);
    expect(can(false, ROLE_FALLBACK_PERMISSIONS.farmer, 'approve_records')).toBe(true);
    expect(can(true, ROLE_FALLBACK_PERMISSIONS.admin, 'anything')).toBe(true);
  });

  it('a vet cannot approve animal accounts', () => {
    expect(can(false, ROLE_FALLBACK_PERMISSIONS.veterinary, 'approve_records')).toBe(false);
    expect(can(false, ROLE_FALLBACK_PERMISSIONS.veterinary, 'book_vet')).toBe(true);
  });
});
