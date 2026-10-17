import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { colors, radius } from '@/theme';
import { Icon, IconName } from './Icon';

/**
 * Canonical Photo ID renderer (Oct 2026 — permanent fix). Shows the animal's
 * photo when the URI loads, and falls back to a consistent icon tile when there
 * is no photo OR the image fails to load (a purged cache URI, a broken remote
 * URL). Used everywhere a Photo ID appears so the display is identical and never
 * leaves a blank/broken box.
 */
export function AnimalPhoto({
  uri,
  size = 44,
  rounded,
  icon = 'cow',
}: {
  uri?: string | null;
  size?: number;
  rounded?: number;
  icon?: IconName;
}) {
  const [failed, setFailed] = useState(false);
  // Reset the failed flag whenever the URI changes (e.g. a list re-renders with
  // a different animal in the same slot).
  useEffect(() => setFailed(false), [uri]);

  const br = rounded ?? radius.md;
  const show = !!uri && !failed;

  if (show) {
    return (
      <Image
        source={{ uri: uri! }}
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: br, backgroundColor: colors.surface }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: br, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={Math.round(size * 0.5)} color={colors.primary} />
    </View>
  );
}
