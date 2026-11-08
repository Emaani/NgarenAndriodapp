import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * "Message Ngaren" / "Message the farmer" open real direct messages (Nov 2026):
 * the old compose screen only kept messages on this phone, so they never
 * arrived. It now opens New message on the right group.
 */
export default function ComposeMessage() {
  const { to } = useLocalSearchParams<{ to?: string }>();
  const group = to === 'ngaren' || to === 'farmer' || to === 'vet' ? to : 'all';
  return <Redirect href={`/messaging?to=${group}` as never} />;
}
