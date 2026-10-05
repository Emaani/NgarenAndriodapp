import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { colors, radius, shadow, spacing } from '@/theme';
import { useT } from '@/i18n';
import { AppText, GradientHeader, Icon, IconName, Screen } from '@/ui';

// q/a and label hold i18n keys (value is contact data), translated at render.
type Faq = { q: string; a: string };
type Contact = { icon: IconName; label: string; value: string; url: string; tint: string };

const FAQS: Faq[] = [
  { q: 'help.q1', a: 'help.a1' },
  { q: 'help.q2', a: 'help.a2' },
  { q: 'help.q3', a: 'help.a3' },
  { q: 'help.q4', a: 'help.a4' },
  { q: 'help.q5', a: 'help.a5' },
];

const CONTACTS: Contact[] = [
  { icon: 'email-outline', label: 'help.emailUs', value: 'support@ngaren.com', url: 'mailto:support@ngaren.com', tint: '#2563EB' },
  { icon: 'phone-outline', label: 'help.callSupport', value: '+254 700 000 000', url: 'tel:+254700000000', tint: '#16A34A' },
  { icon: 'whatsapp', label: 'help.whatsapp', value: 'help.chatWithUs', url: 'https://wa.me/254700000000', tint: '#21C45D' },
];

function FaqItem({ faq, open, onToggle, last }: { faq: Faq; open: boolean; onToggle: () => void; last?: boolean }) {
  const t = useT();
  return (
    <View style={{ borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.divider }}>
      <Pressable
        onPress={onToggle}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
        <AppText variant="bodyLarge" style={{ flex: 1, fontWeight: '600' }}>
          {t(faq.q)}
        </AppText>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={22} color={colors.onSurfaceVariant} />
      </Pressable>
      {open && (
        <AppText variant="body" color={colors.onSurfaceVariant} style={{ paddingBottom: spacing.md }}>
          {t(faq.a)}
        </AppText>
      )}
    </View>
  );
}

export default function Help() {
  const t = useT();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const open = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('profile.row.helpSupport')} subtitle={t('help.subtitle')} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <View style={{ marginBottom: spacing.lg }}>
          <AppText
            variant="caption"
            color={colors.onSurfaceVariant}
            style={{ marginBottom: spacing.sm, textTransform: 'uppercase' }}>
            {t('help.faq')}
          </AppText>
          <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md }, shadow[1]]}>
            {FAQS.map((faq, i) => (
              <FaqItem
                key={faq.q}
                faq={faq}
                open={openIndex === i}
                onToggle={() => setOpenIndex((prev) => (prev === i ? null : i))}
                last={i === FAQS.length - 1}
              />
            ))}
          </View>
        </View>

        <View>
          <AppText
            variant="caption"
            color={colors.onSurfaceVariant}
            style={{ marginBottom: spacing.sm, textTransform: 'uppercase' }}>
            {t('help.contact')}
          </AppText>
          <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md }, shadow[1]]}>
            {CONTACTS.map((c, i) => (
              <Pressable
                key={c.label}
                onPress={() => open(c.url)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingVertical: spacing.md,
                  borderBottomWidth: i === CONTACTS.length - 1 ? 0 : 1,
                  borderBottomColor: colors.divider,
                }}>
                <Icon name={c.icon} size={22} color={c.tint} />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                    {t(c.label)}
                  </AppText>
                  <AppText variant="body" color={colors.onSurfaceVariant}>
                    {t(c.value)}
                  </AppText>
                </View>
                <Icon name="chevron-right" size={22} color={colors.onSurfaceVariant} />
              </Pressable>
            ))}
          </View>
        </View>
      </Screen>
    </View>
  );
}
