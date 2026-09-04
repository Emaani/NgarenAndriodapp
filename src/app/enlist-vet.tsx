import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { addEnlistedVet } from '@/data/vetEnlistments';
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
  const [distanceKm, setDistanceKm] = useState('2');
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

  const canSubmit = name.trim().length > 1 && !!specialty && city.trim().length > 0 && tcs;

  const onSubmit = async () => {
    setSaving(true);
    try {
      const dist = Number(distanceKm);
      const vet = await addEnlistedVet({
        name: name.trim(),
        credentials: credentials.trim() || undefined,
        clinic: clinic.trim() || city.trim(),
        specialty: specialty,
        distanceKm: Number.isFinite(dist) && dist > 0 ? dist : 2,
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
        <TextField label="Approx. distance from farms (km)" value={distanceKm} onChangeText={setDistanceKm} placeholder="2" keyboardType="decimal-pad" />
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginTop: -spacing.sm, marginBottom: spacing.md }}>
          Proximity uses the registered area for now (GPS discovery is a later phase). Vets within 5 km appear to farmers.
        </AppText>

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
