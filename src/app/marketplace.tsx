import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import {
  ListingStatus,
  MarketplaceListing,
  formatPrice,
  getMarketplaceListings,
  setListingStatus,
  submitListing,
} from '@/data/marketplace';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { ActionChip, AppText, BottomSheet, Button, GradientHeader, Icon, IconChip, Screen, TextField } from '@/ui';

const statusVariant = (s: ListingStatus) =>
  s === 'approved' ? 'success' : s === 'pending' ? 'warning' : s === 'sold' ? 'info' : 'error';

function ListingCard({
  item,
  onModerate,
}: {
  item: MarketplaceListing;
  onModerate?: (id: string, status: ListingStatus) => void;
}) {
  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.mdMinus }}>
        <IconChip icon="cow" />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
            {item.title}
          </AppText>
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            {item.breed} · {item.animalCount} head{item.location ? ` · ${item.location}` : ''}
          </AppText>
        </View>
        <ActionChip label={item.status} variant={statusVariant(item.status)} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="title" color={colors.primary}>
          {formatPrice(item.currency, item.pricePerHead)}
        </AppText>
        <AppText variant="caption" color={colors.onSurfaceVariant}>
          per head
        </AppText>
      </View>
      {onModerate && item.status === 'pending' && (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button label="Approve" icon="check" onPress={() => onModerate(item.id, 'approved')} style={{ flex: 1 }} />
          <Button label="Reject" variant="outline" onPress={() => onModerate(item.id, 'rejected')} style={{ flex: 1 }} />
        </View>
      )}
    </View>
  );
}

/**
 * Marketplace (all roles) — browse approved listings, farmers list animals for
 * sale (pending approval), admins moderate the pending queue. Reads
 * `marketplace_listings` with a mock fallback.
 */
export default function Marketplace() {
  const { loading, isAuthenticated, isAdmin, user } = useAuth();
  const { data: loaded } = useResource(getMarketplaceListings, []);
  const [local, setLocal] = useState<MarketplaceListing[] | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Form state.
  const [title, setTitle] = useState('');
  const [breed, setBreed] = useState('');
  const [count, setCount] = useState('');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const listings = local ?? loaded;
  const approved = listings.filter((l) => l.status === 'approved');
  const pending = listings.filter((l) => l.status === 'pending');

  const moderate = async (id: string, status: ListingStatus) => {
    setLocal((prev) => (prev ?? listings).map((l) => (l.id === id ? { ...l, status } : l)));
    await setListingStatus(id, status); // best-effort; UI already reflects it
  };

  const resetForm = () => {
    setTitle('');
    setBreed('');
    setCount('');
    setPrice('');
    setLocation('');
  };

  const onSubmit = async () => {
    const animalCount = Number(count) || 1;
    const pricePerHead = Number(price) || 0;
    setSaving(true);
    const payload = { title: title.trim(), breed: breed.trim(), animalCount, pricePerHead, location: location.trim() || undefined };
    await submitListing(payload, user?.id);
    // Optimistically show it as pending regardless of backend availability.
    const optimistic: MarketplaceListing = {
      id: `new-${Date.now()}`,
      title: payload.title,
      breed: payload.breed,
      animalCount,
      pricePerHead,
      currency: 'UGX',
      location: payload.location ?? null,
      status: 'pending',
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setLocal((prev) => [optimistic, ...(prev ?? listings)]);
    setSaving(false);
    setSheetOpen(false);
    resetForm();
    Alert.alert('Listing submitted', 'Your listing was sent for admin approval.');
  };

  const canSubmit = title.trim() && breed.trim() && Number(price) > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Marketplace" subtitle={`${approved.length} listings available`} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl }}>
        {!isAdmin && (
          <Button label="Sell an animal" icon="plus" onPress={() => setSheetOpen(true)} style={{ marginBottom: spacing.md }} />
        )}

        {isAdmin && pending.length > 0 && (
          <>
            <AppText variant="overline" color={colors.warning} style={{ marginBottom: spacing.sm }}>
              Pending approval ({pending.length})
            </AppText>
            {pending.map((l) => (
              <ListingCard key={l.id} item={l} onModerate={moderate} />
            ))}
            <View style={{ height: spacing.md }} />
          </>
        )}

        <AppText variant="overline" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
          Available now
        </AppText>
        {approved.length === 0 ? (
          <View style={{ alignItems: 'center', padding: spacing.xl, gap: spacing.sm }}>
            <Icon name="storefront-outline" size={40} color={colors.onSurfaceVariant} />
            <AppText variant="body" color={colors.onSurfaceVariant}>
              No listings available yet.
            </AppText>
          </View>
        ) : (
          approved.map((l) => <ListingCard key={l.id} item={l} />)
        )}
      </Screen>

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="List an animal for sale">
        <TextField label="Title" required value={title} onChangeText={setTitle} placeholder="e.g. Boran heifers, in-calf" />
        <TextField label="Breed" required value={breed} onChangeText={setBreed} placeholder="e.g. Boran" />
        <TextField label="Number of head" value={count} onChangeText={setCount} placeholder="1" keyboardType="number-pad" />
        <TextField label="Price per head (UGX)" required value={price} onChangeText={setPrice} placeholder="e.g. 620000" keyboardType="number-pad" />
        <TextField label="Location" value={location} onChangeText={setLocation} placeholder="e.g. Nakuru" />
        <Button label="Submit for approval" loading={saving} disabled={!canSubmit} onPress={onSubmit} style={{ marginTop: spacing.sm }} />
      </BottomSheet>
    </View>
  );
}
