import { useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { teamMembers as teamFallback, userRoles as rolesFallback } from '@/data/mock';
import { createTeamMember, deleteTeamMember, getTeamMembers, getUserRoles } from '@/data/api';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { useT } from '@/i18n';
import {
  ActionChip,
  AppText,
  Button,
  Card,
  GradientHeader,
  Icon,
  IconChip,
  PickerField,
  Screen,
  TextField,
} from '@/ui';

function roleVariant(role: string) {
  const r = role.toLowerCase();
  if (r.includes('admin')) return 'info' as const;
  if (r.includes('vet')) return 'success' as const;
  if (r.includes('viewer')) return 'neutral' as const;
  return 'warning' as const;
}

export default function Users() {
  const t = useT();
  const { isAdmin, loading, isAuthenticated } = useAuth();
  const { data: members, reload } = useResource(() => getTeamMembers(), teamFallback);
  const { data: roles } = useResource(() => getUserRoles(), rolesFallback);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [roleKey, setRoleKey] = useState('');
  const [saving, setSaving] = useState(false);

  const roleOptions = useMemo(
    () => roles.map((r) => ({ label: r.name, value: String(r.key) })),
    [roles],
  );

  // Guard after hooks so hook order stays stable.
  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!isAdmin) return <Redirect href="/(tabs)/home" />;

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setRoleKey('');
  };

  const onInvite = async () => {
    if (!firstName.trim() || !email.trim() || !roleKey) return;
    setSaving(true);
    try {
      await createTeamMember({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        roleKey: Number(roleKey),
      });
      setSheetOpen(false);
      resetForm();
      reload();
    } catch {
      Alert.alert(t('usr.addFailTitle'), t('usr.addFailBody'));
    } finally {
      setSaving(false);
    }
  };

  const onRemove = (userId: number, name: string) => {
    Alert.alert(t('usr.removeTitle'), t('usr.removeBody', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('usr.removeBtn'),
        style: 'destructive',
        onPress: async () => {
          await deleteTeamMember(userId).catch(() => {});
          reload();
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('profile.row.teamManagement')} subtitle={t('usr.subtitle', { count: members.length })} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {sheetOpen ? (
          <Card style={{ marginBottom: spacing.md, gap: 0 }}>
            <AppText variant="title" style={{ marginBottom: spacing.md }}>
              {t('usr.inviteTitle')}
            </AppText>
            <TextField label={t('usr.firstName')} required value={firstName} onChangeText={setFirstName} placeholder="Jane" />
            <TextField label={t('usr.lastName')} value={lastName} onChangeText={setLastName} placeholder="Doe" />
            <TextField label={t('usr.email')} required value={email} onChangeText={setEmail} placeholder="jane@ngaren.com" />
            <PickerField
              label={t('settings.row.role')}
              required
              value={roleKey}
              placeholder={t('usr.rolePlaceholder')}
              options={roleOptions}
              onSelect={setRoleKey}
            />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Button
                label={t('common.cancel')}
                variant="outline"
                onPress={() => {
                  setSheetOpen(false);
                  resetForm();
                }}
                style={{ flex: 1 }}
              />
              <Button
                label={t('usr.sendInvite')}
                loading={saving}
                disabled={!firstName.trim() || !email.trim() || !roleKey}
                onPress={onInvite}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        ) : (
          <Button
            label={t('usr.inviteBtn')}
            icon="account-plus-outline"
            onPress={() => setSheetOpen(true)}
            style={{ marginBottom: spacing.md }}
          />
        )}

        {members.map((m) => {
          const name = `${m.firstName} ${m.lastName}`.trim();
          return (
            <View
              key={m.userId}
              style={[
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.mdMinus,
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                  borderWidth: 1,
                  borderColor: colors.divider,
                },
                shadow[1],
              ]}>
              <IconChip icon="account" />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                  {name || m.email}
                </AppText>
                <AppText variant="caption" color={colors.onSurfaceVariant}>
                  {m.email}
                </AppText>
              </View>
              <ActionChip label={m.role} variant={roleVariant(m.role)} />
              <Pressable onPress={() => onRemove(m.userId, name || m.email)} hitSlop={8} style={{ padding: spacing.xs }}>
                <Icon name="trash-can-outline" size={20} color={colors.error} />
              </Pressable>
            </View>
          );
        })}
      </Screen>
    </View>
  );
}
