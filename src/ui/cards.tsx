import { Image, Pressable, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { ageFromDate, formatDate } from '@/lib/date';
import { taggingMeta } from '@/lib/tagging';
import { Animal, AppNotification, Device, Location, User } from '@/data/types';
import { Card } from './Card';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { IconChip } from './IconChip';
import { ActionChip } from './Chip';

function Overflow({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={{ padding: spacing.xs }}>
      <Icon name="dots-horizontal" size={22} color={colors.onSurfaceVariant} />
    </Pressable>
  );
}

function Line({ icon, text, color = colors.onSurfaceVariant }: { icon: any; text: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Icon name={icon} size={14} color={color} />
      <AppText variant="body" color={color}>
        {text}
      </AppText>
    </View>
  );
}

export function AnimalListItem({
  animal,
  onPress,
  onMenu,
}: {
  animal: Animal;
  onPress: () => void;
  onMenu: () => void;
}) {
  const thumb = animal.photos?.[0];
  return (
    <Card onPress={onPress} style={{ marginBottom: spacing.mdMinus }}>
      <View style={{ flexDirection: 'row', gap: spacing.mdMinus }}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={{ width: 44, height: 44, borderRadius: radius.md }} />
        ) : (
          <IconChip icon="cow" />
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="title">{animal.name ?? animal.tag}</AppText>
          <Line icon="dna" text={`Breed: ${animal.breed.name}`} />
          <Line icon="map-marker" text={animal.locationName ?? '—'} />
          {/* Privacy: age, not the date of birth. */}
          <Line icon="calendar" text={`Age: ${ageFromDate(animal.dateOfBirth)}`} />
          <Line icon={taggingMeta(animal.taggingMethod).icon} text={taggingMeta(animal.taggingMethod).short} />
        </View>
        <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
          <Overflow onPress={onMenu} />
          {animal.approvalStatus === 'pending' ? <ActionChip label="Pending" variant="warning" /> : null}
        </View>
      </View>
    </Card>
  );
}

const locIcon = (k: Location['kind']) => (k === 'water' ? 'water' : k === 'yard' ? 'gate' : 'barn');

export function LocationCard({
  location,
  onPress,
  onMenu,
}: {
  location: Location;
  onPress: () => void;
  onMenu: () => void;
}) {
  return (
    <Card onPress={onPress} style={{ marginBottom: spacing.mdMinus }}>
      <View style={{ flexDirection: 'row', gap: spacing.mdMinus }}>
        <IconChip icon={locIcon(location.kind)} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="title">{location.name}</AppText>
          <AppText variant="body" color={colors.onSurfaceVariant}>
            Address: {location.address}
          </AppText>
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            Size: {location.sizeHa} ha · {location.animalCount} animals
          </AppText>
        </View>
        <Overflow onPress={onMenu} />
      </View>
    </Card>
  );
}

function tempVariant(t: number | null) {
  if (t === null) return 'neutral' as const;
  if (t <= 10) return 'info' as const;
  if (t >= 38) return 'error' as const;
  return 'warning' as const;
}

export function DeviceCard({
  device,
  onPress,
  onMenu,
}: {
  device: Device;
  onPress: () => void;
  onMenu: () => void;
}) {
  return (
    <Card onPress={onPress} style={{ marginBottom: spacing.mdMinus }}>
      <View style={{ flexDirection: 'row', gap: spacing.mdMinus }}>
        <IconChip icon="tag" />
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="title">{device.serial}</AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <AppText variant="body" color={colors.onSurfaceVariant}>
              Ceres Tag {device.model}
            </AppText>
            {device.temperatureC !== null && (
              <ActionChip label={`${device.temperatureC}°`} variant={tempVariant(device.temperatureC)} dot={false} />
            )}
          </View>
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            Activated: {formatDate(device.activatedAt)}
          </AppText>
          {device.linkedAnimalTag ? (
            <Line icon="cow" text={`Linked to ${device.linkedAnimalTag}`} color={colors.success} />
          ) : (
            <Line icon="alert-circle" text="Not linked" color={colors.warning} />
          )}
        </View>
        <Overflow onPress={onMenu} />
      </View>
    </Card>
  );
}

export function UserCard({ user, onDelete }: { user: User; onDelete: () => void }) {
  const initials = user.fullName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');
  return (
    <Card style={{ flex: 1, alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
      <Pressable onPress={onDelete} hitSlop={8} style={{ position: 'absolute', top: spacing.sm, right: spacing.sm }}>
        <Icon name="delete" size={18} color={colors.error} />
      </Pressable>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <AppText style={{ color: '#fff', fontWeight: '700', fontSize: 18 }}>{initials}</AppText>
      </View>
      <AppText variant="bodyLarge" style={{ fontWeight: '600', textAlign: 'center' }}>
        {user.fullName}
      </AppText>
      <View
        style={{
          backgroundColor: colors.background,
          borderRadius: radius.sm,
          paddingHorizontal: spacing.sm,
          paddingVertical: 2,
        }}>
        <AppText variant="caption" color={colors.onSurfaceVariant}>
          {user.role}
        </AppText>
      </View>
    </Card>
  );
}

export function NotificationItem({ item }: { item: AppNotification }) {
  const icon = item.category === 'device' ? 'flash' : 'fence';
  const tint = item.category === 'device' ? colors.warning : colors.error;
  return (
    <Card style={{ marginBottom: spacing.mdMinus }}>
      <View style={{ flexDirection: 'row', gap: spacing.mdMinus }}>
        {item.unread && (
          <View
            style={{
              position: 'absolute',
              left: -spacing.md,
              top: 0,
              bottom: 0,
              width: 4,
              borderTopLeftRadius: radius.md,
              borderBottomLeftRadius: radius.md,
              backgroundColor: colors.primary,
            }}
          />
        )}
        <IconChip icon={icon as any} bg={colors.background} fg={tint} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
            {item.title}
          </AppText>
          <AppText variant="body" color={colors.onSurfaceVariant}>
            {item.message}
          </AppText>
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            {item.timestamp}
          </AppText>
        </View>
      </View>
    </Card>
  );
}
