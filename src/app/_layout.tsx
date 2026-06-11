import { useEffect } from 'react';
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
import { addNotificationResponseListener } from '@/services/push';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Deep-link taps on push notifications into the right screen.
  useEffect(() => addNotificationResponseListener(), []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F7F7F7' } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="login" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="signup-success" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="find-vet/index" />
          <Stack.Screen name="find-vet/request" />
          <Stack.Screen name="register-animal" />
          <Stack.Screen name="animals/[id]" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="notification-settings" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
