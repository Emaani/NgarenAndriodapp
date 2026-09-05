/**
 * Farmer anonymization for the vet view (Sep 5 2026 standup).
 *
 * The vet persona is anonymized by default: vets see aggregate totals and
 * trends but never a farmer's real name or farm identity. Each distinct farmer
 * is mapped to a stable pseudonym ("Farmer #1", "Farmer #2", …) in the order
 * they are first seen, so drill-downs and exports stay internally consistent
 * without ever exposing personal identity.
 */
export function makeFarmerAnonymizer(): (name?: string | null) => string {
  const alias = new Map<string, string>();
  return (name?: string | null): string => {
    if (!name || !name.trim()) return 'Farmer';
    const k = name.toLowerCase();
    let a = alias.get(k);
    if (!a) {
      a = `Farmer #${alias.size + 1}`;
      alias.set(k, a);
    }
    return a;
  };
}
