import { useRef, useState } from 'react';
import { Dimensions, FlatList, Pressable, View, ViewToken } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { AppText, Button, Icon, IconName } from '@/ui';
import { useT } from '@/i18n';

const { width } = Dimensions.get('window');

// title/body hold i18n keys, translated at render so the carousel follows the
// selected language.
const SLIDES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'cow', title: 'onb.slide1.title', body: 'onb.slide1.body' },
  { icon: 'map-marker-radius', title: 'onb.slide2.title', body: 'onb.slide2.body' },
  { icon: 'stethoscope', title: 'onb.slide3.title', body: 'onb.slide3.body' },
];

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useT();
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
            {t('onb.skip')}
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
              {t(item.title)}
            </AppText>
            <AppText variant="bodyLarge" color={colors.onSurfaceVariant} style={{ textAlign: 'center' }}>
              {t(item.body)}
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
        <Button label={isLast ? t('onb.getStarted') : t('common.next')} onPress={next} />
      </View>
    </View>
  );
}
