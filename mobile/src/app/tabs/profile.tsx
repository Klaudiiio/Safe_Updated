import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { User, Mail, Shield, LogOut } from 'lucide-react-native';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>User Profile</Text>

      <View style={styles.card}>
        <View style={styles.avatarContainer}>
          <User size={40} color="#FFFFFF" />
        </View>

        <View style={styles.infoRow}>
          <User size={18} color="#9CA3AF" />
          <Text style={styles.infoText}>
            Username: <Text style={styles.infoValue}>{user?.username || 'N/A'}</Text>
          </Text>
        </View>    

        <View style={styles.infoRow}>
          <Mail size={18} color="#9CA3AF" />
          <Text style={styles.infoText}>
            Email: <Text style={styles.infoValue}>{user?.email || 'N/A'}</Text>
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Shield size={18} color="#9CA3AF" />
          <Text style={styles.infoText}>
            Role: <Text style={styles.infoValue}>Administrator / Student</Text>
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <LogOut size={18} color="#FFFFFF" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080a0f', padding: 20, paddingTop: 60 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 20 },
  card: { backgroundColor: '#0F1825', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#1F2937', alignItems: 'center', marginBottom: 24 },
  avatarContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 12, marginBottom: 14 },
  infoText: { color: '#9CA3AF', fontSize: 14 },
  infoValue: { color: '#FFFFFF', fontWeight: '600' },
  signOutButton: { flexDirection: 'row', backgroundColor: '#ef4444', padding: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 8 },
  signOutText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
});