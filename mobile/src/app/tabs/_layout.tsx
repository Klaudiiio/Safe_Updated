import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Home, History, User, ShieldCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        // Header Background Gradient & Border Accent
        headerBackground: () => (
          <LinearGradient
            colors={['#151130', '#1a153b', '#231e4d']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[StyleSheet.absoluteFill, styles.headerBorder]}
          />
        ),
        headerTintColor: '#ffffff',
        // SAFE Logo and Title on the Header Left
        headerLeft: () => (
          <View style={styles.headerLeftContainer}>
            <View style={styles.logoCircle}>
              <ShieldCheck size={20} color="#818cf8" />
            </View>
            <View>
              <View style={styles.brandRow}>
                <Text style={styles.brandTitle}>SAFE</Text>
                <View style={styles.onlinePill}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.onlineText}>Online</Text>
                </View>
              </View>
              <Text style={styles.brandSubtitle}>Campus Emergency Network</Text>
            </View>
          </View>
        ),
        headerTitle: '',
        // Footer Tab Bar Styling with Gradient and Border
        tabBarBackground: () => (
          <LinearGradient
            colors={['#151130', '#1a153b', '#231e4d']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[StyleSheet.absoluteFill, styles.tabBarBorder]}
          />
        ),
        tabBarStyle: {
          position: 'absolute',
          borderTopWidth: 1,
          borderTopColor: 'rgba(10, 5, 29, 0.6)', // border-indigo-950/60
          height: 62,
          paddingBottom: 8,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarActiveTintColor: '#818cf8',
        tabBarInactiveTintColor: '#64748b',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <History size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(10, 5, 29, 0.6)', // border-indigo-950/60
  },
  tabBarBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(10, 5, 29, 0.6)', // border-indigo-950/60
  },
  headerLeftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
    gap: 10,
  },
  logoCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(10, 5, 29, 0.6)',
    backgroundColor: '#1a153b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: '#ffffff',
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b98120',
    borderColor: '#10b98140',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    gap: 3,
  },
  onlineDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10b981',
  },
  onlineText: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: 'bold',
  },
  brandSubtitle: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '500',
  },
});