import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { failedSyncCount, pendingSyncCount, processSyncQueue, syncNow } from '@/data/syncQueue';
import { useT } from '@/i18n';
import { AppText } from './AppText';
import { Icon } from './Icon';

/**
 * Offline sync status (robustness UX): shows whether the device's queued writes
 * — animal registrations, scorecards, photo uploads — have reached the backend,
 * and offers a manual "sync now". Self-contained: it polls the durable queue,
 * nudges it while mounted, and drains dead-lettered writes on tap.
 */
export function SyncStatus({ onSynced }: { onSynced?: () => void }) {
  const t = useT();
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setPending(await pendingSyncCount());
    setFailed(await failedSyncCount());
  }, []);

  useEffect(() => {
    let active = true;
    const tick = async () => {
      void processSyncQueue();
      const [p, f] = [await pendingSyncCount(), await failedSyncCount()];
      if (active) {
        setPending(p);
        setFailed(f);
      }
    };
    void tick();
    const t = setInterval(tick, 5000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  const onSyncNow = async () => {
    setSyncing(true);
    try {
      await syncNow();
      await refresh();
      onSynced?.();
    } finally {
      setSyncing(false);
    }
  };

  const hasWork = pending > 0;
  const tint = failed > 0 ? colors.error : hasWork ? colors.warning : colors.success;
  const tintBg = failed > 0 ? colors.errorTint : hasWork ? colors.warningTint : colors.successTint;
  const icon = syncing ? 'sync' : failed > 0 ? 'cloud-alert' : hasWork ? 'cloud-upload-outline' : 'cloud-check-outline';
  const label = syncing
    ? t('sync.syncing')
    : failed > 0
      ? failed === 1
        ? t('sync.failedOne')
        : t('sync.failed', { count: failed })
      : hasWork
        ? pending === 1
          ? t('sync.pendingOne')
          : t('sync.pending', { count: pending })
        : t('sync.allSynced');

  return (
    <Pressable
      onPress={hasWork && !syncing ? onSyncNow : undefined}
      disabled={!hasWork || syncing}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: tintBg, borderWidth: 1, borderColor: tint + '44' }}>
      <Icon name={icon} size={16} color={tint} />
      <AppText variant="caption" color={tint} style={{ flex: 1, fontWeight: '600' }}>
        {label}
      </AppText>
      {hasWork && !syncing ? <Icon name="chevron-right" size={16} color={tint} /> : null}
    </Pressable>
  );
}
