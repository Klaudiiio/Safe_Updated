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

// Use EXPO_PUBLIC_API_URL environment variable to prevent network fetch failures on physical devices
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:8000/api/auth';

export default function SignInScreen() {
  const { user, storageError, signIn, signUp } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  
  // Forgot password sub-steps: 'request' | 'verify-otp' | 'reset-password'
  const [resetStep, setResetStep] = useState<'request' | 'verify-otp' | 'reset-password'>('request');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(storageError);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sign in / Sign up fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [course, setCourse] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Forgot password fields
  const [recoveryMethod, setRecoveryMethod] = useState<'email' | 'phone'>('email');
  const [recoveryTarget, setRecoveryTarget] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

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
    setSuccessMsg(null);
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

  // Step 1: Request OTP code via Django backend
  const handleRequestOtp = async () => {
    setError(null);
    setSuccessMsg(null);
    if (!recoveryTarget.trim()) {
      setError(recoveryMethod === 'email' ? 'Please enter your Gmail address.' : 'Please enter your phone number.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/password-reset/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: recoveryMethod,
          target: recoveryTarget.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        // Exposes exact error detail from Django backend (e.g., user not found)
        throw new Error((data as any).detail || `Server error: ${response.status}`);
      }

      setSuccessMsg(
        recoveryMethod === 'email'
          ? `Verification OTP sent to Gmail: ${recoveryTarget.trim()}`
          : `Verification OTP sent via SMS to: ${recoveryTarget.trim()}`
      );
      setResetStep('verify-otp');
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Failed to connect to server. Check your network configuration.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP code
  const handleVerifyOtp = async () => {
    setError(null);
    setSuccessMsg(null);
    if (!otpCode.trim() || otpCode.length < 4) {
      setError('Please enter a valid OTP code.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/password-reset/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: recoveryTarget.trim(),
          otp: otpCode.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as any).detail || 'Invalid or expired OTP code.');
      }

      setSuccessMsg('OTP verified successfully! Please enter your new password.');
      setResetStep('reset-password');
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Update and save new password
  const handleUpdatePassword = async () => {
    setError(null);
    setSuccessMsg(null);
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/confirm-password-reset/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: recoveryTarget.trim(),
          otp: otpCode.trim(),
          new_password: newPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as any).detail || 'Failed to update password.');
      }

      setSuccessMsg('Password updated successfully! You can now sign in.');
      setTimeout(() => {
        setIsForgotPassword(false);
        setResetStep('request');
        setSuccessMsg(null);
        setRecoveryTarget('');
        setOtpCode('');
        setNewPassword('');
        setConfirmNewPassword('');
      }, 2000);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update password.');
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
            <Text style={styles.title}>
              {isForgotPassword
                ? resetStep === 'request'
                  ? 'Reset password'
                  : resetStep === 'verify-otp'
                  ? 'Enter OTP Code'
                  : 'New Password'
                : isRegistering
                ? 'Create your account'
                : 'Welcome back'}
            </Text>
            <Text style={styles.subtitle}>
              {isForgotPassword
                ? resetStep === 'request'
                  ? 'Choose whether to receive a verification code via your Gmail account or your registered phone number.'
                  : resetStep === 'verify-otp'
                  ? `Enter the verification code sent to ${recoveryTarget}`
                  : 'Create and confirm your new secure password.'
                : isRegistering
                ? 'Register with your school account details.'
                : 'Sign in to submit reports, share your location, record media, and contact responders.'}
            </Text>
          </View>

          {/* FORGOT PASSWORD WORKFLOW */}
          {isForgotPassword ? (
            <View style={styles.form}>
              {resetStep === 'request' && (
                <>
                  <View style={styles.recoveryToggleRow}>
                    <TouchableOpacity
                      style={[styles.toggleButton, recoveryMethod === 'email' && styles.toggleButtonActive]}
                      onPress={() => { setRecoveryMethod('email'); setRecoveryTarget(''); setError(null); setSuccessMsg(null); }}
                    >
                      <Ionicons name="mail-outline" size={16} color={recoveryMethod === 'email' ? '#fff' : '#91a0b7'} />
                      <Text style={[styles.toggleButtonText, recoveryMethod === 'email' && styles.toggleButtonTextActive]}>Gmail</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.toggleButton, recoveryMethod === 'phone' && styles.toggleButtonActive]}
                      onPress={() => { setRecoveryMethod('phone'); setRecoveryTarget(''); setError(null); setSuccessMsg(null); }}
                    >
                      <Ionicons name="phone-portrait-outline" size={16} color={recoveryMethod === 'phone' ? '#fff' : '#91a0b7'} />
                      <Text style={[styles.toggleButtonText, recoveryMethod === 'phone' && styles.toggleButtonTextActive]}>Phone Number</Text>
                    </TouchableOpacity>
                  </View>

                  <Field
                    label={recoveryMethod === 'email' ? 'Gmail Address' : 'Phone Number'}
                    value={recoveryTarget}
                    onChangeText={setRecoveryTarget}
                    placeholder={recoveryMethod === 'email' ? 'name@gmail.com' : '+63 912 345 6789'}
                    keyboardType={recoveryMethod === 'email' ? 'email-address' : 'phone-pad'}
                    autoCapitalize="none"
                  />
                </>
              )}

              {resetStep === 'verify-otp' && (
                <Field
                  label="Enter OTP Code"
                  value={otpCode}
                  onChangeText={setOtpCode}
                  placeholder="123456"
                  keyboardType="number-pad"
                  autoCapitalize="none"
                />
              )}

              {resetStep === 'reset-password' && (
                <>
                  <Field
                    label="New Password"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="At least 6 characters"
                    secureTextEntry
                  />
                  <Field
                    label="Confirm New Password"
                    value={confirmNewPassword}
                    onChangeText={setConfirmNewPassword}
                    placeholder="Re-enter new password"
                    secureTextEntry
                  />
                </>
              )}

              {error && (
                <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
              )}

              {successMsg && (
                <Text accessibilityRole="status" style={styles.success}>{successMsg}</Text>
              )}

              <Pressable
                accessibilityRole="button"
                disabled={loading}
                onPress={() => {
                  if (resetStep === 'request') void handleRequestOtp();
                  else if (resetStep === 'verify-otp') void handleVerifyOtp();
                  else if (resetStep === 'reset-password') void handleUpdatePassword();
                }}
                style={({ pressed }: { pressed: boolean }) => [styles.primaryButton, pressed && styles.buttonMuted]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {resetStep === 'request' ? 'Send OTP Code' : resetStep === 'verify-otp' ? 'Verify Code' : 'Update Password'}
                  </Text>
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setIsForgotPassword(false);
                  setResetStep('request');
                  setError(null);
                  setSuccessMsg(null);
                  setRecoveryTarget('');
                  setOtpCode('');
                }}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Back to Sign In</Text>
              </Pressable>
            </View>
          ) : (
            /* SIGN IN / SIGN UP VIEW */
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

              {/* Password Field with Eye Toggle Icon & Forgot Password Link */}
              <View style={styles.field}>
                <View style={styles.passwordHeaderRow}>
                  <Text style={styles.label}>Password</Text>
                  {!isRegistering && (
                    <TouchableOpacity
                      onPress={() => {
                        setIsForgotPassword(true);
                        setResetStep('request');
                        setError(null);
                        setSuccessMsg(null);
                      }}
                      accessibilityRole="button"
                    >
                      <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                    </TouchableOpacity>
                  )}
                </View>
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

              {successMsg && (
                <Text accessibilityRole="status" style={styles.success}>
                  {successMsg}
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
                  setSuccessMsg(null);
                  setIsRegistering((current) => !current);
                }}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>
                  {isRegistering ? 'Already registered? Sign in' : 'New here? Create an account'}
                </Text>
              </Pressable>
            </View>
          )}
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
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
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
  passwordHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: '#cbd5e1', fontWeight: '600', fontSize: 13 },
  forgotPasswordText: { color: '#f87171', fontSize: 12, fontWeight: '600' },
  input: { minHeight: 50, color: '#fff', backgroundColor: '#111722', borderRadius: 12, borderWidth: 1, borderColor: '#273244', paddingHorizontal: 14, fontSize: 15 },
  passwordContainer: { position: 'relative', justifyContent: 'center' },
  passwordInput: { minHeight: 50, color: '#fff', backgroundColor: '#111722', borderRadius: 12, borderWidth: 1, borderColor: '#273244', paddingHorizontal: 14, paddingRight: 48, fontSize: 15 },
  eyeIconContainer: { position: 'absolute', right: 14, height: '100%', justifyContent: 'center', alignItems: 'center' },
  recoveryToggleRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  toggleButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, backgroundColor: '#111722', borderWidth: 1, borderColor: '#273244', borderRadius: 10 },
  toggleButtonActive: { backgroundColor: '#3b171a', borderColor: '#f87171' },
  toggleButtonText: { color: '#91a0b7', fontSize: 13, fontWeight: '600' },
  toggleButtonTextActive: { color: '#f87171' },
  helper: { color: '#91a0b7', fontSize: 12, lineHeight: 18 },
  error: { color: '#fecaca', backgroundColor: '#3b171a', borderRadius: 10, padding: 12, fontSize: 13, lineHeight: 19, overflow: 'hidden' },
  success: { color: '#a7f3d0', backgroundColor: '#064e3b', borderRadius: 10, padding: 12, fontSize: 13, lineHeight: 19, overflow: 'hidden' },
  primaryButton: { minHeight: 52, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#dc2626', marginTop: 4 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  buttonMuted: { opacity: 0.55 },
  secondaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#cbd5e1', fontSize: 14, fontWeight: '600' },
});