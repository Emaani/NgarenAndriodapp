import { colors, spacing } from '@/theme';
import { BehaviourSeries } from '@/data/types';
import { Card } from './Card';
import { AppText } from './AppText';
import { LineChart } from './charts/LineChart';

export function ChartCard({ series }: { series: BehaviourSeries }) {
  return (
    <Card style={{ marginBottom: spacing.mdMinus }}>
      <AppText variant="bodyLarge" style={{ fontWeight: '600', marginBottom: spacing.sm }}>
        {series.label} {series.unit ? `(${series.unit})` : ''}
      </AppText>
      <LineChart actual={series.actual} pfi={series.pfi} />
    </Card>
  );
}
