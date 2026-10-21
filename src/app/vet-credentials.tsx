import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { getVetProfile, saveVetProfile, submitVetProfile, VetProfileStatus } from '@/data/vetSelfProfile';
import { logAuditEvent } from '@/data/localAuditEvents';
import { addLocalNotification } from '@/data/localNotifications';
import { sendLocalNotification } from '@/services/push';
import { useAuth } from '@/services/auth';
import { persistImage } from '@/lib/photos';
import { notify } from '@/lib/toast';
import { useT } from '@/i18n';
import { AppText, Button, GradientHeader, Icon, PhotoField, PickerField, Screen, TextField } from '@/ui';

const SPECIALTIES = ['General practice', 'Large animal / Cattle', 'Reproduction', 'Emergency / Field calls', 'Poultry', 'Small ruminants'];

const STATUS_META: Record<VetProfileStatus, { tint: string; fg: string; icon: Parameters<typeof Icon>[0]['name']; label: string }> = {
  draft: { tint: colors.divider, fg: colors.onSurfaceVariant, icon: 'file-document-edit-outline', label: 'Draft — not submitted' },
  pending: { tint: '#FEF3C7', fg: '#B45309', icon: 'clock-outline', label: 'Pending Ngaren approval' },
  approved: { tint: '#DCFCE7', fg: '#15803D', icon: 'check-decagram', label: 'Approved & active' },
  rejected: { tint: '#FEE2E2', fg: '#B91C1C', icon: 'alert-circle-outline', label: 'Changes requested' },
};

/**
 * Vet self-enlisting (spec 1) — the veterinarian maintains their own
 * professional profile and uploads the documents Ngaren needs to activate them.
 * Submission moves the profile into Ngaren's maker-checker review; the vet is
 * only activated once an admin approves it.
 */
