import { ReactNode } from 'react';
import { ScrollView, View, ViewStyle, RefreshControl } from 'react-native';
import { colors, layout, spacing } from '@/theme';

/** Page body that sits under the TopAppBar and above the tab bar. */
export function Screen({
  children,
  scroll = true,
  contentStyle,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  if (!scroll) {
    return <View style={{ flex: 1, backgroundColor: colors.background }}>{children}</View>;
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        { padding: spacing.md, paddingBottom: layout.bottomNavHeight + spacing.xl },
        contentStyle,
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        ) : undefined
      }>
      {children}
    </ScrollView>
  );
}
