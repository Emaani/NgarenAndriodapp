import { ReactNode } from 'react';
import { Image, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { getScorecardById, STATUS_LABEL } from '@/data/scorecards';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { statusVisual, bcsColor } from '@/lib/scorecardVisual';
import { formatDate } from '@/lib/date';
import { AppText, EmptyState, GradientHeader, Icon, IconName, Screen } from '@/ui';

function Tile({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.divider, gap: spacing.xs }, shadow[1]]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 }}>
        <View style={{ width: 28, height: 28, borderRadius: radius.full, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={16} color={colors.primary} />
        </View>
        <AppText variant="bodyLarge" style={{ fontWeight: '700' }}>
          {title}
        </AppText>
      </View>
      {children}
    </View>
  );
}

function Line({ children }: { children: ReactNode }) {
  return (
    <AppText variant="body" color={colors.onSurface}>
      {children}
    </AppText>
  );
}

/**
 * Read-only drill-down of a past Visit Scorecard (Sep 7 2026 design): the same
 * tile layout as the quick-entry form, but fully locked — past visits cannot be
 * edited; corrections are a new dated entry (admin-only to modify).
 */
export default function ScorecardView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loading, isAuthenticated } = useAuth();
  const { data: card } = useResource(() => getScorecardById(String(id)), undefined);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  if (!card) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <GradientHeader title="Scorecard" showBack />
        <EmptyState icon="file-document-outline" title="Scorecard not found" subtitle="This record may have been removed." />
      </View>
    );
  }

  const sv = statusVisual(card.status);
  const v = card.vitals;
  const t = card.treatment;
  const vitalsLine = [
    typeof v.temperature === 'number' ? `Temp ${v.temperature}°C` : null,
    typeof v.weight === 'number' ? `Weight ${v.weight} kg` : null,
    typeof v.heartRate === 'number' ? `Heart ${v.heartRate} bpm` : null,
    typeof v.respRate === 'number' ? `Resp ${v.respRate} br/min` : null,
    typeof v.age === 'number' ? `Age ${v.age} yrs` : null,
  ].filter(Boolean).join('  ');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={`Visit — ${formatDate(card.date)}`} subtitle={`${card.animalLabel} · Read-only`} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl }}>
        {/* Locked banner */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.divider }}>
          <Icon name="lock-check-outline" size={16} color={colors.onSurfaceVariant} />
          <AppText variant="caption" color={colors.onSurfaceVariant} style={{ flex: 1 }}>
            Locked record · {card.visitType} · attending {card.vetName}
          </AppText>
        </View>

        {/* Status at time of visit */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: sv.tint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
          <Icon name={sv.icon} size={20} color={sv.color} />
          <AppText variant="body" style={{ fontWeight: '700' }} color={sv.color}>
            Status at time of visit: {STATUS_LABEL[card.status]}
          </AppText>
        </View>

        <Tile icon="thermometer" title="Baseline Vitals">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <AppText variant="title" style={{ fontWeight: '800' }} color={bcsColor(v.bcs)}>
              BCS {v.bcs != null ? v.bcs.toFixed(1) : '—'} / 5
            </AppText>
          </View>
          {vitalsLine ? <Line>{vitalsLine}</Line> : <AppText variant="caption" color={colors.onSurfaceVariant}>No other vitals recorded.</AppText>}
        </Tile>

        <Tile icon="stethoscope" title="Diagnosis">
          {card.diagnosisTags.length ? <Line>{card.diagnosisTags.join(', ')}</Line> : null}
          {card.diagnosisNotes ? <AppText variant="caption" color={colors.onSurfaceVariant}>{card.diagnosisNotes}</AppText> : null}
          {!card.diagnosisTags.length && !card.diagnosisNotes && !card.photo ? <AppText variant="caption" color={colors.onSurfaceVariant}>No diagnosis recorded.</AppText> : null}
          {card.photo ? (
            <Image source={{ uri: card.photo }} style={{ width: '100%', height: 200, borderRadius: radius.sm, backgroundColor: colors.divider, marginTop: spacing.xs }} resizeMode="cover" />
          ) : null}
        </Tile>

        <Tile icon="needle" title="Medication & Treatment">
          {t.drug ? (
            <>
              <Line>
                {t.drug}
                {t.dose ? ` — ${t.dose}` : ''}
                {t.route ? ` · ${t.route}` : ''}
                {t.frequency ? ` · ${t.frequency}` : ''}
              </Line>
              {t.nextDueDate ? <AppText variant="caption" color={colors.onSurfaceVariant}>Next due: {formatDate(t.nextDueDate)}</AppText> : null}
            </>
          ) : (
            <AppText variant="caption" color={colors.onSurfaceVariant}>No medication given.</AppText>
          )}
        </Tile>

        <Tile icon="content-cut" title="Grooming & Hygiene">
          {card.grooming.length ? <Line>{card.grooming.join(' · ')}</Line> : <AppText variant="caption" color={colors.onSurfaceVariant}>Nothing recorded.</AppText>}
        </Tile>

        {card.pregnancy?.applicable ? (
          <Tile icon="heart-pulse" title="Pregnancy observation">
            <Line>In-calf: {card.pregnancy.inCalf == null ? 'Not assessed' : card.pregnancy.inCalf ? 'Yes' : 'No'}</Line>
            {card.pregnancy.dueDate ? <AppText variant="caption" color={colors.onSurfaceVariant}>Estimated calving: {formatDate(card.pregnancy.dueDate)}</AppText> : null}
          </Tile>
        ) : null}

        <Tile icon="note-text-outline" title="Vet Notes">
          {card.notes ? <Line>{card.notes}</Line> : <AppText variant="caption" color={colors.onSurfaceVariant}>No notes.</AppText>}
          {card.flagRecheck ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}>
              <Icon name="flag-outline" size={14} color={colors.warning} />
              <AppText variant="caption" color={colors.warning} style={{ fontWeight: '600' }}>
                Flagged for recheck
              </AppText>
            </View>
          ) : null}
        </Tile>
      </Screen>
    </View>
  );
}
