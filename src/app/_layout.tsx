import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { addNotificationResponseListener, routeColdStartNotification } from '@/services/push';
import { registerBackgroundSyncAsync } from '@/services/backgroundSync';
import { AuthProvider } from '@/services/auth';
import { initSentry, wrapWithSentry } from '@/services/sentry';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { StatusBanner } from '@/ui';

// Initialise crash reporting before the tree mounts (no-op without a DSN).
initSentry();

function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Deep-link taps on push notifications into the right screen.
  useEffect(() => addNotificationResponseListener(), []);
  // Handle the case where a notification tap launched the app from killed
  // (not just backgrounded), which addNotificationResponseListener alone misses.
  useEffect(() => {
    routeColdStartNotification();
  }, []);
  // Periodic Ceres Tag sync while the app is backgrounded (no-op in mock mode
  // or where background tasks aren't supported, e.g. web/simulator).
  useEffect(() => {
    registerBackgroundSyncAsync();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppErrorBoundary>
        <SafeAreaProvider>
          <AuthProvider>
          <StatusBar style="dark" />
          {/* Honest connectivity / stale-data strip above the whole app. */}
          <StatusBanner />
          <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F7F7F7' } }}>
            <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="login" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="signup-success" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="edit-profile" />
          <Stack.Screen name="locations" />
          <Stack.Screen name="devices" />
          <Stack.Screen name="help" />
          <Stack.Screen name="find-vet/index" />
          <Stack.Screen name="find-vet/request" />
          <Stack.Screen name="vet-requests" />
          <Stack.Screen name="register-animal" />
          <Stack.Screen name="animals/[id]" />
          <Stack.Screen name="stock-take" />
          <Stack.Screen name="payments" />
          <Stack.Screen name="rate-vet" />
          <Stack.Screen name="vet" />
          <Stack.Screen name="users" />
          <Stack.Screen name="insights" />
          <Stack.Screen name="alerts" />
          <Stack.Screen name="breeding" />
          <Stack.Screen name="health" />
          <Stack.Screen name="calendar" />
          <Stack.Screen name="incidents" />
          <Stack.Screen name="messaging" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="farmers" />
          <Stack.Screen name="team" />
          <Stack.Screen name="reports" />
          <Stack.Screen name="telemetry" />
          <Stack.Screen name="marketplace" />
          <Stack.Screen name="webhook-monitor" />
          <Stack.Screen name="webhook-monitor/[id]" />
          <Stack.Screen name="linkage-health" />
          <Stack.Screen name="admin-mirror/[farmerId]" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="notification-settings" />
          </Stack>
          </View>
          </AuthProvider>
        </SafeAreaProvider>
      </AppErrorBoundary>
    </GestureHandlerRootView>
  );
}

// Wrap the root so uncaught render/runtime errors reach Sentry (no-op when a
// DSN isn't configured).
export default wrapWithSentry(RootLayout);
