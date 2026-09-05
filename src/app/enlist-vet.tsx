import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { colors, radius, spacing } from '@/theme';
import { animals as animalsFallback } from '@/data/mock';
import { addEnlistedVet } from '@/data/vetEnlistments';
import { getHerd } from '@/data/herd';
import { distanceMeters, LatLng } from '@/lib/geo';
import { useAuth } from '@/services/auth';
import { notify } from '@/lib/toast';
import { AppText, Button, GradientHeader, Icon, PickerField, Screen, TextField } from '@/ui';

const SPECIALTIES = [
  'General practice',
  'Large animal / Cattle',
  'Reproduction',
  'Emergency / Field calls',
  'Poultry',
  'Small ruminants',
].map((s) => ({ label: s, value: s }));

function Toggle({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <Pressable onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }}>
      <Icon name={value ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={value ? colors.primary : colors.onSurfaceVariant} />
      <AppText variant="body" color={colors.onSurface}>
        {label}
      </AppText>
    </Pressable>
  );
}

/**
 * Admin-created vet enlisting (Sep 3 2026 standup). An admin onboards a vet's
 * professional persona in-app; the vet is then discoverable and bookable in
 * Find-a-Vet with the standard profile format. Creating the vet's LOGIN is a
 * separate step (auth user + `veterinary` role) — we capture their email to
 * link it later.
 */
