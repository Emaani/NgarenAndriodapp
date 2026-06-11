import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { animals } from '@/data/mock';
import { Device } from '@/data/types';
import { AppText, BottomSheet, Button, SearchBar } from '@/ui';

/** Link Device to Animal sheet (§6.8). */
export function LinkDeviceSheet({ device, onClose }: { device: Device | null; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const matches = animals.filter((a) => a.tag.toLowerCase().includes(query.toLowerCase()));

  return (
    <BottomSheet visible={!!device} onClose={onClose} title="Link Device to Animal">
      <AppText variant="bodyLarge" style={{ fontWeight: '600', marginBottom: spacing.md }}>
        Device: {device?.serial}
      </AppText>
      <AppText variant="body" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
        Select Animal *
      </AppText>
      <SearchBar value={query} onChangeText={setQuery} placeholder="Search animal tag or ID..." />
      <View style={{ marginVertical: spacing.sm }}>
        {matches.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => setSelected(a.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: spacing.mdMinus,
              paddingHorizontal: spacing.sm,
              borderRadius: radius.sm,
              backgroundColor: selected === a.id ? colors.primaryTint : 'transparent',
            }}>
            <AppText variant="bodyLarge">{a.name ?? a.tag}</AppText>
            {selected === a.id && <AppText color={colors.primary}>✓</AppText>}
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Button label="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
        <Button label="Link" onPress={onClose} disabled={selected === null} style={{ flex: 1 }} />
      </View>
    </BottomSheet>
  );
}
