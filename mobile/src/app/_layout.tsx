import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../auth/AuthContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

function AppNavigator() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inTabsGroup = segments[0] === 'tabs';

    if (!user && inTabsGroup) {
      router.replace('/');
    } else if (user && !inTabsGroup) {
      router.replace('/tabs');
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <LinearGradient
        colors={['#151130', '#1a153b', '#231e4d']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.loading}
      >
        <ActivityIndicator color="#818cf8" size="large" />
      </LinearGradient>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#151130' },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: '#151130' },
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="tabs" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppNavigator />
      </ThemeProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});