import { useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { getKycSubmissions, setKycStatus, KycSubmission } from '@/data/localKyc';
import { logAuditEvent } from '@/data/localAuditEvents';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { notify } from '@/lib/toast';
import { formatDateTime } from '@/lib/date';
import { useT } from '@/i18n';
import { ActionChip, AnimalPhoto, AppText, Button, EmptyState, GradientHeader, Screen } from '@/ui';

const statusVariant = (s: string) => (s === 'approved' ? 'success' : s === 'rejected' ? 'error' : 'warning');

/**
 * KYC review (section B) — admin-exclusive maker-checker. Reviews each user's
 * captured facial ID + ID document and approves or rejects their account.
 */
export default function KycReview() {
  const t = useT();
  const { loading, isAuthenticated, isAdmin, user } = useAuth();
  const { data: submissions, reload } = useResource(getKycSubmissions, []);
  const [local, setLocal] = useState<KycSubmission[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!isAdmin) return <Redirect href="/(tabs)/home" />;

  const items = (local ?? submissions).filter((k) => k.status !== 'rejected');
  const pendingCount = items.filter((k) => k.status === 'pending').length;

  const decide = async (k: KycSubmission, status: 'approved' | 'rejected') => {
    setBusy(k.id);
    const by = user?.fullName ?? user?.email ?? 'Admin';
    setLocal((prev) => (prev ?? submissions).map((x) => (x.id === k.id ? { ...x, status } : x)));
    await setKycStatus(k.id, status, by);
    await logAuditEvent({ type: 'other', title: `KYC ${status} — ${k.name}`, detail: `${k.email} · reviewed by ${by}`, by });
    setBusy(null);
    notify(status === 'approved' ? t('kyc.approvedToast', { name: k.name }) : t('kyc.rejectedToast', { name: k.name }));
    reload();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('kyc.title')} subtitle={t('kyc.subtitle', { count: pendingCount })} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {items.length === 0 ? (
          <EmptyState icon="shield-account-outline" title={t('kyc.emptyTitle')} subtitle={t('kyc.emptySub')} />
        ) : (
          items.map((k) => (
            <View
              key={k.id}
              style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.mdMinus }}>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>{k.name}</AppText>
                  <AppText variant="caption" color={colors.onSurfaceVariant}>{k.email}{k.phone ? ` · ${k.phone}` : ''}</AppText>
                  <AppText variant="caption" color={colors.onSurfaceVariant}>{t('kyc.submitted', { date: formatDateTime(k.submittedAt) })}</AppText>
                </View>
                <ActionChip label={t(`kyc.status.${k.status}`)} variant={statusVariant(k.status)} />
              </View>

              {/* Captured facial ID + ID document. */}
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <AnimalPhoto uri={k.selfie} size={92} icon="face-recognition" />
                  <AppText variant="caption" color={colors.onSurfaceVariant}>{t('kyc.facialId')}</AppText>
                </View>
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <AnimalPhoto uri={k.idPhoto} size={92} icon="card-account-details-outline" />
                  <AppText variant="caption" color={colors.onSurfaceVariant}>{t('kyc.idDoc')}</AppText>
                </View>
              </View>

              {k.status === 'pending' ? (
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Button label={t('kyc.approve')} icon="check-decagram-outline" loading={busy === k.id} onPress={() => decide(k, 'approved')} style={{ flex: 1 }} />
                  <Button label={t('kyc.reject')} variant="outline" onPress={() => decide(k, 'rejected')} style={{ flex: 1 }} />
                </View>
              ) : null}
            </View>
          ))
        )}
      </Screen>
    </View>
  );
}
