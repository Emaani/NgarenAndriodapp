import { View } from 'react-native';
import { colors, spacing } from '@/theme';
import { BehaviourSeries } from '@/data/types';
import { Card } from './Card';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { LineChart } from './charts/LineChart';

export function ChartCard({ series }: { series: BehaviourSeries }) {
  const n = series.actual.length;
  const latest = n ? series.actual[n - 1] : 0;
  const prev = n > 1 ? series.actual[n - 2] : latest;
  const delta = latest - prev;
  const up = delta >= 0;
  const deltaColor = delta === 0 ? colors.onSurfaceVariant : up ? colors.success : colors.error;

  return (
    <Card style={{ marginBottom: spacing.mdMinus }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <View>
          <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
            {series.label}
          </AppText>
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            Latest reading{series.unit ? ` · ${series.unit}` : ''}
          </AppText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <AppText variant="title" color={colors.primary}>
            {Number.isInteger(latest) ? latest : latest.toFixed(1)}
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Icon name={delta === 0 ? 'minus' : up ? 'arrow-up' : 'arrow-down'} size={13} color={deltaColor} />
            <AppText variant="caption" color={deltaColor} style={{ fontWeight: '600' }}>
              {Math.abs(delta) < 0.05 ? '0' : Math.abs(delta).toFixed(1)} vs prev
            </AppText>
          </View>
        </View>
      </View>
      <LineChart
        actual={series.actual}
        pfi={series.pfi}
        unit={series.unit}
        xLabels={n > 1 ? [`−${n - 1}d`, 'Now'] : undefined}
      />
    </Card>
  );
}
