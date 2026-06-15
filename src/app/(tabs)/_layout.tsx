
import { Redirect, Tabs } from 'expo-router';
import { ColorValue, Platform } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, font, layout } from '@/theme';
import { useAuth } from '@/services/auth';

type Mdi = keyof typeof MaterialCommunityIcons.glyphMap;

const tab = (name: Mdi) =>
  ({ color, size }: { color: ColorValue; size: number }) =>
    <MaterialCommunityIcons name={name} size={size} color={color as string} />;

export default function TabsLayout() {
  const { isAuthenticated, role, loading } = useAuth();

  // Wait for the persisted session to restore before redirecting, otherwise a
  // returning user briefly flashes the login screen on launch.
  if (loading) return null;
  // Farmer area: require a signed-in farmer. Vets get sent to their dashboard.
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (role === 'vet') return <Redirect href="/vet" />;

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarStyle: {
          height: layout.bottomNavHeight,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 24 : 12,
          backgroundColor: colors.surface,
          borderTopColor: colors.divider,
        },
        tabBarLabelStyle: { fontSize: 11, fontFamily: font.medium },
      }}>
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: tab('home-variant') }} />
      <Tabs.Screen name="animals" options={{ title: 'Animals', tabBarIcon: tab('cow') }} />
      <Tabs.Screen name="track" options={{ title: 'Track', tabBarIcon: tab('map-marker-radius') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tab('account') }} />
    </Tabs>
  );
}
