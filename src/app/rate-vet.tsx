import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { vets } from '@/data/mock';
import { rateService } from '@/data/vetRatings';
import { notify } from '@/lib/toast';
import { useT } from '@/i18n';
import { AppText, Button, GradientHeader, Icon, Screen, TextField } from '@/ui';

// Chip + rating labels hold i18n keys, translated at render.
const TAG_KEYS = ['rv.tag1', 'rv.tag2', 'rv.tag3', 'rv.tag4', 'rv.tag5'];
const RATING_KEYS = ['', 'rv.r1', 'rv.r2', 'rv.r3', 'rv.r4', 'rv.r5'];

export default function RateVet() {
  const router = useRouter();
  const t = useT();
  const { vetId, animal, service, callout } = useLocalSearchParams<{ vetId?: string; animal?: string; service?: string; callout?: string }>();
  const vet = vetId ? vets.find((v) => v.id === Number(vetId)) : vets[0];

  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [review, setReview] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleTag = (t: string) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const onSubmit = async () => {
    setSaving(true);
    // Persist as a service-linked rating when we know which service it's for.
    const calloutId = callout ? Number(callout) : NaN;
    if (Number.isFinite(calloutId)) {
      await rateService({
        calloutId,
        vetId: vetId ? Number(vetId) : undefined,
        vetName: vet?.name,
        animal: animal ?? undefined,
        rating,
        tags,
        review: review.trim() || undefined,
      });
    }
    notify(t('rv.thanks'));
    router.replace('/find-vet');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('rv.title')} subtitle={vet ? vet.name : t('rv.subtitle')} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {/* Service-linked rating (Sep 3 2026 standup): tied to a specific
            completed visit, not a general public rating. */}
        {animal || service ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
            <Icon name="check-decagram-outline" size={18} color={colors.primary} />
            <AppText variant="caption" color={colors.primary} style={{ flex: 1, fontWeight: '600' }}>
              {animal
                ? t('rv.linkedNoteAnimal', { service: service ?? t('rv.visit'), animal })
                : t('rv.linkedNote', { service: service ?? t('rv.visit') })}
            </AppText>
          </View>
        ) : null}
        {vet && (
          <View
            style={[
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                padding: spacing.md,
                marginBottom: spacing.lg,
                borderWidth: 1,
                borderColor: colors.divider,
              },
              shadow[1],
            ]}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: radius.full,
                backgroundColor: colors.primaryTint,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon name="stethoscope" size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                {vet.name}
              </AppText>
              <AppText variant="body" color={colors.onSurfaceVariant}>
                {vet.clinic}
              </AppText>
            </View>
          </View>
        )}

        <AppText variant="title" style={{ textAlign: 'center', marginBottom: spacing.md }}>
          {t('rv.howWas')}
        </AppText>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.sm }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
              <Icon name={n <= rating ? 'star' : 'star-outline'} size={40} color={colors.warning} />
            </Pressable>
          ))}
        </View>
        <AppText
          variant="bodyLarge"
          color={rating ? colors.onSurface : colors.onSurfaceVariant}
          style={{ textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg, fontWeight: '600' }}>
          {rating ? t(RATING_KEYS[rating]) : t('rv.tapStar')}
        </AppText>

        <AppText variant="body" style={{ fontWeight: '600', marginBottom: spacing.sm }}>
          {t('rv.whatWent')}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
          {TAG_KEYS.map((tagKey) => {
            const active = tags.includes(tagKey);
            return (
              <Pressable
                key={tagKey}
                onPress={() => toggleTag(tagKey)}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.full,
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.divider,
                }}>
                <AppText variant="body" color={active ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
                  {t(tagKey)}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <TextField
          label={t('rv.addReview')}
          value={review}
          onChangeText={setReview}
          placeholder={t('rv.reviewPlaceholder')}
          multiline
        />

        <Button
          label={saving ? t('fv.submitting') : t('rv.submit')}
          icon="send"
          disabled={rating === 0 || saving}
          onPress={onSubmit}
          style={{ marginTop: spacing.sm }}
        />
      </Screen>
    </View>
  );
}
