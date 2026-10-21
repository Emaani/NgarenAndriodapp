/**
 * Extensible clinical catalogs for the Animal Health Scorecard (Oct 20 2026 vet
 * spec 3.3 / 3.4): parasites, diseases, drugs and vaccinations.
 *
 *  - Parasites & diseases are TWO-LEVEL: a type (e.g. "Ticks", "Viral") each
 *    with subcategories (e.g. "Brown ear tick"; "Foot & Mouth Disease").
 *  - Drugs & vaccinations are flat name lists.
 *
 * Each catalog is seeded with sensible East-African cattle defaults and is
 * OPEN-ENDED: if the vet can't find an entry, they capture it and it is saved
 * so it's available for selection next time ("update the database with the new
 * record"). Custom entries persist on-device (AsyncStorage) and best-effort
 * write-through to a Supabase `clinical_catalog` table when configured — the
 * write never blocks the vet (local is the source of truth, like the other
 * local clinical stores).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from '../services/supabase';

const KEY = 'ngaren.clinical.catalog.v1';

export type CatalogKind = 'parasite' | 'disease' | 'drug' | 'vaccination' | 'sire_breed';

/** A two-level catalog entry (type + subcategories). Drugs/vaccinations use a
 *  single level — the `type` is the name and `subcategories` stays empty. */
export interface CatalogType {
  type: string;
  subcategories: string[];
}

type CatalogState = Record<CatalogKind, CatalogType[]>;

/* --------------------------- seeded defaults ----------------------------- */

const SEED: CatalogState = {
  parasite: [
    { type: 'Ticks', subcategories: ['Brown ear tick', 'Blue tick', 'Bont tick', 'Red-legged tick'] },
    { type: 'Worms (helminths)', subcategories: ['Roundworm', 'Tapeworm', 'Liver fluke', 'Hookworm', 'Lungworm'] },
    { type: 'Flies', subcategories: ['Tsetse fly', 'Biting fly', 'Screwworm'] },
    { type: 'Mites', subcategories: ['Mange (sarcoptic)', 'Mange (demodectic)'] },
    { type: 'Lice', subcategories: ['Biting louse', 'Sucking louse'] },
    { type: 'Protozoan', subcategories: ['Coccidiosis'] },
  ],
  disease: [
    { type: 'Viral', subcategories: ['Foot & Mouth Disease', 'Lumpy Skin Disease', 'Rift Valley Fever', 'Rabies', 'Bovine viral diarrhoea'] },
    { type: 'Bacterial', subcategories: ['Mastitis', 'Anthrax', 'Blackleg', 'Brucellosis', 'Foot rot', 'Pneumonia', 'CBPP'] },
    { type: 'Tick-borne (protozoan)', subcategories: ['East Coast Fever', 'Anaplasmosis', 'Babesiosis', 'Heartwater'] },
    { type: 'Parasitic', subcategories: ['Trypanosomiasis', 'Worm burden', 'Fascioliasis'] },
    { type: 'Metabolic / nutritional', subcategories: ['Bloat', 'Milk fever', 'Ketosis', 'Malnutrition'] },
    { type: 'Reproductive', subcategories: ['Retained placenta', 'Metritis', 'Abortion', 'Dystocia'] },
  ],
  drug: [
    { type: 'Oxytetracycline', subcategories: [] },
    { type: 'Penicillin', subcategories: [] },
    { type: 'Ivermectin', subcategories: [] },
    { type: 'Albendazole', subcategories: [] },
    { type: 'Flunixin', subcategories: [] },
    { type: 'Multivitamin', subcategories: [] },
    { type: 'Dewormer', subcategories: [] },
    { type: 'Acaricide (pour-on)', subcategories: [] },
    { type: 'Anthelmintic drench', subcategories: [] },
    { type: 'Diminazene (Berenil)', subcategories: [] },
    { type: 'Buparvaquone', subcategories: [] },
  ],
  vaccination: [
    { type: 'FMD vaccine', subcategories: [] },
    { type: 'Lumpy Skin Disease vaccine', subcategories: [] },
    { type: 'Anthrax vaccine', subcategories: [] },
    { type: 'Blackleg vaccine', subcategories: [] },
    { type: 'Brucellosis (S19)', subcategories: [] },
    { type: 'Rabies vaccine', subcategories: [] },
    { type: 'ECF (Infection & Treatment Method)', subcategories: [] },
    { type: 'CBPP vaccine', subcategories: [] },
    { type: 'Rift Valley Fever vaccine', subcategories: [] },
  ],
  // Sire breeds applied in artificial insemination (Oct 20 2026 spec 3.d).
  sire_breed: [
    { type: 'Ankole bull', subcategories: [] },
    { type: 'Zebu', subcategories: [] },
    { type: 'Boran', subcategories: [] },
    { type: 'Sahiwal', subcategories: [] },
    { type: 'Friesian (Holstein)', subcategories: [] },
    { type: 'Jersey', subcategories: [] },
    { type: 'Guernsey', subcategories: [] },
    { type: 'Ayrshire', subcategories: [] },
  ],
};

