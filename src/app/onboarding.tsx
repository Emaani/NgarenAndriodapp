import { useRef, useState } from 'react';
import { Dimensions, FlatList, Pressable, View, ViewToken } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { AppText, Button, Icon, IconName } from '@/ui';

const { width } = Dimensions.get('window');

const SLIDES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'cow',
    title: 'Manage your livestock',
    body: 'Register animals, track their health and keep your whole herd in one place.',
  },
  {
    icon: 'map-marker-radius',
    title: 'Track via satellite',
    body: 'See where your animals are in real time with Ceres Tag GPS tracking.',
  },
  {
    icon: 'stethoscope',
    title: 'Find a vet, fast',
    body: 'Search nearby vets, request a call-out and rate the service after.',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
  }).current;

  const isLast = index === SLIDES.length - 1;

  const next = () => {
    if (isLast) router.replace('/login');
    else listRef.current?.scrollToIndex({ index: index + 1 });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + spacing.sm, alignItems: 'flex-end', paddingHorizontal: spacing.md }}>
        <Pressable onPress={() => router.replace('/login')} hitSlop={8}>
          <AppText variant="bodyLarge" color={colors.onSurfaceVariant}>
            Skip
          </AppText>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item }) => (
          <View style={{ width, alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.xxl }}>
            <LinearGradient
              colors={colors.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 200,
                height: 200,
                borderRadius: radius.full,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing.xl,
              }}>
              <Icon name={item.icon} size={96} color="#fff" />
            </LinearGradient>
            <AppText variant="headline" style={{ textAlign: 'center', marginBottom: spacing.md }}>
              {item.title}
            </AppText>
            <AppText variant="bodyLarge" color={colors.onSurfaceVariant} style={{ textAlign: 'center' }}>
              {item.body}
            </AppText>
          </View>
        )}
      />

      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.lg, gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.sm }}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === index ? 24 : 8,
                height: 8,
                borderRadius: radius.full,
                backgroundColor: i === index ? colors.primary : colors.divider,
              }}
            />
          ))}
        </View>
        <Button label={isLast ? 'Get started' : 'Next'} onPress={next} />
      </View>
    </View>
  );
}
