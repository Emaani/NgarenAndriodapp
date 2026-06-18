import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { colors, radius, shadow, spacing } from '@/theme';
import { AppText, GradientHeader, Icon, IconName, Screen } from '@/ui';

type Faq = { q: string; a: string };
type Contact = { icon: IconName; label: string; value: string; url: string; tint: string };

const FAQS: Faq[] = [
  {
    q: 'How do I register a new animal?',
    a: 'Open Home → Register Animal, fill in the tag, breed and location, then optionally link a Ceres Tag device. The animal appears in your herd immediately.',
  },
  {
    q: 'Why is a device showing as “Not linked”?',
    a: 'A device is unlinked until you attach it to an animal. Open My Devices, tap the device, and register or pick the animal it belongs to.',
  },
  {
    q: 'How do boundary alerts work?',
    a: 'When an animal leaves its assigned location, you get a Boundary Check notification. Manage how you’re alerted (Email / SMS) under Notification Preferences.',
  },
  {
    q: 'How do I request a vet call-out?',
    a: 'Use Find a Vet from Home, choose a vet (or let one be assigned), pick the animal and urgency, and submit. You can rate the vet after the visit.',
  },
  {
    q: 'What does Stock Take do?',
    a: 'Stock Take walks you through your herd so you can mark each animal present or missing, giving you a quick reconciliation and a list of any animals to follow up on.',
  },
];

const CONTACTS: Contact[] = [
  { icon: 'email-outline', label: 'Email us', value: 'support@ngaren.com', url: 'mailto:support@ngaren.com', tint: '#2563EB' },
  { icon: 'phone-outline', label: 'Call support', value: '+254 700 000 000', url: 'tel:+254700000000', tint: '#16A34A' },
  { icon: 'whatsapp', label: 'WhatsApp', value: 'Chat with us', url: 'https://wa.me/254700000000', tint: '#21C45D' },
];

function FaqItem({ faq, open, onToggle, last }: { faq: Faq; open: boolean; onToggle: () => void; last?: boolean }) {
  return (
    <View style={{ borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.divider }}>
      <Pressable
        onPress={onToggle}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
        <AppText variant="bodyLarge" style={{ flex: 1, fontWeight: '600' }}>
          {faq.q}
        </AppText>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={22} color={colors.onSurfaceVariant} />
      </Pressable>
      {open && (
        <AppText variant="body" color={colors.onSurfaceVariant} style={{ paddingBottom: spacing.md }}>
          {faq.a}
        </AppText>
      )}
    </View>
  );
}

export default function Help() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const open = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Help & Support" subtitle="Answers and ways to reach us" showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <View style={{ marginBottom: spacing.lg }}>
          <AppText
            variant="caption"
            color={colors.onSurfaceVariant}
            style={{ marginBottom: spacing.sm, textTransform: 'uppercase' }}>
            Frequently asked
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
            Contact us
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
                    {c.label}
                  </AppText>
                  <AppText variant="body" color={colors.onSurfaceVariant}>
                    {c.value}
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