export default function EnlistVet() {
  const router = useRouter();
  const { loading, isAuthenticated, isAdmin, user } = useAuth();

  const [name, setName] = useState('');
  const [credentials, setCredentials] = useState('');
  const [clinic, setClinic] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [institution, setInstitution] = useState('');
  const [city, setCity] = useState('');
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [nearestKm, setNearestKm] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [experience, setExperience] = useState('');
  const [videoVisits, setVideoVisits] = useState(true);
  const [selfPay, setSelfPay] = useState(true);
  const [tcs, setTcs] = useState(false);
  const [saving, setSaving] = useState(false);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!isAdmin) return <Redirect href="/(tabs)/home" />;

  // Capture the vet's GPS pin and derive their distance from the nearest farm
  // (Sep 5 2026 standup: device coordinates / map pin, not a typed distance).
  const captureLocation = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Location permission needed', 'Enable location access to drop the vet’s map pin.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const pin: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCoords(pin);
      // Distance to the nearest farm animal that has coordinates → the vet's
      // real proximity to farms, replacing the manual estimate.
      let herd = animalsFallback;
      try {
        herd = await getHerd();
      } catch {
        // fall back to the seed herd for the distance estimate
      }
      const farmPins = herd.map((a) => a.coordinates).filter((c): c is LatLng => !!c);
      if (farmPins.length) {
        const km = Math.min(...farmPins.map((f) => distanceMeters(pin, f))) / 1000;
        setNearestKm(Math.max(0.1, Math.round(km * 10) / 10));
      } else {
        setNearestKm(null);
      }
    } catch {
      Alert.alert('Could not get location', 'Please try again to capture the vet’s coordinates.');
    } finally {
      setLocating(false);
    }
  };

  const canSubmit = name.trim().length > 1 && !!specialty && city.trim().length > 0 && !!coords && tcs;

  const onSubmit = async () => {
    setSaving(true);
    try {
      const vet = await addEnlistedVet({
        name: name.trim(),
        credentials: credentials.trim() || undefined,
        clinic: clinic.trim() || city.trim(),
        specialty: specialty,
        // Proximity from the captured pin; if no farm has coords yet, keep the
        // vet in range so they still surface to nearby farmers.
        distanceKm: nearestKm ?? 2,
        coordinates: coords ?? undefined,
        institution: institution.trim() || undefined,
        videoVisits,
        selfPay,
        yearsExperience: experience.trim() ? Number(experience) : undefined,
        tagline: 'Newly enlisted · Ngaren network',
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        city: city.trim(),
        enlistedBy: user?.fullName ?? user?.email ?? undefined,
      });
      notify(`${vet.name} enlisted`);
      Alert.alert(
        'Vet enlisted',
        `${vet.name} is now listed and bookable in Find-a-Vet.\n\nTo give them app access, create their login (auth user + "veterinary" role)${email.trim() ? ` for ${email.trim()}` : ''}.`,
        [{ text: 'Done', onPress: () => router.replace('/find-vet') }],
      );
    } catch {
      setSaving(false);
      notify('Could not enlist the vet — please try again');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Enlist a Vet" subtitle="Onboard a veterinarian to the network" showBack />
      <Screen contentStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl }}>
        <AppText variant="title" style={{ marginBottom: spacing.sm }}>
          Professional profile
        </AppText>
        <TextField label="Full name" required value={name} onChangeText={setName} placeholder="e.g. Dr. Grace Auma" />
        <TextField label="Credentials" value={credentials} onChangeText={setCredentials} placeholder="e.g. Veterinary Surgeon (BVM)" />
        <PickerField label="Specialty" required value={specialty} placeholder="Select a specialty" options={SPECIALTIES} onSelect={setSpecialty} />
        <TextField label="Clinic / practice" value={clinic} onChangeText={setClinic} placeholder="e.g. Kampala Livestock Vets" />
        <TextField label="Institution" value={institution} onChangeText={setInstitution} placeholder="e.g. Makerere University" />
        <TextField label="Years of experience" value={experience} onChangeText={setExperience} placeholder="e.g. 8" keyboardType="number-pad" />

        <AppText variant="title" style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>
          Location & discovery
        </AppText>
        <TextField label="City / area" required value={city} onChangeText={setCity} placeholder="e.g. Kampala" />

        {/* GPS pin instead of manual distance (Sep 5 2026 standup). */}
        <AppText variant="body" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
          Location pin *
        </AppText>
        <Pressable
          onPress={captureLocation}
          disabled={locating}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: coords ? colors.primaryTint : colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: coords ? colors.primary : colors.divider, padding: spacing.md }}>
          <Icon name={coords ? 'map-marker-check' : 'crosshairs-gps'} size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <AppText variant="body" style={{ fontWeight: '600' }} color={coords ? colors.primaryDark : colors.onSurface}>
              {locating ? 'Getting location…' : coords ? 'Location captured' : 'Capture current location (drop pin)'}
            </AppText>
            {coords ? (
              <AppText variant="caption" color={colors.onSurfaceVariant}>
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                {nearestKm != null ? ` · ~${nearestKm} km from nearest farm` : ' · no farm coordinates yet'}
              </AppText>
            ) : (
              <AppText variant="caption" color={colors.onSurfaceVariant}>
                Uses device GPS to set the vet’s pin. Vets within 5 km appear to farmers.
              </AppText>
            )}
          </View>
          {coords ? <Icon name="refresh" size={18} color={colors.onSurfaceVariant} /> : null}
        </Pressable>
        <View style={{ marginBottom: spacing.md }} />

        <AppText variant="title" style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>
          Contact & options
        </AppText>
        <TextField label="Email (to link their login later)" value={email} onChangeText={setEmail} placeholder="vet@example.com" keyboardType="email-address" />
        <TextField label="Phone" value={phone} onChangeText={setPhone} placeholder="+256…" keyboardType="phone-pad" />
        <Toggle label="Offers video visits" value={videoVisits} onToggle={() => setVideoVisits((v) => !v)} />
        <Toggle label="Self-pay" value={selfPay} onToggle={() => setSelfPay((v) => !v)} />

        <Pressable onPress={() => setTcs((v) => !v)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.md }}>
          <Icon name={tcs ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={tcs ? colors.primary : colors.onSurfaceVariant} />
          <AppText variant="body" color={colors.onSurface} style={{ flex: 1 }}>
            The vet consents to enlisting on the Ngaren network and to the practitioner terms & conditions.
          </AppText>
        </Pressable>

        <Button label="Enlist vet" icon="account-plus-outline" loading={saving} disabled={!canSubmit} onPress={onSubmit} />
      </Screen>
    </View>
  );
}
