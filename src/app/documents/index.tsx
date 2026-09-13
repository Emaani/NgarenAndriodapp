import { useCallback, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { deleteDocument, DocumentKind, DocumentRecord, getVisibleDocuments, KIND_LABEL, RETENTION_DAYS } from '@/data/documents';
import { useAuth } from '@/services/auth';
import { formatDate } from '@/lib/date';
import { AppText, EmptyState, GradientHeader, Icon, IconName, Screen } from '@/ui';

const KIND_ICON: Record<DocumentKind, IconName> = {
  scorecard: 'clipboard-pulse-outline',
  report: 'file-chart-outline',
  'station-log': 'clipboard-list-outline',
  other: 'file-outline',
};

type Filter = 'all' | DocumentKind;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'scorecard', label: 'Scorecards' },
  { key: 'report', label: 'Reports' },
  { key: 'station-log', label: 'Station logs' },
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
    Alert.alert('Delete document', `Remove “${d.title}” from the store?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
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
      <GradientHeader title="Documents" subtitle={isAdmin ? 'All generated documents' : 'Your generated documents'} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
          <Icon name="information-outline" size={16} color={colors.primary} />
          <AppText variant="caption" color={colors.primaryDark} style={{ flex: 1 }}>
            Documents are auto-deleted {RETENTION_DAYS} days after generation to keep storage lean. Share or forward anything you need to keep.
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
                  {f.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {visible.length === 0 ? (
          <EmptyState icon="folder-open-outline" title="No documents" subtitle="Scorecards and reports you generate are stored here for quick access." />
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
                    {left === 0 ? 'Deletes today' : `Auto-deletes in ${left} day${left === 1 ? '' : 's'}`}
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
