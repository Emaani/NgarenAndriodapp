import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { getAllVetProfiles, setVetProfileReview, VetSelfProfile } from '@/data/vetSelfProfile';
import { logAuditEvent } from '@/data/localAuditEvents';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { notify } from '@/lib/toast';
import { formatDateTime } from '@/lib/date';
import { ActionChip, AnimalPhoto, AppText, Button, EmptyState, GradientHeader, Screen } from '@/ui';

const statusVariant = (s: string) => (s === 'approved' ? 'success' : s === 'rejected' ? 'error' : s === 'pending' ? 'warning' : 'neutral');

/**
 * Vet enlisting review (spec 1) — admin maker-checker. Reviews each vet's
 * submitted professional profile + documents and approves (activates) or
 * requests changes. Approved vets are activated in the app.
 */
export default function VetCredentialReviews() {
  const { loading, isAuthenticated, isAdmin, user } = useAuth();
  const { data: profiles, reload } = useResource(getAllVetProfiles, []);
  const [busy, setBusy] = useState<string | null>(null);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!isAdmin) return <Redirect href="/(tabs)/home" />;

  // Draft profiles aren't submitted yet, so they don't appear in the queue.
  const items = profiles.filter((p) => p.status !== 'draft');
  const pendingCount = items.filter((p) => p.status === 'pending').length;

  const approve = async (p: VetSelfProfile) => {
    setBusy(p.vetId);
    const by = user?.fullName ?? user?.email ?? 'Admin';
    await setVetProfileReview(p.vetId, 'approved', by);
    await logAuditEvent({ type: 'other', title: `Vet approved — ${p.name}`, detail: `${p.specialty ?? ''} · ${p.credentials ?? ''} · by ${by}`, by });
    setBusy(null);
    notify(`${p.name} approved & activated`);
    reload();
  };

  const doReject = async (p: VetSelfProfile, reason: string) => {
    setBusy(p.vetId);
    const by = user?.fullName ?? user?.email ?? 'Admin';
    await setVetProfileReview(p.vetId, 'rejected', by, reason.trim() || 'Please review your documents and resubmit.');
    await logAuditEvent({ type: 'other', title: `Vet changes requested — ${p.name}`, detail: `by ${by}`, by });
    setBusy(null);
    notify('Changes requested');
    reload();
  };

  const reject = (p: VetSelfProfile) => {
    // Alert.prompt is iOS-only; Android falls back to a default note.
    if (Platform.OS === 'ios' && typeof Alert.prompt === 'function') {
      Alert.prompt('Request changes', `What does ${p.name} need to correct or add?`, (reason?: string) => void doReject(p, reason ?? ''));
    } else {
      void doReject(p, 'Please review your documents and resubmit.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Vet Approvals" subtitle={`${pendingCount} awaiting review`} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl }}>
        {items.length === 0 ? (
          <EmptyState icon="shield-account-outline" title="No vet submissions" subtitle="Vet enlisting requests will appear here for approval." />
        ) : (
          items.map((p) => (
            <View
              key={p.vetId}
              style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.mdMinus }}>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>{p.name}</AppText>
                  <AppText variant="caption" color={colors.onSurfaceVariant}>{[p.specialty, p.credentials].filter(Boolean).join(' · ')}</AppText>
                  <AppText variant="caption" color={colors.onSurfaceVariant}>{[p.clinic, p.city].filter(Boolean).join(' · ')}</AppText>
                  {p.submittedAt ? <AppText variant="caption" color={colors.onSurfaceVariant}>Submitted {formatDateTime(p.submittedAt)}</AppText> : null}
                </View>
                <ActionChip label={p.status} variant={statusVariant(p.status)} />
              </View>

              {p.documents.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                  {p.documents.map((d) => (
                    <View key={d.id} style={{ alignItems: 'center', gap: 4 }}>
                      <AnimalPhoto uri={d.uri} size={84} icon="file-document-outline" />
                      <AppText variant="caption" color={colors.onSurfaceVariant}>{d.label}</AppText>
                    </View>
                  ))}
                </View>
              ) : (
                <AppText variant="caption" color={colors.error}>No documents uploaded.</AppText>
              )}

              {p.status === 'pending' ? (
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Button label="Approve & activate" icon="check-decagram-outline" loading={busy === p.vetId} onPress={() => approve(p)} style={{ flex: 1 }} />
                  <Button label="Request changes" variant="outline" onPress={() => reject(p)} style={{ flex: 1 }} />
                </View>
              ) : p.status === 'rejected' && p.rejectionReason ? (
                <AppText variant="caption" color={colors.error}>Requested: {p.rejectionReason}</AppText>
              ) : null}
            </View>
          ))
        )}
      </Screen>
    </View>
  );
}
