import { ReactNode, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { animals as animalsFallback } from '@/data/mock';
import { getHerd } from '@/data/herd';
import {
  addScorecard,
  CONDITION_TAGS,
  deriveScorecardStatus,
  DRUG_FORMULARY,
  GROOMING_CHIPS,
  isTemperatureAbnormal,
  STATUS_LABEL,
  TREATMENT_ROUTES,
  TreatmentRoute,
} from '@/data/scorecards';
import { addLocalEvent } from '@/data/localEvents';
import { addDocument } from '@/data/documents';
import { enqueueScorecardSync } from '@/data/syncQueue';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { scheduleLocalReminder } from '@/services/push';
import { notify } from '@/lib/toast';
import { statusVisual, bcsColor } from '@/lib/scorecardVisual';
import { Animal } from '@/data/types';
import { AppText, Button, DatePickerField, GradientHeader, Icon, IconName, Screen, SearchBar, TextField } from '@/ui';

const VISIT_TYPES = ['Routine check', 'Treatment', 'Vaccination', 'Emergency'];
// 1–5 body condition score in half-steps, with a short descriptor per level.
const BCS_STEPS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
const BCS_DESC = (v: number) => (v <= 2 ? 'Poor / thin' : v < 3.5 ? 'Moderate' : v <= 4 ? 'Ideal / good' : 'Over-conditioned');

function Tile({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.divider, gap: spacing.sm }, shadow[1]]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 30, height: 30, borderRadius: radius.full, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={17} color={colors.primary} />
        </View>
        <AppText variant="bodyLarge" style={{ fontWeight: '700' }}>
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

/**
 * Vet Visit Scorecard — one-page quick entry (Sep 7 2026 standup + UI design).
 * Baseline vitals (BCS 1–5 is the real field; the rest are optional
 * placeholders), diagnosis, medication & treatment, grooming, an optional
 * pregnancy observation and vet notes. A status banner is auto-derived; saving
 * locks the record permanently and schedules any follow-up reminders.
 *
 * Reached with ?key=<tag/AAN/account/name>&label=<name>&callout=<id>.
 */
export default function NewScorecard() {
  const router = useRouter();
  const { key, label, callout } = useLocalSearchParams<{ key?: string; label?: string; callout?: string }>();
  const { loading, isAuthenticated, canVet, isAdmin, user } = useAuth();
  const { data: herd } = useResource(getHerd, animalsFallback);

  const animal: Animal | undefined = useMemo(() => {
    if (!key) return undefined;
    const k = key.toLowerCase();
    return herd.find((a) => [a.ngarenCode, a.tag, a.accountNumber, a.name].filter(Boolean).map((x) => String(x).toLowerCase()).includes(k));
  }, [herd, key]);

  const animalLabel = label ?? animal?.name ?? animal?.tag ?? key ?? 'Animal';
  const animalKey = animal?.ngarenCode ?? animal?.tag ?? key ?? animalLabel;
  const isFemale = (animal?.description ?? '').toLowerCase().includes('female') || (animal as { sex?: string })?.sex === 'female';

  // Form state
  const [visitType, setVisitType] = useState('Routine check');
  const [bcs, setBcs] = useState<number | null>(3.5);
  const [temp, setTemp] = useState('');
  const [weight, setWeight] = useState('');
  const [heart, setHeart] = useState('');
  const [resp, setResp] = useState('');
  const [age, setAge] = useState('');
  const [dxQuery, setDxQuery] = useState('');
  const [dxTags, setDxTags] = useState<string[]>([]);
  const [dxNotes, setDxNotes] = useState('');
  const [drug, setDrug] = useState('');
  const [dose, setDose] = useState('');
  const [route, setRoute] = useState<TreatmentRoute | null>(null);
  const [frequency, setFrequency] = useState('');
  const [nextDue, setNextDue] = useState('');
  const [grooming, setGrooming] = useState<string[]>([]);
  const [pregApplies, setPregApplies] = useState(isFemale);
  const [inCalf, setInCalf] = useState<boolean | null>(null);
  const [calvingDue, setCalvingDue] = useState('');
  const [notes, setNotes] = useState('');
  const [flagRecheck, setFlagRecheck] = useState(false);
  const [saving, setSaving] = useState(false);

  const tempNum = temp.trim() ? Number(temp) : null;
  const status = useMemo(
    () =>
      deriveScorecardStatus({
        vitals: { bcs, temperature: tempNum },
        diagnosisTags: dxTags,
        diagnosisNotes: dxNotes,
        treatment: { drug },
        flagRecheck,
      }),
    [bcs, tempNum, dxTags, dxNotes, drug, flagRecheck],
  );
  const sv = statusVisual(status);

  const dxMatches = useMemo(() => {
    const q = dxQuery.toLowerCase().trim();
    return CONDITION_TAGS.filter((c) => !q || c.toLowerCase().includes(q));
  }, [dxQuery]);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  // Scorecards are authored by certified professionals (Sep 5 2026 restriction).
  if (!canVet) return <Redirect href="/(tabs)/home" />;

  const addCustomDx = () => {
    const t = dxQuery.trim();
    if (t && !dxTags.some((x) => x.toLowerCase() === t.toLowerCase())) setDxTags([...dxTags, t]);
    setDxQuery('');
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const vetName = user?.fullName ?? user?.email ?? 'Vet';
      const saved = await addScorecard({
        animalKey,
        animalLabel,
        farmName: animal?.locationName ?? null,
        breed: animal?.breed?.name ?? null,
        // The animal's owner, so the farmer can read their own scorecard once synced.
        farmerId: animal?.farmerId ?? null,
        status,
        visitType,
        vitals: {
          bcs,
          temperature: tempNum,
          weight: weight.trim() ? Number(weight) : null,
          heartRate: heart.trim() ? Number(heart) : null,
          respRate: resp.trim() ? Number(resp) : null,
          age: age.trim() ? Number(age) : null,
        },
        diagnosisTags: dxTags,
        diagnosisNotes: dxNotes.trim() || null,
        treatment: { drug: drug.trim() || null, dose: dose.trim() || null, route, frequency: frequency.trim() || null, nextDueDate: nextDue || null },
        grooming,
        pregnancy: pregApplies ? { applicable: true, inCalf, dueDate: calvingDue || null } : null,
        notes: notes.trim() || null,
        flagRecheck,
        vetName,
        vetId: user?.id ?? null,
        date: new Date().toISOString().slice(0, 10),
      });

      // Durable write-through to Supabase via the offline queue — the scorecard
      // is the source of truth, so it must reach the shared store (and the
      // farmer / surveillance views), surviving a flaky connection.
      void enqueueScorecardSync({ scorecard: saved, userId: user?.id });

      // Follow-up: schedule a reminder + calendar item for the next-due date.
      if (nextDue) {
        void scheduleLocalReminder({
          title: 'Follow-up treatment due',
          body: `${animalLabel}: ${drug.trim() || 'treatment'} follow-up is due.`,
          date: new Date(`${nextDue}T09:00:00`),
          data: { type: 'SCORECARD_FOLLOWUP', animal: animalKey },
        });
        void addLocalEvent({ title: `Follow-up: ${animalLabel}`, date: nextDue, type: 'follow_up' });
      }
      // Recheck flag also schedules a calendar item (open follow-up).
      if (flagRecheck && !nextDue) {
        const inAWeek = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
        void addLocalEvent({ title: `Recheck: ${animalLabel}`, date: inAWeek, type: 'follow_up' });
      }
      // Pregnancy due date → calendar milestone.
      if (pregApplies && inCalf && calvingDue) {
        void addLocalEvent({ title: `Expected calving: ${animalLabel}`, date: calvingDue, type: 'vet_visit' });
      }

      // Register the locked scorecard in the classified documents module.
      void addDocument({
        kind: 'scorecard',
        title: `Scorecard — ${animalLabel}`,
        subject: visitType,
        ownerRole: isAdmin ? 'admin' : 'vet',
        ownerId: user?.id ?? null,
      });

      notify('Scorecard saved & locked');
      if (callout) router.back();
      else router.replace(`/health-scorecard?key=${encodeURIComponent(animalKey)}&label=${encodeURIComponent(animalLabel)}` as never);
    } catch {
      setSaving(false);
      Alert.alert('Could not save', 'The scorecard could not be saved. Please try again.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Visit Scorecard" subtitle={animalLabel} showBack />
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
              {[animal?.breed?.name, animal?.accountNumber ?? animal?.tag, animal?.locationName].filter(Boolean).join(' · ') || 'New visit'}
            </AppText>
          </View>
        </View>

        {/* Auto-derived status banner */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: sv.tint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
          <Icon name={sv.icon} size={20} color={sv.color} />
          <AppText variant="body" style={{ fontWeight: '700', flex: 1 }} color={sv.color}>
            Overall status: {STATUS_LABEL[status]}
          </AppText>
          <AppText variant="caption" color={sv.color}>
            auto
          </AppText>
        </View>

        {/* Visit type */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md }}>
          {VISIT_TYPES.map((v) => (
            <TogglePill key={v} label={v} active={visitType === v} onPress={() => setVisitType(v)} />
          ))}
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

        {/* Diagnosis */}
        <Tile icon="stethoscope" title="Diagnosis">
          <SearchBar value={dxQuery} onChangeText={setDxQuery} placeholder="Search conditions, or type a custom one…" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {dxMatches.map((c) => (
              <TogglePill key={c} label={c} active={dxTags.includes(c)} onPress={() => toggle(dxTags, setDxTags, c)} />
            ))}
            {dxQuery.trim() && !dxMatches.some((c) => c.toLowerCase() === dxQuery.trim().toLowerCase()) ? (
              <Pressable onPress={addCustomDx} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.mdMinus, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.primaryTint, borderWidth: 1, borderColor: colors.primary }}>
                <Icon name="plus" size={14} color={colors.primary} />
                <AppText variant="caption" color={colors.primary} style={{ fontWeight: '700' }}>
                  Add “{dxQuery.trim()}”
                </AppText>
              </Pressable>
            ) : null}
          </View>
          {dxTags.filter((t) => !CONDITION_TAGS.includes(t as (typeof CONDITION_TAGS)[number])).length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {dxTags
                .filter((t) => !CONDITION_TAGS.includes(t as (typeof CONDITION_TAGS)[number]))
                .map((t) => (
                  <TogglePill key={t} label={t} active onPress={() => toggle(dxTags, setDxTags, t)} />
                ))}
            </View>
          ) : null}
          <TextField label="Notes (nuance)" value={dxNotes} onChangeText={setDxNotes} placeholder="e.g. Mild lameness — left hind hoof" multiline />
        </Tile>

        {/* Medication & Treatment */}
        <Tile icon="needle" title="Medication & Treatment">
          <TextField label="Drug / treatment" value={drug} onChangeText={setDrug} placeholder="Search or type a drug name" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {DRUG_FORMULARY.filter((d) => !drug.trim() || d.toLowerCase().includes(drug.toLowerCase()))
              .slice(0, 6)
              .map((d) => (
                <TogglePill key={d} label={d} active={drug === d} onPress={() => setDrug(d)} />
              ))}
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <TextField label="Dose" value={dose} onChangeText={setDose} placeholder="e.g. 500mg" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Frequency" value={frequency} onChangeText={setFrequency} placeholder="e.g. once / BID" />
            </View>
          </View>
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            Route
          </AppText>
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            {TREATMENT_ROUTES.map((r) => (
              <TogglePill key={r} label={r} active={route === r} onPress={() => setRoute(route === r ? null : r)} />
            ))}
          </View>
          <DatePickerField label="Next due date (schedules a reminder)" value={nextDue} placeholder="Optional" onSelect={setNextDue} />
        </Tile>

        {/* Grooming & Hygiene */}
        <Tile icon="content-cut" title="Grooming & Hygiene">
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            Tap what was done — no typing needed.
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {GROOMING_CHIPS.map((g) => (
              <TogglePill key={g} label={g} active={grooming.includes(g)} onPress={() => toggle(grooming, setGrooming, g)} />
            ))}
          </View>
        </Tile>

        {/* Pregnancy observation (female) */}
        <Tile icon="heart-pulse" title="Pregnancy observation">
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
              {inCalf ? (
                <DatePickerField label="Estimated calving date" value={calvingDue} placeholder="Optional — projects milking / calf arrival" onSelect={setCalvingDue} />
              ) : null}
            </>
          ) : null}
        </Tile>

        {/* Vet notes */}
        <Tile icon="note-text-outline" title="Vet Notes">
          <TextField label="Notes" value={notes} onChangeText={setNotes} placeholder="e.g. Recheck hoof in 7 days if limping" multiline />
          <Pressable onPress={() => setFlagRecheck((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name={flagRecheck ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={flagRecheck ? colors.primary : colors.onSurfaceVariant} />
            <AppText variant="body" color={colors.onSurface} style={{ flex: 1 }}>
              Flag for recheck (adds an open follow-up)
            </AppText>
          </Pressable>
        </Tile>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
          <Icon name="lock-outline" size={14} color={colors.onSurfaceVariant} />
          <AppText variant="caption" color={colors.onSurfaceVariant} style={{ flex: 1 }}>
            Saving locks this scorecard permanently. Corrections are added as a new dated visit.
          </AppText>
        </View>
        <Button label={saving ? 'Saving…' : 'Save Scorecard'} icon="content-save-check-outline" loading={saving} onPress={onSave} />
      </Screen>
    </View>
  );
}