const KINDS: CatalogKind[] = ['parasite', 'disease', 'drug', 'vaccination', 'sire_breed'];

/* ------------------------------- helpers --------------------------------- */

function emptyState(): CatalogState {
  return { parasite: [], disease: [], drug: [], vaccination: [], sire_breed: [] };
}

/** Merge seed + stored custom entries (case-insensitive, custom wins order). */
function mergeWithSeed(stored: Partial<CatalogState> | null): CatalogState {
  const out = emptyState();
  for (const kind of KINDS) {
    const byType = new Map<string, CatalogType>();
    // Seed first so defaults are always present…
    for (const e of SEED[kind]) byType.set(e.type.toLowerCase(), { type: e.type, subcategories: [...e.subcategories] });
    // …then merge stored (adds custom types and custom subcategories).
    for (const e of stored?.[kind] ?? []) {
      const k = e.type.toLowerCase();
      const existing = byType.get(k);
      if (!existing) {
        byType.set(k, { type: e.type, subcategories: [...(e.subcategories ?? [])] });
      } else {
        for (const sub of e.subcategories ?? []) {
          if (!existing.subcategories.some((s) => s.toLowerCase() === sub.toLowerCase())) existing.subcategories.push(sub);
        }
      }
    }
    out[kind] = [...byType.values()].sort((a, b) => a.type.localeCompare(b.type));
  }
  return out;
}

async function readStored(): Promise<Partial<CatalogState>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Partial<CatalogState>) : {};
  } catch {
    return {};
  }
}

async function writeStored(state: Partial<CatalogState>): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // best-effort — a storage failure shouldn't lose the capture silently
  }
}

/** Best-effort write-through of a newly-captured catalog item to Supabase. */
function syncRemote(kind: CatalogKind, type: string, subcategory?: string | null): void {
  if (!isSupabaseConfigured()) return;
  void (async () => {
    try {
      await supabase
        .from('clinical_catalog')
        .insert({ kind, type, subcategory: subcategory ?? null, created_at: new Date().toISOString() });
    } catch {
      // table may not be migrated yet — ignore; local copy is authoritative
    }
  })();
}

/* -------------------------------- reads ---------------------------------- */

/** The full catalog for a kind (seed + custom), types sorted alphabetically. */
export async function getCatalog(kind: CatalogKind): Promise<CatalogType[]> {
  const stored = await readStored();
  return mergeWithSeed(stored)[kind];
}

/** Flat list of names for a flat catalog (drug / vaccination). */
export async function getCatalogNames(kind: CatalogKind): Promise<string[]> {
  return (await getCatalog(kind)).map((e) => e.type);
}

/* -------------------------------- writes --------------------------------- */

/** Add a new top-level type (e.g. a new parasite group, disease group, drug or
 *  vaccine). Idempotent; persists + best-effort remote sync. Returns the catalog. */
export async function addCatalogType(kind: CatalogKind, type: string): Promise<CatalogType[]> {
  const name = type.trim();
  if (!name) return getCatalog(kind);
  const stored = await readStored();
  const list = stored[kind] ?? [];
  if (!list.some((e) => e.type.toLowerCase() === name.toLowerCase())) {
    list.push({ type: name, subcategories: [] });
    stored[kind] = list;
    await writeStored(stored);
    syncRemote(kind, name);
  }
  return getCatalog(kind);
}

/** Add a subcategory under a type (creating the type if needed). */
export async function addCatalogSubcategory(kind: CatalogKind, type: string, subcategory: string): Promise<CatalogType[]> {
  const t = type.trim();
  const sub = subcategory.trim();
  if (!t || !sub) return getCatalog(kind);
  const stored = await readStored();
  const list = stored[kind] ?? [];
  let entry = list.find((e) => e.type.toLowerCase() === t.toLowerCase());
  if (!entry) {
    entry = { type: t, subcategories: [] };
    list.push(entry);
  }
  if (!entry.subcategories.some((s) => s.toLowerCase() === sub.toLowerCase())) {
    entry.subcategories.push(sub);
  }
  stored[kind] = list;
  await writeStored(stored);
  syncRemote(kind, t, sub);
  return getCatalog(kind);
}
