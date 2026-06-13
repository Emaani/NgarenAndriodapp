import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { vets } from '@/data/mock';
import { AppText, Button, GradientHeader, Icon, Screen, TextField } from '@/ui';

const TAGS = ['Punctual', 'Knowledgeable', 'Friendly', 'Great with animals', 'Fair price'];
const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

export default function RateVet() {
  const router = useRouter();
  const { vetId } = useLocalSearchParams<{ vetId?: string }>();
  const vet = vetId ? vets.find((v) => v.id === Number(vetId)) : vets[0];

  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [review, setReview] = useState('');

  const toggleTag = (t: string) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Rate your vet" subtitle={vet ? vet.name : 'Share your experience'} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
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
          How was your call-out?
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
          {rating ? RATING_LABELS[rating] : 'Tap a star to rate'}
        </AppText>

        <AppText variant="body" style={{ fontWeight: '600', marginBottom: spacing.sm }}>
          What went well?
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
          {TAGS.map((t) => {
            const active = tags.includes(t);
            return (
              <Pressable
                key={t}
                onPress={() => toggleTag(t)}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.full,
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.divider,
                }}>
                <AppText variant="body" color={active ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
                  {t}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <TextField
          label="Add a review"
          value={review}
          onChangeText={setReview}
          placeholder="Tell other farmers about your experience..."
          multiline
        />

        <Button
          label="Submit Rating"
          icon="send"
          disabled={rating === 0}
          onPress={() => router.replace('/find-vet')}
          style={{ marginTop: spacing.sm }}
        />
      </Screen>
    </View>
  );
}
