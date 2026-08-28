import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing } from '@/theme';
import { animals as animalsFallback } from '@/data/mock';
import { getHerdAnimalById } from '@/data/herd';
import { addLocalAnimal } from '@/data/localAnimals';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { generateNgarenCode } from '@/lib/ngaren';
import { AppText, Button, EmptyState, GradientHeader, PhotoField, Screen } from '@/ui';

/**
 * Add or update an animal's Photo ID — works for ANY animal, including ones
 * created earlier or coming from the backend/mock herd. Saving upserts the
 * animal into the local store (minting a Ngaren code if it lacks one), so its
 * photos show everywhere the detail/list reads.
 */
export default function EditAnimalPhotos() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loading, isAuthenticated } = useAuth();
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

  const onSave = async () => {
    setSaving(true);
    try {
      await addLocalAnimal({
        ...animal,
        // Give previously-created animals a proper primary key if they lack one.
        ngarenCode: animal.ngarenCode ?? generateNgarenCode(),
        photos,
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
        <PhotoField label="Front" value={front} onChange={setFront} />
        <PhotoField label="Left side" value={left} onChange={setLeft} />
        <PhotoField label="Right side" value={right} onChange={setRight} />
        <PhotoField label="Back" value={back} onChange={setBack} />
        <Button
          label="Save Photo ID"
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
