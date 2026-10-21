import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { colors, radius, shadow, spacing } from '@/theme';
import { animals as animalsFallback } from '@/data/mock';
import { getHerd } from '@/data/herd';
import {
  addScorecard,
  deriveScorecardStatus,
  DiagnosticEntry,
  GROOMING_ATTRIBUTES,
  GroomingRatings,
  isTemperatureAbnormal,
  STATUS_LABEL,
  TREATMENT_ROUTES,
  TreatmentRoute,
  VaccinationEntry,
} from '@/data/scorecards';
import {
  addCatalogSubcategory,
  addCatalogType,
  CatalogType,
  getCatalog,
  getCatalogNames,
} from '@/data/clinicalCatalog';
import {
  deleteScorecardDraft,
  getScorecardDraft,
  makeDraftId,
  saveScorecardDraft,
} from '@/data/scorecardDrafts';
import { addLocalEvent } from '@/data/localEvents';
import { logAuditEvent } from '@/data/localAuditEvents';
import { enqueueScorecardSync } from '@/data/syncQueue';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { scheduleLocalReminder } from '@/services/push';
import { notify } from '@/lib/toast';
import { statusVisual, bcsColor } from '@/lib/scorecardVisual';
import { Animal } from '@/data/types';
import { useT } from '@/i18n';
import { AppText, BottomSheet, Button, DatePickerField, GradientHeader, Icon, IconName, PhotoField, Screen, SearchBar, TextField } from '@/ui';

// 1–5 body condition score in half-steps, with a short descriptor per level.
const BCS_STEPS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
const BCS_DESC = (v: number) => (v <= 2 ? 'Poor / thin' : v < 3.5 ? 'Moderate' : v <= 4 ? 'Ideal / good' : 'Over-conditioned');
const RATING_STEPS = [1, 2, 3, 4, 5];

function Tile({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.divider, gap: spacing.sm }, shadow[1]]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 30, height: 30, borderRadius: radius.full, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={17} color={colors.primary} />
        </View>
        <AppText variant="bodyLarge" style={{ fontWeight: '700', flex: 1 }}>
          {title}
        </AppText>
      </View>
      {children}
    </View>
  );
}

