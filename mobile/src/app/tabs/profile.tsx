import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { User, ShieldCheck, BookOpen, LogOut } from 'lucide-react-native';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { isDark } = useTheme();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await signOut();
    } catch (error) {
      Alert.alert('Sign Out Error', 'Could not clear your session. Please try again.');
      setSigningOut(false);
    }
  };

  const dynamicStyles = {
    container: { backgroundColor: isDark ? '#060913' : '#f8fafc' },
    card: { backgroundColor: isDark ? '#0f172a' : '#ffffff', borderColor: isDark ? '#1e293b' : '#e2e8f0' },
    textMain: { color: isDark ? '#ffffff' : '#0f172a' },
    textSub: { color: isDark ? '#94a3b8' : '#64748b' },
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, dynamicStyles.container]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, dynamicStyles.textMain]}>User Profile</Text>
          <Text style={[styles.subtitle, dynamicStyles.textSub]}>Account settings & details</Text>
        </View>
      </View>

      <View style={[styles.profileCard, dynamicStyles.card]}>
        <View style={styles.avatarBox}>
          <User size={32} color="#3b82f6" />
        </View>
        <Text style={[styles.userName, dynamicStyles.textMain]}>{user?.username || 'User Profile'}</Text>
        <Text style={styles.userRole}>Standard User / Student</Text>
      </View>

      <View style={[styles.sectionCard, dynamicStyles.card]}>
        <View style={styles.infoRow}>
          <ShieldCheck size={16} color="#38bdf8" />
          <Text style={[styles.infoLabel, dynamicStyles.textSub]}>Username:</Text>
          <Text style={[styles.infoValue, dynamicStyles.textMain]}>{user?.username || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <BookOpen size={16} color="#38bdf8" />
          <Text style={[styles.infoLabel, dynamicStyles.textSub]}>Role / Status:</Text>
          <Text style={[styles.infoValue, dynamicStyles.textMain]}>Active Member</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.signOutButton, signingOut && { opacity: 0.7 }]}
        onPress={handleSignOut}
        disabled={signingOut}
      >
        {signingOut ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <>
            <LogOut size={16} color="#ffffff" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 40, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 'bold' },
  subtitle: { fontSize: 12, marginTop: 2 },
  profileCard: { borderWidth: 1, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16 },
  avatarBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#3b82f620', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  userName: { fontSize: 18, fontWeight: 'bold' },
  userRole: { color: '#3b82f6', fontSize: 12, fontWeight: '600', marginTop: 2 },
  sectionCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 14, marginBottom: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoLabel: { fontSize: 13, width: 90 },
  infoValue: { fontSize: 13, fontWeight: '600', flex: 1 },
  signOutButton: { backgroundColor: '#ef4444', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, gap: 8 },
  signOutText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
});