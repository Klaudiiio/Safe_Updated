import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:8000').replace(/\/+$/, '');

export default function SignInScreen() {
  const { user, storageError, signIn, signUp } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
 
  const [resetStep, setResetStep] = useState<'request' | 'verify-otp' | 'reset-password'>('request');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(storageError);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [course, setCourse] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Email-only recovery state
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

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
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async () => {
    setError(null);
    setSuccessMsg(null);
    if (!recoveryEmail.trim() || !recoveryEmail.includes('@')) {
      setError('Please enter a valid Gmail address.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/password-reset/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'email',
          target: recoveryEmail.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as any).detail || `Server error: ${response.status}`);
      }

      setSuccessMsg(`Verification OTP sent to Gmail: ${recoveryEmail.trim()}`);
      setResetStep('verify-otp');
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Failed to connect to server. Check your network configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError(null);
    setSuccessMsg(null);
    if (!otpCode.trim() || otpCode.length < 4) {
      setError('Please enter a valid OTP code.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: recoveryEmail.trim(),
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
      const response = await fetch(`${API_BASE_URL}/api/auth/confirm-password-reset/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: recoveryEmail.trim(),
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
        setRecoveryEmail('');
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
        <View style={styles.card}>
          <View style={styles.shieldIconContainer}>
            <Ionicons name="shield-outline" size={26} color="#6366f1" />
          </View>

          <Text style={styles.title}>
            {isForgotPassword
              ? 'Reset password'
              : isRegistering
              ? 'Create account'
              : 'SAFE Student Portal'}
          </Text>
          <Text style={styles.subtitle}>
            {isForgotPassword
              ? 'Recover your account securely'
              : isRegistering
              ? 'Register with your school details'
              : 'Sign in to access student safety tools'}
          </Text>

          {isForgotPassword ? (
            <View style={styles.innerForm}>
              {resetStep === 'request' && (
                <DarkField
                  label="GMAIL ADDRESS"
                  icon="mail-outline"
                  value={recoveryEmail}
                  onChangeText={setRecoveryEmail}
                  placeholder="name@gmail.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              )}

              {resetStep === 'verify-otp' && (
                <DarkField
                  label="VERIFICATION OTP"
                  icon="key-outline"
                  value={otpCode}
                  onChangeText={setOtpCode}
                  placeholder="Enter 6-digit OTP"
                  keyboardType="number-pad"
                  autoCapitalize="none"
                />
              )}

              {resetStep === 'reset-password' && (
                <>
                  <DarkField
                    label="NEW PASSWORD"
                    icon="lock-closed-outline"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="At least 6 characters"
                    secureTextEntry
                  />
                  <DarkField
                    label="CONFIRM NEW PASSWORD"
                    icon="lock-closed-outline"
                    value={confirmNewPassword}
                    onChangeText={setConfirmNewPassword}
                    placeholder="Re-enter new password"
                    secureTextEntry
                  />
                </>
              )}

              {error && <Text style={styles.errorBanner}>{error}</Text>}
              {successMsg && <Text style={styles.successBanner}>{successMsg}</Text>}

              <TouchableOpacity
                style={styles.primaryButton}
                disabled={loading}
                onPress={() => {
                  if (resetStep === 'request') void handleRequestOtp();
                  else if (resetStep === 'verify-otp') void handleVerifyOtp();
                  else if (resetStep === 'reset-password') void handleUpdatePassword();
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {resetStep === 'request' ? 'Send OTP Code' : resetStep === 'verify-otp' ? 'Verify Code' : 'Update Password'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setIsForgotPassword(false);
                  setResetStep('request');
                  setError(null);
                  setSuccessMsg(null);
                  setRecoveryEmail('');
                  setOtpCode('');
                  setNewPassword('');
                  setConfirmNewPassword('');
                }}
              >
                <Text style={styles.secondaryButtonText}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.innerForm}>
              {isRegistering && (
                <>
                  <DarkField label="FULL NAME" icon="person-outline" value={name} onChangeText={setName} placeholder="Your full name" />
                  <DarkField
                    label="GMAIL / EMAIL"
                    icon="mail-outline"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="name@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </>
              )}

              <DarkField
                label="USERNAME"
                icon="person-circle-outline"
                value={username}
                onChangeText={setUsername}
                placeholder="Enter your username"
                autoCapitalize="none"
                autoComplete="username"
              />

              <View style={styles.fieldContainer}>
                <Text style={styles.label}>PASSWORD</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={18} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter your password"
                    placeholderTextColor="#475569"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete={isRegistering ? 'new-password' : 'current-password'}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color="#64748b"
                    />
                  </TouchableOpacity>
                </View>
                {!isRegistering && (
                  <TouchableOpacity
                    style={styles.forgotPasswordContainer}
                    onPress={() => {
                      setIsForgotPassword(true);
                      setResetStep('request');
                      setError(null);
                      setSuccessMsg(null);
                    }}
                  >
                    <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                  </TouchableOpacity>
                )}
              </View>

              {isRegistering && (
                <>
                  <DarkField label="STUDENT / STAFF ID (OPTIONAL)" icon="id-card-outline" value={studentId} onChangeText={setStudentId} placeholder="ID number" />
                  <DarkField label="COURSE / DEPARTMENT (OPTIONAL)" icon="book-outline" value={course} onChangeText={setCourse} placeholder="Course" />
                  <DarkField label="PHONE NUMBER (OPTIONAL)" icon="call-outline" value={phoneNumber} onChangeText={setPhoneNumber} placeholder="+63 9..." keyboardType="phone-pad" />
                </>
              )}

              {(error ?? storageError) && (
                <View style={styles.errorBannerContainer}>
                  <Text style={styles.errorText}>{error ?? storageError}</Text>
                </View>
              )}

              {successMsg && (
                <View style={styles.successBannerContainer}>
                  <Text style={styles.successText}>{successMsg}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryButton, (!canSubmit && isRegistering) && { opacity: 0.6 }]}
                disabled={loading}
                onPress={() => void submit()}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {isRegistering ? 'Create Account' : 'Sign in to Student Portal'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setError(null);
                  setSuccessMsg(null);
                  setIsRegistering((current) => !current);
                }}
              >
                <Text style={styles.secondaryButtonText}>
                  {isRegistering ? 'Already registered? Sign in' : "Don't have an account? Sign up"}
                </Text>
              </TouchableOpacity>

              <Text style={styles.footerNote}>Authorized student & staff access only.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

interface DarkFieldProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (val: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: 'username' | 'current-password' | 'new-password';
}

function DarkField({ label, icon, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize }: DarkFieldProps) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>
        <Ionicons name={icon} size={18} color="#64748b" style={styles.inputIcon} />
        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#475569"
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? 'none'}
          autoCorrect={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#080b11' },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: {
    width: '100%', maxWidth: 440, backgroundColor: '#101420',
    borderRadius: 24, borderWidth: 1, borderColor: '#1d263a',
    padding: 28, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.6, shadowRadius: 24, elevation: 12,
  },
  shieldIconContainer: {
    width: 58, height: 58, borderRadius: 16, backgroundColor: '#172033',
    borderWidth: 1, borderColor: '#293753', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: '900', color: '#ffffff', marginBottom: 6, textAlign: 'center', letterSpacing: 0.3 },
  subtitle: { fontSize: 13, color: '#94a3b8', marginBottom: 24, textAlign: 'center', fontWeight: '500' },
  innerForm: { width: '100%' },
  fieldContainer: { width: '100%', marginBottom: 16 },
  label: { fontSize: 11, fontWeight: '800', color: '#94a3b8', marginBottom: 8, letterSpacing: 1.2 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#151b2a',
    borderRadius: 14, borderWidth: 1, borderColor: '#222f48', height: 52, paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  textInput: { flex: 1, color: '#ffffff', fontSize: 15 },
  eyeButton: { padding: 6 },
  forgotPasswordContainer: { alignSelf: 'flex-end', marginTop: 8 },
  forgotPasswordText: { color: '#818cf8', fontSize: 13, fontWeight: '600' },
  primaryButton: {
    width: '100%', height: 52, borderRadius: 14, backgroundColor: '#6366f1',
    alignItems: 'center', justifyContent: 'center', marginTop: 10, marginBottom: 16,
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 10, elevation: 8,
  },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  secondaryButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8, marginBottom: 10 },
  secondaryButtonText: { color: '#818cf8', fontSize: 14, fontWeight: '600' },
  footerNote: { color: '#64748b', fontSize: 12, textAlign: 'center', fontWeight: '500', marginTop: 4 },
  errorBannerContainer: {
    width: '100%', backgroundColor: '#261219', borderWidth: 1, borderColor: '#7f1d1d',
    borderRadius: 12, padding: 14, marginBottom: 16,
  },
  errorBanner: { color: '#fca5a5', fontSize: 13, lineHeight: 18, textAlign: 'center', fontWeight: '500', marginBottom: 12 },
  errorText: { color: '#fca5a5', fontSize: 13, lineHeight: 18, textAlign: 'center', fontWeight: '500' },
  successBannerContainer: {
    width: '100%', backgroundColor: '#064e3b', borderWidth: 1, borderColor: '#065f46',
    borderRadius: 12, padding: 14, marginBottom: 16,
  },
  successBanner: { color: '#a7f3d0', fontSize: 13, lineHeight: 18, textAlign: 'center', fontWeight: '500', marginBottom: 12 },
  successText: { color: '#a7f3d0', fontSize: 13, lineHeight: 18, textAlign: 'center', fontWeight: '500' },
});