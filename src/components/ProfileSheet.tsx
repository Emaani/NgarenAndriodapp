import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { AppText, BottomSheet, Icon, IconName } from '@/ui';

function Row({ icon, label, destructive, onPress }: { icon: IconName; label: string; destructive?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.mdMinus,
        opacity: pressed ? 0.6 : 1,
      })}>
      <Icon name={icon} size={22} color={destructive ? colors.error : colors.onSurface} />
      <AppText variant="bodyLarge" color={destructive ? colors.error : colors.onSurface}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Profile bottom sheet (§6.1), opened from any TopAppBar avatar. */
export function useProfileSheet() {
  const [visible, setVisible] = useState(false);
  const router = useRouter();

  const element = (
    <BottomSheet visible={visible} onClose={() => setVisible(false)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <AppText style={{ color: '#fff', fontWeight: '700' }}>AK</AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
            Alice Kagawa
          </AppText>
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            alice@ngaren.com
          </AppText>
        </View>
        <View style={{ backgroundColor: colors.background, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 }}>
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            Admin
          </AppText>
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: colors.divider, marginBottom: spacing.xs }} />
      <Row icon="web" label="Ceres Portal" onPress={() => setVisible(false)} />
      <Row icon="shield-lock" label="Privacy Policy" onPress={() => setVisible(false)} />
      <Row icon="file-document" label="Terms of Service" onPress={() => setVisible(false)} />
      <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: spacing.xs }} />
      <Row
        icon="logout"
        label="Log Out"
        destructive
        onPress={() => {
          setVisible(false);
          router.replace('/');
        }}
      />
    </BottomSheet>
  );

  return { open: () => setVisible(true), element };
}
