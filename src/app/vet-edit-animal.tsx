import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { animals as animalsFallback, breeds as breedsFallback, locations as locationsFallback } from '@/data/mock';
import { getBreeds, getLocations } from '@/data/api';
import { getHerd } from '@/data/herd';
import { addAmendment, AnimalAmendment, FieldChange } from '@/data/localAmendments';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { sendLocalNotification } from '@/services/push';
import { notify } from '@/lib/toast';
import { useT } from '@/i18n';
import { Animal } from '@/data/types';
import { AppText, Button, DatePickerField, DetailRow, GradientHeader, Icon, PickerField, Screen, TextField } from '@/ui';

/**
 * Vet edit of an EXISTING animal record (Oct 2026 Q&A 4.1). The vet may amend
 * the animal's details on-site, but:
 *   - the AAN (internal code) can NEVER be changed, and
 *   - the change is submitted to the farmer for review & approval — it is not
 *     applied until the farmer approves it (see Approvals).
 * Reached from Manage Animal Records with ?id=<animalId>.
 */
export default function VetEditAnimal() {
  const router = useRouter();
  const t = useT();
  const { id, farmer } = useLocalSearchParams<{ id?: string; farmer?: string }>();
  const { loading, isAuthenticated, canVet, user } = useAuth();

  const { data: herd } = useResource(getHerd, animalsFallback);
  const { data: breeds } = useResource(getBreeds, breedsFallback.map((n) => ({ key: n.toLowerCase(), name: n })));
  const { data: locations } = useResource(() => getLocations(), locationsFallback);

  const animal: Animal | undefined = useMemo(() => herd.find((a) => a.id === Number(id)), [herd, id]);

  // Editable fields — seeded from the animal once it resolves.
  const [name, setName] = useState<string | null>(null);
  const [breedKey, setBreedKey] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [dob, setDob] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!canVet) return <Redirect href="/(tabs)/home" />;

  if (!animal) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <GradientHeader title={t('ve.title')} showBack />
        <Screen contentStyle={{ paddingTop: spacing.md }}>
          <AppText variant="body" color={colors.onSurfaceVariant}>{t('hsc.noAnimalsTitle')}</AppText>
        </Screen>
      </View>
    );
  }

  // Current values (fall back to the animal's own when the field is untouched).
  const vName = name ?? animal.name ?? '';
  const vBreedKey = breedKey ?? animal.breed.key;
  const vColor = color ?? animal.color ?? '';
  const vLocationId = locationId ?? (animal.locationId != null ? String(animal.locationId) : '');
  const vDob = dob ?? animal.dateOfBirth ?? '';
  const vNotes = notes ?? animal.description ?? '';

  const breedOptions = breeds.map((b) => ({ label: b.name, value: b.key }));
  const locationOptions = locations.map((l) => ({ label: l.name, value: String(l.id) }));
  const breedName = (k: string) => breeds.find((b) => b.key === k)?.name ?? k;
  const locationName = (lid: string) => locations.find((l) => String(l.id) === lid)?.name ?? '';

  // Diff against the original to build the amendment.
  const changes: FieldChange[] = [];
  const patch: Partial<Animal> = {};
  if (vName !== (animal.name ?? '')) {
    changes.push({ field: 'name', label: t('ve.name'), before: animal.name ?? '—', after: vName || '—' });
    patch.name = vName || undefined;
  }
  if (vBreedKey !== animal.breed.key) {
    changes.push({ field: 'breed', label: t('ad.breed'), before: animal.breed.name, after: breedName(vBreedKey) });
    patch.breed = { key: vBreedKey, name: breedName(vBreedKey) };
  }
  if (vColor !== (animal.color ?? '')) {
    changes.push({ field: 'color', label: t('ad.colour'), before: animal.color ?? '—', after: vColor || '—' });
    patch.color = vColor || undefined;
  }
  if (vLocationId !== (animal.locationId != null ? String(animal.locationId) : '')) {
    changes.push({ field: 'location', label: t('ad.location'), before: animal.locationName ?? '—', after: locationName(vLocationId) || '—' });
    patch.locationId = vLocationId ? Number(vLocationId) : undefined;
    patch.locationName = locationName(vLocationId) || undefined;
  }
  if (vDob !== (animal.dateOfBirth ?? '')) {
    changes.push({ field: 'dob', label: t('ve.dob'), before: animal.dateOfBirth || '—', after: vDob || '—' });
    patch.dateOfBirth = vDob;
  }
  if (vNotes !== (animal.description ?? '')) {
    changes.push({ field: 'notes', label: t('ad.notes'), before: animal.description ?? '—', after: vNotes || '—' });
    patch.description = vNotes || undefined;
  }

  const hasChanges = changes.length > 0;

  const onSubmit = async () => {
    if (!hasChanges || submitting) return;
    setSubmitting(true);
    try {
      const amendment: AnimalAmendment = {
        id: `am-${Date.now()}`,
        animalId: animal.id,
        animalKey: animal.ngarenCode ?? animal.accountNumber ?? animal.tag,
        animalLabel: animal.name ?? animal.tag,
        changes,
        patch,
        proposedBy: user?.fullName ?? user?.email ?? 'Vet',
        proposedAt: new Date().toISOString(),
        farmerName: farmer ?? animal.locationName,
        status: 'pending',
      };
      await addAmendment(amendment);
      void sendLocalNotification(
        t('ve.notifyTitle'),
        t('ve.notifyBody', { label: amendment.animalLabel, count: changes.length }),
        { type: 'ANIMAL_AMENDMENT', animalId: animal.id },
      );
      notify(t('ve.submittedToast'));
      router.back();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('ve.title')} subtitle={animal.name ?? animal.tag} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {/* AAN — locked; never editable (Q&A 4.1). */}
        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, marginBottom: spacing.md }, shadow[1]]}>
          <DetailRow label={t('ve.aan')} value={animal.ngarenCode ?? animal.accountNumber ?? animal.tag} last />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md }}>
          <Icon name="lock-outline" size={14} color={colors.onSurfaceVariant} />
          <AppText variant="caption" color={colors.onSurfaceVariant} style={{ flex: 1 }}>
            {t('ve.aanLocked')}
          </AppText>
        </View>

        <TextField label={t('ve.name')} value={vName} onChangeText={setName} placeholder={t('ve.name')} />
        <PickerField label={t('ad.breed')} value={vBreedKey} options={breedOptions} onSelect={setBreedKey} />
        <TextField label={t('ad.colour')} value={vColor} onChangeText={setColor} placeholder={t('ad.colour')} />
        <PickerField label={t('ad.location')} value={vLocationId} options={locationOptions} onSelect={setLocationId} placeholder={t('ad.location')} />
        <DatePickerField label={t('ve.dob')} value={vDob} onSelect={setDob} placeholder={t('ve.dob')} />
        <TextField label={t('ad.notes')} value={vNotes} onChangeText={setNotes} placeholder={t('ad.notes')} multiline />

        {/* Review note — change needs farmer approval. */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm, marginBottom: spacing.md }}>
          <Icon name="clipboard-account-outline" size={18} color={colors.primary} />
          <AppText variant="caption" color={colors.primaryDark} style={{ flex: 1 }}>
            {t('ve.reviewNote')}
          </AppText>
        </View>

        <Button
          label={submitting ? t('ve.submitting') : t('ve.submit', { count: changes.length })}
          icon="send-check-outline"
          loading={submitting}
          disabled={!hasChanges || submitting}
          onPress={onSubmit}
        />
        {!hasChanges ? (
          <AppText variant="caption" color={colors.onSurfaceVariant} style={{ textAlign: 'center', marginTop: spacing.sm }}>
            {t('ve.noChanges')}
          </AppText>
        ) : null}
      </Screen>
    </View>
  );
}