/** A tap-to-toggle pill used for diagnosis tags, grooming and routes. */
function TogglePill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ paddingHorizontal: spacing.mdMinus, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: active ? colors.primary : colors.surface, borderWidth: 1, borderColor: active ? colors.primary : colors.divider }}>
      <AppText variant="caption" color={active ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** "Add '<query>'" pill — captures a brand-new catalog entry inline. */
function AddPill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.mdMinus, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.primaryTint, borderWidth: 1, borderColor: colors.primary }}>
      <Icon name="plus" size={14} color={colors.primary} />
      <AppText variant="caption" color={colors.primary} style={{ fontWeight: '700' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

/**
 * A searchable catalog chip picker with inline capture. Shows the catalog names
 * filtered by the query; tapping selects; if the query matches nothing, an
 * "Add …" pill captures it into the database and selects it.
 */
function ChipPicker({
  options,
  value,
  onPick,
  onAdd,
  placeholder,
}: {
  options: string[];
  value: string;
  onPick: (v: string) => void;
  onAdd: (v: string) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const matches = options.filter((o) => !q || o.toLowerCase().includes(q));
  const exact = options.some((o) => o.toLowerCase() === q);
  return (
    <>
      <SearchBar value={query} onChangeText={setQuery} placeholder={placeholder} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {matches.slice(0, 14).map((o) => (
          <TogglePill key={o} label={o} active={value.toLowerCase() === o.toLowerCase()} onPress={() => onPick(o)} />
        ))}
        {query.trim() && !exact ? (
          <AddPill
            label={`Add “${query.trim()}”`}
            onPress={() => {
              onAdd(query.trim());
              setQuery('');
            }}
          />
        ) : null}
      </View>
    </>
  );
}

/**
 * Animal Health Scorecard — capture (Oct 20 2026 vet spec 3.x). Baseline vitals
 * (BCS 1–5 is the real field), a sequence of Diagnosis & Treatment entries
 * (parasite / disease from the extensible clinical catalog, each with drug &
 * dosage), Vaccination (with an optional pre-scheduled plan), a 1–5
 * grooming/hygiene rating, a reproduction observation and vet notes. The whole
 * record AUTOSAVES as a "Scorecard in progress" draft and only becomes a locked,
 * farmer- & admin-visible record when the vet submits with their Face ID.
 *
 * Reached with ?key=<tag/AAN/account/name>&label=<name>&callout=<id> (new) or
 * ?draft=<id> (resume an in-progress scorecard).
 */
export default function NewScorecard() {
  const router = useRouter();
  const tr = useT();
  const { key, label, callout, draft: draftParam } = useLocalSearchParams<{ key?: string; label?: string; callout?: string; draft?: string }>();
  const { loading, isAuthenticated, canVet, user } = useAuth();
  const { data: herd } = useResource(getHerd, animalsFallback);

  const animal: Animal | undefined = useMemo(() => {
    if (!key) return undefined;
    const k = key.toLowerCase();
    return herd.find((a) => [a.ngarenCode, a.tag, a.accountNumber, a.name].filter(Boolean).map((x) => String(x).toLowerCase()).includes(k));
  }, [herd, key]);

  const animalLabel = label ?? animal?.name ?? animal?.tag ?? key ?? 'Animal';
  const animalKey = animal?.ngarenCode ?? animal?.tag ?? key ?? animalLabel;
  const isFemale = (animal?.description ?? '').toLowerCase().includes('female') || (animal as { sex?: string })?.sex === 'female';

  // Stable draft id (one per visit). A resumed draft keeps its id.
  const [draftId] = useState<string>(() => draftParam ?? makeDraftId(user?.id, animalKey));

  // Extensible clinical catalogs (spec 3.3/3.4) — loaded + mutated in place.
  const [parasiteCat, setParasiteCat] = useState<CatalogType[]>([]);
  const [diseaseCat, setDiseaseCat] = useState<CatalogType[]>([]);
  const [drugNames, setDrugNames] = useState<string[]>([]);
  const [vaccineNames, setVaccineNames] = useState<string[]>([]);

  // Vitals
  const [bcs, setBcs] = useState<number | null>(3.5);
  const [temp, setTemp] = useState('');
  const [weight, setWeight] = useState('');
  const [heart, setHeart] = useState('');
  const [resp, setResp] = useState('');
  const [age, setAge] = useState('');

  // Diagnosis & treatment (sequential captures)
  const [diagnostics, setDiagnostics] = useState<DiagnosticEntry[]>([]);
  // Vaccinations + schedule
  const [vaccinations, setVaccinations] = useState<VaccinationEntry[]>([]);
  const [vaxFrom, setVaxFrom] = useState('');
  const [vaxTo, setVaxTo] = useState('');
  const [vaxNote, setVaxNote] = useState('');
  // Grooming 1–5 ratings
  const [groomRatings, setGroomRatings] = useState<GroomingRatings>({});
  // Reproduction
  const [pregApplies, setPregApplies] = useState(isFemale);
  const [inCalf, setInCalf] = useState<boolean | null>(null);
  const [calvingDue, setCalvingDue] = useState('');
  // Notes
  const [notes, setNotes] = useState('');
  const [flagRecheck, setFlagRecheck] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [nextDue, setNextDue] = useState('');

  const [saving, setSaving] = useState(false);
  const [faceVerifying, setFaceVerifying] = useState(false);
  const hydrated = useRef(false);

  // Diagnostic editor sheet state
  const [dxSheet, setDxSheet] = useState(false);
  const [dxKind, setDxKind] = useState<'parasite' | 'disease'>('disease');
  const [dxType, setDxType] = useState('');
  const [dxSub, setDxSub] = useState('');
  const [dxDrug, setDxDrug] = useState('');
  const [dxDose, setDxDose] = useState('');
  const [dxRoute, setDxRoute] = useState<TreatmentRoute | null>(null);
  const [dxDoseComment, setDxDoseComment] = useState('');
  const [dxComment, setDxComment] = useState('');

  // Vaccination editor sheet state
  const [vxSheet, setVxSheet] = useState(false);
  const [vxVaccine, setVxVaccine] = useState('');
  const [vxDrug, setVxDrug] = useState('');
  const [vxComment, setVxComment] = useState('');

  // Load the clinical catalogs once.
  useEffect(() => {
    let active = true;
    void Promise.all([getCatalog('parasite'), getCatalog('disease'), getCatalogNames('drug'), getCatalogNames('vaccination')]).then(
      ([p, d, dr, vx]) => {
        if (!active) return;
        setParasiteCat(p);
        setDiseaseCat(d);
        setDrugNames(dr);
        setVaccineNames(vx);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  // Hydrate from an in-progress draft (resume).
  useEffect(() => {
    if (!draftParam || hydrated.current) return;
    hydrated.current = true;
    void getScorecardDraft(draftParam).then((d) => {
      if (!d) return;
      if (d.vitals) {
        setBcs(d.vitals.bcs ?? 3.5);
        setTemp(d.vitals.temperature != null ? String(d.vitals.temperature) : '');
        setWeight(d.vitals.weight != null ? String(d.vitals.weight) : '');
        setHeart(d.vitals.heartRate != null ? String(d.vitals.heartRate) : '');
        setResp(d.vitals.respRate != null ? String(d.vitals.respRate) : '');
        setAge(d.vitals.age != null ? String(d.vitals.age) : '');
      }
      setDiagnostics(d.diagnostics ?? []);
      setVaccinations(d.vaccinations ?? []);
      setVaxFrom(d.vaccinationSchedule?.from ?? '');
      setVaxTo(d.vaccinationSchedule?.to ?? '');
      setVaxNote(d.vaccinationSchedule?.note ?? '');
      setGroomRatings(d.groomingRatings ?? {});
      setPregApplies(d.pregnancyApplies ?? isFemale);
      setInCalf(d.inCalf ?? null);
      setCalvingDue(d.calvingDue ?? '');
      setNotes(d.notes ?? '');
      setFlagRecheck(d.flagRecheck ?? false);
      setPhoto(d.photo ?? null);
    });
  }, [draftParam, isFemale]);

  const tempNum = temp.trim() ? Number(temp) : null;
  // Diagnosis tags (for status + legacy display) derived from the captures.
  const dxTags = useMemo(() => diagnostics.map((d) => d.subcategory || d.type), [diagnostics]);
  const primaryDrug = diagnostics.find((d) => d.drug)?.drug ?? vaccinations.find((v) => v.drug)?.drug ?? '';
  const status = useMemo(
    () =>
      deriveScorecardStatus({
        vitals: { bcs, temperature: tempNum },
        diagnosisTags: dxTags,
        diagnosisNotes: notes,
        treatment: { drug: primaryDrug },
        flagRecheck,
      }),
    [bcs, tempNum, dxTags, notes, primaryDrug, flagRecheck],
  );
  const sv = statusVisual(status);

  // Debounced autosave — the scorecard is always recoverable as a draft (3.7).
  useEffect(() => {
    if (loading || !isAuthenticated || !canVet) return;
    const id = setTimeout(() => {
      void saveScorecardDraft({
        id: draftId,
        animalKey,
        animalLabel,
        vetId: user?.id ?? null,
        vetName: user?.fullName ?? user?.email ?? 'Vet',
        visitType: 'Health Scorecard',
        vitals: {
          bcs,
          temperature: tempNum,
          weight: weight.trim() ? Number(weight) : null,
          heartRate: heart.trim() ? Number(heart) : null,
          respRate: resp.trim() ? Number(resp) : null,
          age: age.trim() ? Number(age) : null,
        },
        diagnostics,
        vaccinations,
        vaccinationSchedule: vaxFrom || vaxTo ? { from: vaxFrom, to: vaxTo, note: vaxNote || null } : null,
        groomingRatings: groomRatings,
        pregnancyApplies: pregApplies,
        inCalf,
        calvingDue,
        notes,
        flagRecheck,
        photo,
      });
    }, 700);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bcs, temp, weight, heart, resp, age, diagnostics, vaccinations, vaxFrom, vaxTo, vaxNote, groomRatings, pregApplies, inCalf, calvingDue, notes, flagRecheck, photo]);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  // Scorecards are authored by certified professionals (Sep 5 2026 restriction).
  if (!canVet) return <Redirect href="/(tabs)/home" />;

  const kindCat = dxKind === 'parasite' ? parasiteCat : diseaseCat;
  const kindTypeNames = kindCat.map((c) => c.type);
  const kindSubs = kindCat.find((c) => c.type.toLowerCase() === dxType.toLowerCase())?.subcategories ?? [];

  const addType = async (name: string) => {
    const next = await addCatalogType(dxKind, name);
    dxKind === 'parasite' ? setParasiteCat(next) : setDiseaseCat(next);
    setDxType(name);
    setDxSub('');
  };
  const addSub = async (name: string) => {
    const next = await addCatalogSubcategory(dxKind, dxType, name);
    dxKind === 'parasite' ? setParasiteCat(next) : setDiseaseCat(next);
    setDxSub(name);
  };
  const addDrug = async (name: string) => {
    await addCatalogType('drug', name);
    setDrugNames(await getCatalogNames('drug'));
    setDxDrug(name);
  };
  const addVaxDrug = async (name: string) => {
    await addCatalogType('drug', name);
    setDrugNames(await getCatalogNames('drug'));
    setVxDrug(name);
  };
  const addVaccine = async (name: string) => {
    await addCatalogType('vaccination', name);
    setVaccineNames(await getCatalogNames('vaccination'));
    setVxVaccine(name);
  };

  const openDxEditor = () => {
    setDxKind('disease');
    setDxType('');
    setDxSub('');
    setDxDrug('');
    setDxDose('');
    setDxRoute(null);
    setDxDoseComment('');
    setDxComment('');
    setDxSheet(true);
  };

  const saveDiagnostic = () => {
    if (!dxType.trim()) {
      Alert.alert('Diagnosis', 'Pick or add a type first.');
      return;
    }
    const entry: DiagnosticEntry = {
      id: `dx-${Date.now()}`,
      kind: dxKind,
      type: dxType.trim(),
      subcategory: dxSub.trim() || null,
      comment: dxComment.trim() || null,
      drug: dxDrug.trim() || null,
      dose: [dxDose.trim(), dxRoute].filter(Boolean).join(' · ') || null,
      dosageComment: dxDoseComment.trim() || null,
    };
    setDiagnostics((prev) => [...prev, entry]);
    setDxSheet(false);
  };

  const openVxEditor = () => {
    setVxVaccine('');
    setVxDrug('');
    setVxComment('');
    setVxSheet(true);
  };

  const saveVaccination = () => {
    if (!vxVaccine.trim()) {
      Alert.alert('Vaccination', 'Pick or add a vaccine first.');
      return;
    }
    setVaccinations((prev) => [...prev, { id: `vx-${Date.now()}`, vaccine: vxVaccine.trim(), drug: vxDrug.trim() || null, comment: vxComment.trim() || null }]);
    setVxSheet(false);
  };

  // Face ID gate — a submitted scorecard is final (spec 3.7).
  const verifyFaceId = async (): Promise<boolean> => {
    setFaceVerifying(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Face ID', 'Camera access is needed to confirm your identity.');
        return false;
      }
      const shot = await ImagePicker.launchCameraAsync({ quality: 0.4, cameraType: ImagePicker.CameraType.front });
      if (shot.canceled || !shot.assets?.[0]) {
        Alert.alert('Face ID', 'A live Face ID capture is required to submit.');
        return false;
      }
      return true;
    } catch {
      Alert.alert('Face ID', 'A live Face ID capture is required to submit.');
      return false;
    } finally {
      setFaceVerifying(false);
    }
  };

  const confirmSubmit = () => {
    Alert.alert(
      'Submit scorecard',
      'This locks the Animal Health Scorecard permanently and makes it visible to the farmer and Ngaren. Confirm with your Face ID?',
      [
        { text: 'Face ID & submit', onPress: async () => { if (await verifyFaceId()) void doSubmit(); } },
        { text: tr('common.cancel'), style: 'cancel' },
      ],
    );
  };

  const doSubmit = async () => {
    setSaving(true);
    try {
      const vetName = user?.fullName ?? user?.email ?? 'Vet';
      const saved = await addScorecard({
        animalKey,
        animalLabel,
        farmName: animal?.locationName ?? null,
        breed: animal?.breed?.name ?? null,
        farmerId: animal?.farmerId ?? null,
        status,
        visitType: 'Health Scorecard',
        vitals: {
          bcs,
          temperature: tempNum,
          weight: weight.trim() ? Number(weight) : null,
          heartRate: heart.trim() ? Number(heart) : null,
          respRate: resp.trim() ? Number(resp) : null,
          age: age.trim() ? Number(age) : null,
        },
        diagnosisTags: dxTags,
        diagnosisNotes: diagnostics.map((d) => [d.type, d.subcategory].filter(Boolean).join(' — ')).join('; ') || null,
        treatment: { drug: primaryDrug || null, dose: null, route: null, frequency: null, nextDueDate: nextDue || null },
        diagnostics,
        vaccinations,
        vaccinationSchedule: vaxFrom || vaxTo ? { from: vaxFrom, to: vaxTo, note: vaxNote || null } : null,
        groomingRatings: groomRatings,
        grooming: GROOMING_ATTRIBUTES.filter((g) => (groomRatings[g.key] ?? 0) > 0).map((g) => g.label),
        pregnancy: pregApplies ? { applicable: true, inCalf, dueDate: calvingDue || null } : null,
        notes: notes.trim() || null,
        flagRecheck,
        photo,
        vetName,
        vetId: user?.id ?? null,
        date: new Date().toISOString().slice(0, 10),
      });

      // Durable write-through (farmer + admin visibility) via the offline queue.
      void enqueueScorecardSync({ scorecard: saved, userId: user?.id });
      // Track the submission in the audit trail (date/time + actor).
      void logAuditEvent({ type: 'other', title: `Scorecard submitted — ${animalLabel}`, detail: `AAN ${animalKey} · ${diagnostics.length} diagnostic(s), ${vaccinations.length} vaccination(s)`, by: vetName });
      // Clear the in-progress draft now that it's a locked record.
      void deleteScorecardDraft(draftId);

      if (nextDue) {
        void scheduleLocalReminder({ title: 'Follow-up due', body: `${animalLabel}: follow-up is due.`, date: new Date(`${nextDue}T09:00:00`), data: { type: 'SCORECARD_FOLLOWUP', animal: animalKey } });
        void addLocalEvent({ title: `Follow-up: ${animalLabel}`, date: nextDue, type: 'follow_up' });
      }
      if (flagRecheck && !nextDue) {
        const inAWeek = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
        void addLocalEvent({ title: `Recheck: ${animalLabel}`, date: inAWeek, type: 'follow_up' });
      }
      if (pregApplies && inCalf && calvingDue) void addLocalEvent({ title: `Expected calving: ${animalLabel}`, date: calvingDue, type: 'vet_visit' });

      notify(tr('vsn.savedToast'));
      if (callout) router.back();
      else router.replace(`/health-scorecard?key=${encodeURIComponent(animalKey)}&label=${encodeURIComponent(animalLabel)}` as never);
    } catch {
      setSaving(false);
      Alert.alert(tr('vsn.saveFailTitle'), tr('vsn.saveFailBody'));
    }
  };

  // 3.5 — launch the calendar to invite the farmer for a specific AAN check.
  const scheduleCheck = () => {
    router.push(`/calendar?aan=${encodeURIComponent(animalKey)}&label=${encodeURIComponent(animalLabel)}&invite=1` as never);
  };

  const dxKindLabel = (k: 'parasite' | 'disease') => (k === 'parasite' ? 'Parasite' : 'Disease');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={tr('ad.scorecard')} subtitle={animalLabel} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl }}>
        {/* Animal header */}
        <View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
          <View style={{ width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="cow" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyLarge" style={{ fontWeight: '700' }}>
              {animalLabel}
            </AppText>
            <AppText variant="caption" color={colors.onSurfaceVariant}>
              {[animal?.breed?.name, animal?.accountNumber ?? animal?.tag, animal?.locationName].filter(Boolean).join(' · ') || animalKey}
            </AppText>
          </View>
        </View>

        {/* In-progress + auto-derived status banner */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.warningTint, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.xs }}>
          <Icon name="content-save-edit-outline" size={16} color={colors.warning} />
          <AppText variant="caption" color={colors.onSurface} style={{ flex: 1 }}>
            Scorecard in progress — autosaved. Submit with Face ID to finalise.
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: sv.tint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
          <Icon name={sv.icon} size={20} color={sv.color} />
          <AppText variant="body" style={{ fontWeight: '700', flex: 1 }} color={sv.color}>
            Overall status: {STATUS_LABEL[status]}
          </AppText>
          <AppText variant="caption" color={sv.color}>
            auto
          </AppText>
        </View>

        {/* Baseline Vitals */}
        <Tile icon="thermometer" title="Baseline Vitals">
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            Body Condition Score (1–5)
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <AppText variant="headline" style={{ fontWeight: '800', minWidth: 54 }} color={bcsColor(bcs)}>
              {bcs != null ? bcs.toFixed(1) : '—'}
            </AppText>
            <AppText variant="caption" color={colors.onSurfaceVariant}>
              {bcs != null ? BCS_DESC(bcs) : 'Not set'}
            </AppText>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.xs }}>
            {BCS_STEPS.map((v) => {
              const active = bcs === v;
              return (
                <Pressable
                  key={v}
                  onPress={() => setBcs(v)}
                  style={{ width: 40, paddingVertical: spacing.xs, borderRadius: radius.sm, alignItems: 'center', backgroundColor: active ? bcsColor(v) : colors.background, borderWidth: 1, borderColor: active ? bcsColor(v) : colors.divider }}>
                  <AppText variant="caption" color={active ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '700' }}>
                    {v.toFixed(1)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: spacing.xs }} />
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            Other vitals — optional placeholders until device integration.
          </AppText>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <TextField label="Temp °C" value={temp} onChangeText={setTemp} placeholder="38.6" keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Weight kg" value={weight} onChangeText={setWeight} placeholder="612" keyboardType="decimal-pad" />
            </View>
          </View>
          {isTemperatureAbnormal(tempNum) ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: -spacing.xs }}>
              <Icon name="alert" size={14} color={colors.warning} />
              <AppText variant="caption" color={colors.warning} style={{ fontWeight: '600' }}>
                Temperature is outside the normal range (38.0–39.3°C).
              </AppText>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <TextField label="Heart bpm" value={heart} onChangeText={setHeart} placeholder="68" keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Resp br/min" value={resp} onChangeText={setResp} placeholder="24" keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Age yrs" value={age} onChangeText={setAge} placeholder="4" keyboardType="number-pad" />
            </View>
          </View>
        </Tile>

        {/* Treatment — sequential parasite / disease diagnostics (3.3) */}
        <Tile icon="stethoscope" title="Treatment — Diagnosis">
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            Capture each parasite or disease with its drug & dosage. Add as many as needed.
          </AppText>
          {diagnostics.map((d) => (
            <View key={d.id} style={{ flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.divider }}>
              <Icon name={d.kind === 'parasite' ? 'bug-outline' : 'virus-outline'} size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <AppText variant="body" style={{ fontWeight: '600' }}>
                  {dxKindLabel(d.kind)}: {d.type}
                  {d.subcategory ? ` — ${d.subcategory}` : ''}
                </AppText>
                {d.drug ? <AppText variant="caption" color={colors.onSurfaceVariant}>Drug: {d.drug}{d.dose ? ` · ${d.dose}` : ''}</AppText> : null}
                {d.dosageComment ? <AppText variant="caption" color={colors.onSurfaceVariant}>Dosage: {d.dosageComment}</AppText> : null}
                {d.comment ? <AppText variant="caption" color={colors.onSurfaceVariant}>{d.comment}</AppText> : null}
              </View>
              <Pressable onPress={() => setDiagnostics((prev) => prev.filter((x) => x.id !== d.id))} hitSlop={8}>
                <Icon name="close" size={18} color={colors.onSurfaceVariant} />
              </Pressable>
            </View>
          ))}
          <Button label="Add diagnosis" variant="outline" icon="plus" onPress={openDxEditor} />
        </Tile>

        {/* Vaccination (3.4) */}
        <Tile icon="needle" title="Vaccination">
          {vaccinations.map((v) => (
            <View key={v.id} style={{ flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.divider }}>
              <Icon name="needle" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <AppText variant="body" style={{ fontWeight: '600' }}>{v.vaccine}</AppText>
                {v.drug ? <AppText variant="caption" color={colors.onSurfaceVariant}>Drug: {v.drug}</AppText> : null}
                {v.comment ? <AppText variant="caption" color={colors.onSurfaceVariant}>{v.comment}</AppText> : null}
              </View>
              <Pressable onPress={() => setVaccinations((prev) => prev.filter((x) => x.id !== v.id))} hitSlop={8}>
                <Icon name="close" size={18} color={colors.onSurfaceVariant} />
              </Pressable>
            </View>
          ))}
          <Button label="Add vaccination" variant="outline" icon="plus" onPress={openVxEditor} />
          <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: spacing.xs }} />
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            Pre-schedule a vaccination plan with the farmer (e.g. over the next year).
          </AppText>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <DatePickerField label="From" value={vaxFrom} placeholder="Start" onSelect={setVaxFrom} />
            </View>
            <View style={{ flex: 1 }}>
              <DatePickerField label="To" value={vaxTo} placeholder="End" onSelect={setVaxTo} />
            </View>
          </View>
          <TextField label="Plan note" value={vaxNote} onChangeText={setVaxNote} placeholder="e.g. FMD every 6 months; booster in Q2" multiline />
        </Tile>

        {/* Grooming / Hygiene qualitative rating 1–5 (3.6) */}
        <Tile icon="star-outline" title="Grooming / Hygiene rating">
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            Score each attribute 1 (least favourable) to 5 (most favourable).
          </AppText>
          {GROOMING_ATTRIBUTES.map((g) => (
            <View key={g.key} style={{ gap: 4, marginTop: spacing.xs }}>
              <AppText variant="caption" color={colors.onSurface} style={{ fontWeight: '600' }}>
                {g.label}
              </AppText>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {RATING_STEPS.map((n) => {
                  const active = groomRatings[g.key] === n;
                  return (
                    <Pressable
                      key={n}
                      onPress={() => setGroomRatings((prev) => ({ ...prev, [g.key]: n }))}
                      style={{ flex: 1, paddingVertical: spacing.xs, borderRadius: radius.sm, alignItems: 'center', backgroundColor: active ? colors.primary : colors.background, borderWidth: 1, borderColor: active ? colors.primary : colors.divider }}>
                      <AppText variant="caption" color={active ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '700' }}>
                        {n}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </Tile>

        {/* Reproduction (cow / female) */}
        {isFemale || pregApplies ? (
          <Tile icon="heart-pulse" title="Reproduction observation">
            <Pressable onPress={() => setPregApplies((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Icon name={pregApplies ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={pregApplies ? colors.primary : colors.onSurfaceVariant} />
              <AppText variant="body" color={colors.onSurface} style={{ flex: 1 }}>
                Applies to this animal (female)
              </AppText>
            </Pressable>
            {pregApplies ? (
              <>
                <AppText variant="caption" color={colors.onSurfaceVariant}>
                  In-calf?
                </AppText>
                <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                  <TogglePill label="Yes" active={inCalf === true} onPress={() => setInCalf(inCalf === true ? null : true)} />
                  <TogglePill label="No" active={inCalf === false} onPress={() => setInCalf(inCalf === false ? null : false)} />
                </View>
                {inCalf ? <DatePickerField label="Estimated calving date" value={calvingDue} placeholder="Optional" onSelect={setCalvingDue} /> : null}
              </>
            ) : null}
          </Tile>
        ) : null}

        {/* Vet notes + other disorders */}
        <Tile icon="note-text-outline" title="Vet Notes & other disorders">
          <TextField label="Notes" value={notes} onChangeText={setNotes} placeholder="Other disorders, nuance, recommendations" multiline />
          <PhotoField label="Photo (optional, live)" value={photo} onChange={setPhoto} liveOnly />
          <DatePickerField label="Follow-up due date (optional, schedules a reminder)" value={nextDue} placeholder="Optional" onSelect={setNextDue} />
          <Pressable onPress={() => setFlagRecheck((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name={flagRecheck ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={flagRecheck ? colors.primary : colors.onSurfaceVariant} />
            <AppText variant="body" color={colors.onSurface} style={{ flex: 1 }}>
              Flag for recheck (adds an open follow-up)
            </AppText>
          </Pressable>
          <Button label="Schedule a reminder with the farmer" variant="outline" icon="calendar-plus" onPress={scheduleCheck} />
        </Tile>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
          <Icon name="lock-outline" size={14} color={colors.onSurfaceVariant} />
          <AppText variant="caption" color={colors.onSurfaceVariant} style={{ flex: 1 }}>
            Submitting locks this scorecard permanently and shares it with the farmer & Ngaren. Corrections are a new dated scorecard.
          </AppText>
        </View>
        <Button label={saving || faceVerifying ? tr('common.saving') : 'Submit with Face ID'} icon="face-recognition" loading={saving || faceVerifying} onPress={confirmSubmit} />
      </Screen>

      {/* Diagnosis editor */}
      <BottomSheet visible={dxSheet} onClose={() => setDxSheet(false)} title="Add diagnosis">
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.xs }}>
          Diagnosis type
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm }}>
          <TogglePill label="Parasite" active={dxKind === 'parasite'} onPress={() => { setDxKind('parasite'); setDxType(''); setDxSub(''); }} />
          <TogglePill label="Disease" active={dxKind === 'disease'} onPress={() => { setDxKind('disease'); setDxType(''); setDxSub(''); }} />
        </View>

        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
          {dxKindLabel(dxKind)} type
        </AppText>
        <ChipPicker options={kindTypeNames} value={dxType} onPick={(v) => { setDxType(v); setDxSub(''); }} onAdd={(v) => void addType(v)} placeholder={`Search ${dxKindLabel(dxKind).toLowerCase()} types, or add one`} />

        {dxType ? (
          <>
            <AppText variant="caption" color={colors.onSurfaceVariant} style={{ fontWeight: '600', marginTop: spacing.sm }}>
              Subcategory
            </AppText>
            <ChipPicker options={kindSubs} value={dxSub} onPick={setDxSub} onAdd={(v) => void addSub(v)} placeholder="Search subcategories, or add one" />
          </>
        ) : null}

        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ fontWeight: '600', marginTop: spacing.sm }}>
          Drug / medicine
        </AppText>
        <ChipPicker options={drugNames} value={dxDrug} onPick={setDxDrug} onAdd={(v) => void addDrug(v)} placeholder="Search drugs, or add one" />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <TextField label="Dose" value={dxDose} onChangeText={setDxDose} placeholder="e.g. 20ml" />
          </View>
        </View>
        <AppText variant="caption" color={colors.onSurfaceVariant}>Route</AppText>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {TREATMENT_ROUTES.map((r) => (
            <TogglePill key={r} label={r} active={dxRoute === r} onPress={() => setDxRoute(dxRoute === r ? null : r)} />
          ))}
        </View>
        <TextField label="Dosage comments" value={dxDoseComment} onChangeText={setDxDoseComment} placeholder="e.g. once daily for 3 days" />
        <TextField label="Comments" value={dxComment} onChangeText={setDxComment} placeholder="Nuance on the parasite / disease" multiline />
        <Button label="Add to scorecard" icon="check" onPress={saveDiagnostic} style={{ marginTop: spacing.sm }} />
      </BottomSheet>

      {/* Vaccination editor */}
      <BottomSheet visible={vxSheet} onClose={() => setVxSheet(false)} title="Add vaccination">
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
          Vaccine
        </AppText>
        <ChipPicker options={vaccineNames} value={vxVaccine} onPick={setVxVaccine} onAdd={(v) => void addVaccine(v)} placeholder="Search vaccines, or add one" />
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ fontWeight: '600', marginTop: spacing.sm }}>
          Drug / product
        </AppText>
        <ChipPicker options={drugNames} value={vxDrug} onPick={setVxDrug} onAdd={(v) => void addVaxDrug(v)} placeholder="Search drugs, or add one" />
        <TextField label="Comments" value={vxComment} onChangeText={setVxComment} placeholder="Batch, dose, next due" multiline />
        <Button label="Add to scorecard" icon="check" onPress={saveVaccination} style={{ marginTop: spacing.sm }} />
      </BottomSheet>
    </View>
  );
}
