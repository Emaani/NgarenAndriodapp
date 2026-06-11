import { View } from 'react-native';
import { colors, radius } from '@/theme';
import { Icon, IconName } from './Icon';
import { AppText } from './AppText';

/** Rounded avatar/icon square used on list cards (40px) and feature icons. */
export function IconChip({
  icon,
  initials,
  size = 40,
  bg = colors.primaryTint,
  fg = colors.primaryDark,
  rounded = true,
}: {
  icon?: IconName;
  initials?: string;
  size?: number;
  bg?: string;
  fg?: string;
  rounded?: boolean;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: rounded ? radius.full : radius.md,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {icon ? (
        <Icon name={icon} size={size * 0.5} color={fg} />
      ) : (
        <AppText style={{ color: fg, fontWeight: '700', fontSize: size * 0.34 }}>
          {initials}
        </AppText>
      )}
    </View>
  );
}
