import { useCallback, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { deleteDocument, DocumentKind, DocumentRecord, getVisibleDocuments, KIND_LABEL, RETENTION_DAYS } from '@/data/documents';
import { useAuth } from '@/services/auth';
import { formatDate } from '@/lib/date';
import { useT } from '@/i18n';
import { AppText, EmptyState, GradientHeader, Icon, IconName, Screen } from '@/ui';

const KIND_ICON: Record<DocumentKind, IconName> = {
  scorecard: 'clipboard-pulse-outline',
  report: 'file-chart-outline',
  'station-log': 'clipboard-list-outline',
  other: 'file-outline',
};

type Filter = 'all' | DocumentKind;
const FILTERS: { key: Filter; labelKey: string }[] = [
  { key: 'all', labelKey: 'doc.all' },
  { key: 'scorecard', labelKey: 'doc.scorecards' },
  { key: 'report', labelKey: 'doc.reports' },
  { key: 'station-log', labelKey: 'doc.stationLogs' },
];

/** Days remaining before auto-delete. */
function daysLeft(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 864e5));
}

/**
 * Classified documents module (Sep 12 2026): generated scorecards, reports and
 * station logs in one place, with profile-based access (admins see all; a vet
 * or farmer sees only their own) and auto-deletion after a retention window.
 */
export default function Documents() {
  const router = useRouter();
  const t = useT();
  const { loading, isAuthenticated, isAdmin, user } = useAuth();
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

  const reload = useCallback(() => {
    getVisibleDocuments({ isAdmin, userId: user?.id }).then(setDocs).catch(() => setDocs([]));
  }, [isAdmin, user?.id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const visible = filter === 'all' ? docs : docs.filter((d) => d.kind === filter);

  const confirmDelete = (d: DocumentRecord) => {
    Alert.alert(t('doc.deleteTitle'), t('doc.deleteBody', { title: d.title }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteDocument(d.id);
          reload();
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('home.banner.documents')} subtitle={isAdmin ? t('doc.subtitleAdmin') : t('doc.subtitleOwn')} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
          <Icon name="information-outline" size={16} color={colors.primary} />
          <AppText variant="caption" color={colors.primaryDark} style={{ flex: 1 }}>
            {t('doc.retention', { days: RETENTION_DAYS })}
          </AppText>
        </View>

        {/* Kind filter */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md }}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={{ paddingHorizontal: spacing.mdMinus, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: active ? colors.primary : colors.surface, borderWidth: 1, borderColor: active ? colors.primary : colors.divider }}>
                <AppText variant="caption" color={active ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
                  {t(f.labelKey)}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {visible.length === 0 ? (
          <EmptyState icon="folder-open-outline" title={t('doc.emptyTitle')} subtitle={t('doc.emptySub')} />
        ) : (
          visible.map((d) => {
            const left = daysLeft(d.expiresAt);
            return (
              <Pressable
                key={d.id}
                onPress={() => router.push(`/documents/${d.id}` as never)}
                style={({ pressed }) => [
                  { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.divider, opacity: pressed ? 0.9 : 1 },
                  shadow[1],
                ]}>
                <View style={{ width: 38, height: 38, borderRadius: radius.full, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={KIND_ICON[d.kind]} size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                    {d.title}
                  </AppText>
                  <AppText variant="caption" color={colors.onSurfaceVariant}>
                    {KIND_LABEL[d.kind]}
                    {d.format ? ` · ${d.format.toUpperCase()}` : ''}
                    {d.subject ? ` · ${d.subject}` : ''} · {formatDate(d.createdAt.slice(0, 10))}
                    {isAdmin ? ` · ${d.ownerRole}` : ''}
                  </AppText>
                  <AppText variant="caption" color={left <= 3 ? colors.warning : colors.onSurfaceVariant} style={{ fontWeight: left <= 3 ? '700' : '400' }}>
                    {left === 0 ? t('doc.deletesToday') : left === 1 ? t('doc.autoDeletesOne') : t('doc.autoDeletes', { days: left })}
                  </AppText>
                </View>
                <Pressable onPress={() => confirmDelete(d)} hitSlop={8}>
                  <Icon name="trash-can-outline" size={20} color={colors.onSurfaceVariant} />
                </Pressable>
              </Pressable>
            );
          })
        )}
      </Screen>
    </View>
  );
}
