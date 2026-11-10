import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';

export default function SignInScreen() {
  const { user, storageError, signIn, signUp } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(storageError);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [course, setCourse] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Clear username and password fields when user signs out (user becomes null)
  useEffect(() => {
    if (!user) {
      setUsername('');
      setPassword('');
    }
  }, [user]);

  if (user) return <Redirect href={"/tabs" as any} />;

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      if (isRegistering) {
        await signUp({
          username: username.trim(),
          email: email.trim(),
          password,
          name: name.trim(),
          student_id: studentId.trim(),
          course: course.trim(),
          phone_number: phoneNumber.trim(),
        });
      } else {
        await signIn(username.trim(), password);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Something went wrong. Please try again.');
      setPassword(''); // Clear password field on failed sign-in/sign-up attempt
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = username.trim().length > 0
    && password.length > 0
    && (!isRegistering || name.trim().length > 0)
    && !loading;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}><Text style={styles.brandIconText}>S</Text></View>
            <View>
              <Text style={styles.eyebrow}>SAFE:MEAS</Text>
              <Text style={styles.brand}>Student Safety</Text>
            </View>
          </View>

          <View style={styles.hero}>
            <Text style={styles.eyebrow}>USER MOBILE APP</Text>
            <Text style={styles.title}>{isRegistering ? 'Create your account' : 'Welcome back'}</Text>
            <Text style={styles.subtitle}>
              {isRegistering
                ? 'Register with your school account details.'
                : 'Sign in to submit reports, share your location, record media, and contact responders.'}
            </Text>
          </View>

          <View style={styles.form}>
            {isRegistering && (
              <>
                <Field label="Full name" value={name} onChangeText={setName} placeholder="Your name" />
                <Field
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </>
            )}
            <Field
              label="Username"
              value={username}
              onChangeText={setUsername}
              placeholder="Your username"
              autoCapitalize="none"
              autoComplete="username"
            />

            {/* Password Field with Eye Toggle Icon */}
            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Your password"
                  placeholderTextColor="#68758b"
                  secureTextEntry={!showPassword}
                  autoComplete={isRegistering ? 'new-password' : 'current-password'}
                  autoCorrect={false}
                  style={styles.passwordInput}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIconContainer}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#91a0b7"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {isRegistering && (
              <>
                <Field label="Student / Staff ID (optional)" value={studentId} onChangeText={setStudentId} placeholder="ID number" />
                <Field label="Course (optional)" value={course} onChangeText={setCourse} placeholder="Course or department" />
                <Field label="Phone number (optional)" value={phoneNumber} onChangeText={setPhoneNumber} placeholder="Phone number" keyboardType="phone-pad" />
                <Text style={styles.helper}>New accounts receive the standard user role. Staff and admin access is assigned by an administrator.</Text>
              </>
            )}

            {(error ?? storageError) && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error ?? storageError}
              </Text>
            )}

            <Pressable
              accessibilityRole="button"
              disabled={!canSubmit}
              onPress={() => void submit()}
              style={({ pressed }: { pressed: boolean }) => [styles.primaryButton, (!canSubmit || pressed) && styles.buttonMuted]}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryButtonText}>{isRegistering ? 'Create account' : 'Sign in'}</Text>}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setError(null);
                setIsRegistering((current) => !current);
              }}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>
                {isRegistering ? 'Already registered? Sign in' : 'New here? Create an account'}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: 'username' | 'current-password' | 'new-password';
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
}

function Field({ label, ...inputProps }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        placeholderTextColor="#68758b"
        style={styles.input}
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#080a0f' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 22 },
  container: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingVertical: 28, gap: 28 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#331417', borderWidth: 1, borderColor: '#653033' },
  brandIconText: { color: '#f87171', fontSize: 24, fontWeight: '800' },
  eyebrow: { color: '#f87171', fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  brand: { color: '#f5f7fb', fontSize: 16, fontWeight: '700', marginTop: 3 },
  hero: { gap: 8 },
  title: { color: '#f5f7fb', fontSize: 30, lineHeight: 36, fontWeight: '800' },
  subtitle: { color: '#a3afc2', fontSize: 15, lineHeight: 22 },
  form: { gap: 16 },
  field: { gap: 7 },
  label: { color: '#cbd5e1', fontWeight: '600', fontSize: 13 },
  input: { minHeight: 50, color: '#fff', backgroundColor: '#111722', borderRadius: 12, borderWidth: 1, borderColor: '#273244', paddingHorizontal: 14, fontSize: 15 },
  passwordContainer: { position: 'relative', justifyContent: 'center' },
  passwordInput: { minHeight: 50, color: '#fff', backgroundColor: '#111722', borderRadius: 12, borderWidth: 1, borderColor: '#273244', paddingHorizontal: 14, paddingRight: 48, fontSize: 15 },
  eyeIconContainer: { position: 'absolute', right: 14, height: '100%', justifyContent: 'center', alignItems: 'center' },
  helper: { color: '#91a0b7', fontSize: 12, lineHeight: 18 },
  error: { color: '#fecaca', backgroundColor: '#3b171a', borderRadius: 10, padding: 12, fontSize: 13, lineHeight: 19, overflow: 'hidden' },
  primaryButton: { minHeight: 52, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#dc2626', marginTop: 4 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  buttonMuted: { opacity: 0.55 },
  secondaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#cbd5e1', fontSize: 14, fontWeight: '600' },
});