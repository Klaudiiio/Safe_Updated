import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { User, ShieldCheck, BookOpen, LogOut, Edit3, X, Phone, Check, Mail } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../auth/AuthContext';

export default function ProfileScreen() {
  const { user, signOut, updateProfile, refreshProfile } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  // Editable profile state initialized empty
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [studentId, setStudentId] = useState('');
  const [course, setCourse] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch fresh profile details once on mount
  useEffect(() => {
    refreshProfile?.().catch(() => {});
  }, [refreshProfile]);

  // Initialize input fields ONLY when the edit modal opens, preventing text-reset loops while typing
  useEffect(() => {
    if (isEditing && user) {
      setName(user.name || user.username || '');
      setUsername(user.username || '');
      setEmail(user.email || '');
      setStudentId(user.student_id || '');
      setCourse(user.course || '');
      setPhoneNumber(user.phone_number || '');
    }
  }, [isEditing, user]);

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await signOut();
    } catch (error) {
      Alert.alert('Sign Out Error', 'Could not clear your session. Please try again.');
      setSigningOut(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!name.trim() || !username.trim()) {
      Alert.alert('Validation Error', 'Name and username cannot be empty.');
      return;
    }

    const trimmedEmail = email.trim();
    if (trimmedEmail && !trimmedEmail.includes('@')) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }

    setSaving(true);
    try {
      const response = await updateProfile({
        name: name.trim(),
        username: username.trim(),
        email: trimmedEmail,
        student_id: studentId.trim(),
        course: course.trim(),
        phone_number: phoneNumber.trim(),
      });

      setSaving(false);
      setIsEditing(false);

      if (response && response.supabase_synced === false) {
        Alert.alert(
          'Updated with Warning',
          `Profile updated in Django, but Supabase sync failed: ${response.sync_warning || 'Check backend configuration or logs.'}`
        );
      } else {
        Alert.alert('Success', 'Profile credentials updated and synchronized successfully across Django and Supabase!');
      }
    } catch (err) {
      setSaving(false);
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update credentials. Please try again.');
    }
  };

  return (
    <LinearGradient
      colors={['#F0F6FF', '#E0F2FE', '#BAE6FD']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>User Profile</Text>
            <Text style={styles.subtitle}>Account settings & details</Text>
          </View>
        </View>

        {/* Clickable Profile Avatar & Card */}
        <TouchableOpacity
          style={styles.profileCard}
          activeOpacity={0.9}
          onPress={() => setIsEditing(true)}
        >
          <View style={styles.avatarBox}>
            <User size={36} color="#0284C7" />
            <View style={styles.editBadge}>
              <Edit3 size={12} color="#ffffff" />
            </View>
          </View>
          <Text style={styles.userName}>{user?.name || 'Student User'}</Text>
          <Text style={styles.userRole}>
            @{user?.username || 'student'} • {user?.role ? user.role.toUpperCase() : 'Student'}
          </Text>
          <Text style={styles.tapToEditText}>Tap avatar or card to edit credentials</Text>
        </TouchableOpacity>

        {/* Details Card */}
        <View style={styles.sectionCard}>
          <View style={styles.infoRow}>
            <ShieldCheck size={18} color="#0284C7" />
            <Text style={styles.infoLabel}>Username:</Text>
            <Text style={styles.infoValue}>{user?.username || 'Not specified'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Mail size={18} color="#0284C7" />
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{user?.email || 'Not specified'}</Text>
          </View>
          <View style={styles.infoRow}>
            <BookOpen size={18} color="#0284C7" />
            <Text style={styles.infoLabel}>Student ID:</Text>
            <Text style={styles.infoValue}>{user?.student_id || 'Not specified'}</Text>
          </View>
          <View style={styles.infoRow}>
            <BookOpen size={18} color="#0284C7" />
            <Text style={styles.infoLabel}>Course:</Text>
            <Text style={styles.infoValue}>{user?.course || 'Not specified'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Phone size={18} color="#0284C7" />
            <Text style={styles.infoLabel}>Phone:</Text>
            <Text style={styles.infoValue}>{user?.phone_number || 'Not specified'}</Text>
          </View>
        </View>

        {/* Edit Button */}
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => setIsEditing(true)}
        >
          <Edit3 size={16} color="#0284C7" />
          <Text style={styles.editButtonText}>Edit Credentials</Text>
        </TouchableOpacity>

        {/* Sign Out Button */}
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

        {/* Edit Credentials Modal */}
        <Modal
          visible={isEditing}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsEditing(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Profile Credentials</Text>
                <TouchableOpacity onPress={() => setIsEditing(false)}>
                  <X size={20} color="#1E293B" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
              >
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <TextInput
                    style={styles.textInput}
                    value={name}
                    onChangeText={setName}
                    placeholder="Enter full name"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Username</Text>
                  <TextInput
                    style={styles.textInput}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    placeholder="Enter username"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <TextInput
                    style={styles.textInput}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="Enter email address"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Student / Staff ID</Text>
                  <TextInput
                    style={styles.textInput}
                    value={studentId}
                    onChangeText={setStudentId}
                    placeholder="Enter ID number"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Course / Department</Text>
                  <TextInput
                    style={styles.textInput}
                    value={course}
                    onChangeText={setCourse}
                    placeholder="Enter course"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Phone Number</Text>
                  <TextInput
                    style={styles.textInput}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                    placeholder="Enter phone number"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSaveChanges}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Check size={16} color="#FFFFFF" />
                      <Text style={styles.saveButtonText}>Save Changes</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 30, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
  subtitle: { fontSize: 13, marginTop: 2, color: '#64748B' },
 
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#BAE6FD',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F0F6FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0284C7',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userName: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  userRole: { color: '#0284C7', fontSize: 13, fontWeight: '600', marginTop: 2 },
  tapToEditText: { color: '#64748B', fontSize: 11, marginTop: 6, fontStyle: 'italic' },

  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 16,
    padding: 18,
    gap: 14,
    marginBottom: 16,
    shadowColor: '#BAE6FD',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  infoLabel: { fontSize: 13, width: 95, color: '#64748B', fontWeight: '600' },
  infoValue: { fontSize: 14, fontWeight: '700', flex: 1, color: '#1E293B' },

  editButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 14,
    gap: 8,
    marginBottom: 12,
    shadowColor: '#BAE6FD',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  },
  editButtonText: { color: '#0284C7', fontSize: 15, fontWeight: '700' },

  signOutButton: {
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 14,
    gap: 8,
    shadowColor: '#EF4444',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  signOutText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#BAE6FD',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1E293B',
  },
  saveButton: {
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    marginBottom: 20,
    shadowColor: '#0284C7',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});