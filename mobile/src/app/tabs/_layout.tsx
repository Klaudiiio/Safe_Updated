import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Home, History, User, Sun, Moon, ShieldCheck } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

export default function TabLayout() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: isDark ? '#060913' : '#ffffff',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: isDark ? '#1e293b' : '#e2e8f0',
        },
        // SAFE Logo and Title on the Header Left
        headerLeft: () => (
          <View style={styles.headerLeftContainer}>
            <View style={[styles.logoCircle, { backgroundColor: isDark ? '#0f172a' : '#f1f5f9', borderColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
              <ShieldCheck size={20} color="#3b82f6" />
            </View>
            <View>
              <View style={styles.brandRow}>
                <Text style={[styles.brandTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>SAFE</Text>
                <View style={styles.onlinePill}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.onlineText}>Online</Text>
                </View>
              </View>
              <Text style={styles.brandSubtitle}>Campus Emergency Network</Text>
            </View>
          </View>
        ),
        headerTitle: '', // Cleared standard title to prioritize the brand header
        // Sun/Moon Theme Button on the Header Right
        headerRight: () => (
          <TouchableOpacity
            style={[
              styles.headerThemeBtn,
              {
                backgroundColor: isDark ? '#0f172a' : '#f1f5f9',
                borderColor: isDark ? '#1e293b' : '#e2e8f0',
              },
            ]}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            {isDark ? (
              <Sun size={18} color="#f59e0b" />
            ) : (
              <Moon size={18} color="#3b82f6" />
            )}
          </TouchableOpacity>
        ),
        tabBarStyle: {
          backgroundColor: isDark ? '#060913' : '#ffffff',
          borderTopColor: isDark ? '#1e293b' : '#e2e8f0',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: isDark ? '#64748b' : '#94a3b8',
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
          headerShown: false, // Hidden header for History tab
          tabBarIcon: ({ color, size }) => <History size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerShown: false, // Hidden header for Profile tab
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
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
    color: '#64748b',
    fontSize: 10,
    fontWeight: '500',
  },
  headerThemeBtn: {
    marginRight: 16,
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});