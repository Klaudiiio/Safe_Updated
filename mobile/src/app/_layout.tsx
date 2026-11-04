import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../auth/AuthContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

function AppNavigator() {
  const { user, loading } = useAuth();
  const { isDark } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  const backgroundColor = isDark ? '#060913' : '#f8fafc';

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
      <View style={[styles.loading, { backgroundColor }]}>
        <ActivityIndicator color="#ef4444" size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor } }}>
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
    justifyContent: 'center', // Fixed from justify-content to justifyContent
  },
});