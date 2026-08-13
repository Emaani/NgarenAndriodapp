/**
 * Contact-data masking for compliance (management decision).
 *
 * Sensitive contact details (phone, email) must be masked when shown in reports
 * or when one user views another's record — e.g. an admin's support mirror of a
 * farmer. A user's own profile shows their own details unmasked.
 */
export function maskPhone(value?: string | null): string {
  if (!value) return '—';
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  return `••• ••• ${digits.slice(-3)}`;
}

export function maskEmail(value?: string | null): string {
  if (!value) return '—';
  const [user, domain] = value.split('@');
  if (!domain) return '••••';
  const head = user.slice(0, 2);
  return `${head}•••@${domain}`;
}
