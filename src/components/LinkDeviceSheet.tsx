import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { animals as animalsFallback } from '@/data/mock';
import { getAnimals, linkDeviceToAnimal } from '@/data/api';
import { useResource } from '@/data/hooks';
import { Device } from '@/data/types';
import { AppText, BottomSheet, Button, SearchBar } from '@/ui';

/** Link Device to Animal sheet (§6.8). */
export function LinkDeviceSheet({ device, onClose }: { device: Device | null; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const { data: animals } = useResource(() => getAnimals(), animalsFallback);
  const matches = animals.filter((a) => a.tag.toLowerCase().includes(query.toLowerCase()));

  const onLink = async () => {
    if (selected !== null && device) {
      // Persists when the backend is configured (POST /api/animals/{id}/device-allocations);
      // resolves immediately in mock mode.
      await linkDeviceToAnimal(selected, device.id);
    }
    onClose();
  };

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
        <Button label="Link" onPress={onLink} disabled={selected === null} style={{ flex: 1 }} />
      </View>
    </BottomSheet>
  );
}