export default function VetCredentials() {
  const router = useRouter();
  const t = useT();
  const { loading, isAuthenticated, canVet, user } = useAuth();

  const [name, setName] = useState('');
  const [credentials, setCredentials] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [clinic, setClinic] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [licenceDoc, setLicenceDoc] = useState<string | null>(null);
  const [idDoc, setIdDoc] = useState<string | null>(null);
  const [certDoc, setCertDoc] = useState<string | null>(null);
  const [status, setStatus] = useState<VetProfileStatus>('draft');
  const [rejection, setRejection] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    void getVetProfile(user.id).then((p) => {
      if (p) {
        setName(p.name);
        setCredentials(p.credentials ?? '');
        setSpecialty(p.specialty ?? '');
        setClinic(p.clinic ?? '');
        setCity(p.city ?? '');
        setPhone(p.phone ?? '');
        setBio(p.bio ?? '');
        setLicenceDoc(p.documents.find((d) => d.id === 'licence')?.uri ?? null);
        setIdDoc(p.documents.find((d) => d.id === 'id')?.uri ?? null);
        setCertDoc(p.documents.find((d) => d.id === 'cert')?.uri ?? null);
        setStatus(p.status);
        setRejection(p.rejectionReason ?? null);
      } else {
        setName(user.fullName ?? '');
      }
      setHydrated(true);
    });
  }, [user?.id, user?.fullName]);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!canVet) return <Redirect href="/(tabs)/home" />;

  const docs = () => {
    const out: { id: string; label: string; uri: string }[] = [];
    const lic = persistImage(licenceDoc);
    const idd = persistImage(idDoc);
    const cert = persistImage(certDoc);
    if (lic) out.push({ id: 'licence', label: 'Practising licence', uri: lic });
    if (idd) out.push({ id: 'id', label: 'National ID / passport', uri: idd });
    if (cert) out.push({ id: 'cert', label: 'Certificate', uri: cert });
    return out;
  };

  const persist = async (newStatus: VetProfileStatus) => {
    if (!user?.id) return;
    await saveVetProfile({
      vetId: user.id,
      name: name.trim() || user.fullName || user.email || 'Vet',
      email: user.email,
      phone: phone.trim() || null,
      credentials: credentials.trim() || null,
      specialty: specialty || null,
      clinic: clinic.trim() || null,
      city: city.trim() || null,
      bio: bio.trim() || null,
      documents: docs(),
      status: newStatus,
      submittedAt: newStatus === 'pending' ? new Date().toISOString() : status === 'pending' ? new Date().toISOString() : null,
      rejectionReason: newStatus === 'pending' ? null : rejection,
    });
  };

  const onSaveDraft = async () => {
    setBusy(true);
    try {
      await persist(status === 'approved' ? 'approved' : 'draft');
      notify('Profile saved');
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = name.trim().length > 1 && !!credentials.trim() && !!specialty && (!!licenceDoc || !!idDoc);

  const onSubmit = async () => {
    if (!canSubmit) {
      Alert.alert('Incomplete', 'Add your name, licence/credentials, specialty and at least one document before submitting.');
      return;
    }
    setBusy(true);
    try {
      await persist('pending');
      if (user?.id) await submitVetProfile(user.id);
      const by = user?.fullName ?? user?.email ?? 'Vet';
      void logAuditEvent({ type: 'other', title: `Vet enlisting submitted — ${by}`, detail: `${specialty} · ${credentials}`, by });
      void addLocalNotification({ title: 'Vet enlisting submitted', message: `${by} submitted their professional profile for approval.` });
      void sendLocalNotification('Submitted for approval', 'Your profile is now with Ngaren for review. You will be activated once approved.', { type: 'VET_ENLISTING' });
      setStatus('pending');
      Alert.alert('Submitted', 'Your profile has been sent to Ngaren for approval. You will be notified once activated.', [{ text: t('reg.done'), onPress: () => router.back() }]);
    } finally {
      setBusy(false);
    }
  };

  const meta = STATUS_META[status];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="My Professional Profile" subtitle="Enlist with Ngaren" showBack />
      <Screen contentStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl }}>
        {/* Status banner */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: meta.tint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
          <Icon name={meta.icon} size={20} color={meta.fg} />
          <View style={{ flex: 1 }}>
            <AppText variant="body" style={{ fontWeight: '700' }} color={meta.fg}>{meta.label}</AppText>
            {status === 'rejected' && rejection ? <AppText variant="caption" color={meta.fg}>{rejection}</AppText> : null}
            {status === 'pending' ? <AppText variant="caption" color={meta.fg}>Ngaren is reviewing your documents.</AppText> : null}
          </View>
        </View>

        {!hydrated ? null : (
          <>
            <AppText variant="title" style={{ marginBottom: spacing.sm }}>Professional profile</AppText>
            <TextField label="Full name" required value={name} onChangeText={setName} placeholder="e.g. Dr. Grace Auma" />
            <TextField label="Credentials / licence no." required value={credentials} onChangeText={setCredentials} placeholder="e.g. BVM · Reg. #12345" />
            <PickerField label="Specialty" required value={specialty} placeholder="Choose a specialty" options={SPECIALTIES.map((s) => ({ label: s, value: s }))} onSelect={setSpecialty} />
            <TextField label="Clinic / practice" value={clinic} onChangeText={setClinic} placeholder="e.g. Mbarara Vet Clinic" />
            <TextField label="City / area" value={city} onChangeText={setCity} placeholder="e.g. Mbarara" />
            <TextField label="Phone" value={phone} onChangeText={setPhone} placeholder="+256…" keyboardType="phone-pad" />
            <TextField label="About you" value={bio} onChangeText={setBio} placeholder="Short professional bio" multiline />

            <AppText variant="title" style={{ marginTop: spacing.md, marginBottom: spacing.xs }}>Required documents</AppText>
            <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
              Upload clear photos or scans. Ngaren verifies these before activating your account.
            </AppText>
            <PhotoField label="Practising licence" value={licenceDoc} onChange={setLicenceDoc} />
            <PhotoField label="National ID / passport" value={idDoc} onChange={setIdDoc} />
            <PhotoField label="Additional certificate (optional)" value={certDoc} onChange={setCertDoc} />

            <Button label="Save draft" variant="outline" icon="content-save-outline" loading={busy} onPress={onSaveDraft} style={{ marginTop: spacing.md }} />
            <Button
              label={status === 'pending' ? 'Re-submit for approval' : 'Submit to Ngaren for approval'}
              icon="send-check-outline"
              loading={busy}
              disabled={busy}
              onPress={onSubmit}
              style={{ marginTop: spacing.sm }}
            />
          </>
        )}
      </Screen>
    </View>
  );
}
