import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { animals as animalsFallback } from '@/data/mock';
import { getHerdAnimalById } from '@/data/herd';
import { addLocalAnimal } from '@/data/localAnimals';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { formatDate } from '@/lib/date';
import { generateNgarenCode } from '@/lib/ngaren';
import { AppText, Button, EmptyState, GradientHeader, Icon, PhotoField, Screen } from '@/ui';

/**
 * Add or update an animal's Photo ID — works for ANY animal, including ones
 * created earlier or coming from the backend/mock herd. Saving upserts the
 * animal into the local store (minting a Ngaren code if it lacks one), so its
 * photos show everywhere the detail/list reads.
 *
 * Onboarding photos are locked as a permanent static record (Sep 5 2026
 * standup): the first captured set becomes `onboardingPhotos` and is never
 * overwritten; updating the current photos appends the outgoing set to
 * `photoHistory` for audit rather than deleting it.
 */
export default function EditAnimalPhotos() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loading, isAuthenticated, user } = useAuth();
  // Resolve from the same live herd the detail screen uses (local-first, then
  // animal_lineage) so any animal you can open, you can also photograph.
  const { data: animal } = useResource(
    () => getHerdAnimalById(Number(id)),
    animalsFallback.find((a) => a.id === Number(id)),
  );

  const [front, setFront] = useState<string | null>(null);
  const [left, setLeft] = useState<string | null>(null);
  const [right, setRight] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Prefill from the animal's existing photos once it loads.
  useEffect(() => {
    if (seeded || !animal) return;
    const p = animal.photos ?? [];
    setFront(p[0] ?? null);
    setLeft(p[1] ?? null);
    setRight(p[2] ?? null);
    setBack(p[3] ?? null);
    setSeeded(true);
  }, [animal, seeded]);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  if (!animal) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <GradientHeader title="Photo ID" showBack />
        <EmptyState icon="cow" title="Animal not found" subtitle="This animal may have been removed." />
      </View>
    );
  }

  const photos = [front, left, right, back].filter((p): p is string => !!p);
  // Once locked, the onboarding set is the animal's permanent static record.
  const onboarding = animal.onboardingPhotos ?? [];
  const isLocked = onboarding.length > 0;
  const history = animal.photoHistory ?? [];
  const previous = animal.photos ?? [];
  // Whether the current set actually differs from what's stored.
  const changed = JSON.stringify(photos) !== JSON.stringify(previous);

  const onSave = async () => {
    setSaving(true);
    try {
      // Preserve the outgoing set for audit — never delete/overwrite silently.
      const nextHistory =
        changed && previous.length > 0
          ? [{ at: new Date().toISOString(), photos: previous, by: user?.fullName ?? user?.email ?? undefined }, ...history]
          : history;
      await addLocalAnimal({
        ...animal,
        // Give previously-created animals a proper primary key if they lack one.
        ngarenCode: animal.ngarenCode ?? generateNgarenCode(),
        photos,
        // Lock the first captured set as the permanent onboarding record.
        onboardingPhotos: isLocked ? onboarding : photos,
        photoHistory: nextHistory,
      });
      router.back();
    } catch {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Photo ID" subtitle={animal.name ?? animal.tag} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
          Capture or upload the animal from four angles (360°). The front photo is its primary ID.
        </AppText>

        {/* Locked onboarding record — permanent, read-only (Sep 5 2026). */}
        {isLocked ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.divider, padding: spacing.md, marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
              <Icon name="lock-check-outline" size={16} color={colors.primary} />
              <AppText variant="body" style={{ fontWeight: '700' }}>
                Onboarding photos (locked)
              </AppText>
            </View>
            <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
              The original identity photos are kept permanently and can’t be replaced. Updating below keeps these on record.
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {onboarding.map((uri, i) => (
                <Image key={uri + i} source={{ uri }} style={{ width: 72, height: 72, borderRadius: radius.sm, backgroundColor: colors.divider }} />
              ))}
            </View>
          </View>
        ) : null}

        <PhotoField label="Front" value={front} onChange={setFront} />
        <PhotoField label="Left side" value={left} onChange={setLeft} />
        <PhotoField label="Right side" value={right} onChange={setRight} />
        <PhotoField label="Back" value={back} onChange={setBack} />

        {/* Photo history — every superseded set, for audit. */}
        {history.length > 0 ? (
          <View style={{ marginTop: spacing.md }}>
            <AppText variant="body" style={{ fontWeight: '700', marginBottom: spacing.sm }}>
              Previous photos ({history.length})
            </AppText>
            {history.map((h, i) => (
              <View key={h.at + i} style={{ marginBottom: spacing.sm }}>
                <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.xs }}>
                  {formatDate(h.at.slice(0, 10))}
                  {h.by ? ` · ${h.by}` : ''}
                </AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                  {h.photos.map((uri, j) => (
                    <Image key={uri + j} source={{ uri }} style={{ width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.divider }} />
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <Button
          label={isLocked ? 'Save updated photos' : 'Save Photo ID'}
          icon="content-save-outline"
          loading={saving}
          disabled={photos.length === 0}
          onPress={onSave}
          style={{ marginTop: spacing.sm }}
        />
      </Screen>
    </View>
  );
}
