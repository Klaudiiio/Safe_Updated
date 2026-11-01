import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Pressable,
  PressableStateCallbackType,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';

type Screen = 'home' | 'incidents' | 'notice' | 'complete';
type Severity = 'urgent' | 'minor';
interface SubmittedIncident {
  incidentId: number;
  status: string;
  reportedAt: string | null;
}

interface IncidentType {
  id: string;
  label: string;
  signs: string;
  severity: Severity;
}

const URGENT_INCIDENTS: IncidentType[] = [
  { id: 'cardiac', label: 'Cardiac Arrest / Collapse', signs: 'Unconscious, not breathing normally, no pulse', severity: 'urgent' },
  { id: 'breathing', label: 'Severe Difficulty Breathing', signs: 'Asthma attack, choking, turning blue', severity: 'urgent' },
  { id: 'seizure', label: 'Seizure Lasting >5 Minutes', signs: 'Repeated seizures or not waking up afterward', severity: 'urgent' },
  { id: 'anaphylaxis', label: 'Anaphylaxis (Severe Allergy)', signs: 'Swollen throat, wheezing, collapse after food, sting, or medicine', severity: 'urgent' },
  { id: 'bleeding', label: 'Severe Bleeding', signs: 'Blood soaking clothing or spurting from a wound', severity: 'urgent' },
  { id: 'unconscious', label: 'Unconscious / Unresponsive Student', signs: 'Fainting that does not resolve quickly', severity: 'urgent' },
  { id: 'stroke', label: 'Suspected Stroke', signs: 'Face drooping, arm weakness, speech difficulty', severity: 'urgent' },
  { id: 'headneck', label: 'Major Head or Neck Injury', signs: 'Fall from height, sports collision, possible spinal injury', severity: 'urgent' },
  { id: 'burns', label: 'Severe Burns', signs: 'Electrical burns, large-area burns, facial burns', severity: 'urgent' },
  { id: 'poisoning', label: 'Poisoning / Overdose', signs: 'Ingesting chemicals, medications, or unknown substances', severity: 'urgent' },
];

const MINOR_INCIDENTS: IncidentType[] = [
  { id: 'cuts', label: 'Small Cuts or Abrasions', signs: 'Clean and bandage', severity: 'minor' },
  { id: 'sprain', label: 'Minor Sprain or Strain', signs: 'Rest, ice, compression', severity: 'minor' },
  { id: 'dizziness', label: 'Brief Dizziness', signs: 'Hydration and observation', severity: 'minor' },
  { id: 'fever', label: 'Mild Fever', signs: 'Clinic assessment', severity: 'minor' },
  { id: 'headache', label: 'Headache', signs: 'Rest and evaluation', severity: 'minor' },
  { id: 'stomach', label: 'Stomachache / Nausea', signs: 'Observe and hydrate', severity: 'minor' },
  { id: 'nosebleed', label: 'Nosebleed', signs: 'First aid and monitoring', severity: 'minor' },
  { id: 'rash', label: 'Minor Allergic Rash', signs: 'Monitor for worsening symptoms', severity: 'minor' },
  { id: 'bruise', label: 'Small Bruise', signs: 'Ice pack and rest', severity: 'minor' },
  { id: 'dehydration', label: 'Mild Dehydration', signs: 'Fluids and observation', severity: 'minor' },
];

const URGENT_GUIDANCE = [
  { title: 'Do NOT move the person', detail: 'Unless there is immediate danger. Keep them still and calm.' },
  { title: 'Check breathing and responsiveness', detail: 'If they are unresponsive, ask someone nearby to contact emergency services.' },
  { title: 'Clear the area', detail: 'Give the person space and ask bystanders to step back.' },
  { title: 'Follow professional guidance', detail: 'If you call emergency services, follow their instructions and keep your phone nearby.' },
  { title: 'Contact emergency services', detail: 'This app does not contact responders. Call your local emergency number for immediate help.' },
];

const MINOR_GUIDANCE = [
  { title: 'Contact the school clinic', detail: 'Ask clinic staff for an assessment and follow their guidance.' },
  { title: 'Keep the person comfortable', detail: 'Help them sit or rest in a safe location while waiting.' },
  { title: 'Monitor for changes', detail: 'If the condition worsens, contact emergency services immediately.' },
  { title: 'Notify a teacher or staff member', detail: 'Let a nearby responsible adult know what happened.' },
  { title: 'Get real help directly', detail: 'This app does not notify clinic staff. Contact them directly for assistance.' },
];

export default function ReportScreen() {
  const { user, signOut, submitIncidentReport } = useAuth();
  const [screen, setScreen] = useState<Screen>('home');
  const [category, setCategory] = useState<Severity>('urgent');
  const [selectedIncident, setSelectedIncident] = useState<IncidentType | null>(null);
  const [acceptedNotice, setAcceptedNotice] = useState(false);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [submission, setSubmission] = useState<SubmittedIncident | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [signOutError, setSignOutError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!user) return <Redirect href="/" />;

  const reset = () => {
    setSelectedIncident(null);
    setAcceptedNotice(false);
    setDescription('');
    setLocation('');
    setSubmission(null);
    setSubmitError(null);
    setCategory('urgent');
    setScreen('home');
  };

  const submitReport = async () => {
    if (!selectedIncident || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const result = await submitIncidentReport({
        incident_type: selectedIncident.label,
        description: description.trim(),
        location: location.trim(),
      });
      setSubmission({
        incidentId: result.incident_id,
        status: result.status,
        reportedAt: result.reported_at,
      });
      setScreen('complete');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'The incident report could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  };

  const leave = async () => {
    setSignOutError(null);
    try {
      await signOut();
      router.replace('/');
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : 'Could not sign out.');
    }
  };

  const stepIndex = screen === 'incidents' ? 1
    : screen === 'notice' ? 2
      : screen === 'complete' ? 4 : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        {screen !== 'home' && screen !== 'complete' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => {
              if (screen === 'incidents') setScreen('home');
              if (screen === 'notice') setScreen('incidents');
            }}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>‹  Back</Text>
          </Pressable>
        ) : (
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}><Text style={styles.brandIconText}>S</Text></View>
            <View>
              <Text style={styles.eyebrow}>SAFE:MEAS</Text>
              <Text style={styles.brand}>Medical Incident Reporting</Text>
            </View>
          </View>
        )}
        {screen === 'home' || screen === 'complete' ? (
          <Pressable accessibilityRole="button" onPress={() => void leave()} style={styles.signOut}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        ) : (
          <ProgressDots step={stepIndex} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {screen === 'home' && (
          <View style={styles.homeLayout}>
            <View style={styles.samplePanel}>
              <View style={styles.sampleCard}>
                <Text style={styles.sampleLabel}>LOCAL TIME</Text>
                <Text style={styles.clock}>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</Text>
                <Text style={styles.sampleSub}>{now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
              </View>
              <View style={styles.sampleCard}>
                <Text style={styles.sampleLabel}>SAMPLE TEMPERATURE</Text>
                <Text style={[styles.sampleNumber, styles.orange]}>88°F</Text>
                <Text style={styles.sampleSub}>Sample heat index: 96°F · Humidity: 72%</Text>
              </View>
            </View>

            <View style={styles.hero}>
              <View style={styles.demoPill}><View style={styles.statusDot} /><Text style={styles.demoPillText}>INCIDENT REPORTING</Text></View>
              <Text style={styles.heroTitle}>REPORT AN INCIDENT</Text>
              <Text style={styles.heroSubtitle}>Submit an incident for review by the SAFE team</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Start an incident report"
                onPress={() => setScreen('incidents')}
                style={({ pressed }: PressableStateCallbackType) => [styles.previewButton, pressed && styles.previewButtonPressed]}
              >
                <Text style={styles.previewButtonIcon}>!</Text>
                <Text style={styles.previewButtonText}>REPORT</Text>
              </Pressable>
              <Text style={styles.demoWarning}>SAVES TO SAFE — DOES NOT SEND RESPONDER ALERTS</Text>
              <Text style={styles.signedIn}>Signed in as {user.username}</Text>
            </View>

            <View style={styles.samplePanel}>
              <View style={styles.sampleCard}>
                <Text style={styles.sampleLabel}>SAMPLE FACILITY</Text>
                <Text style={styles.facilityName}>Manila Central</Text>
                <Text style={styles.facilitySub}>High School Campus</Text>
                <Text style={styles.sampleSub}>Building C — Main Hall</Text>
                <View style={styles.divider} />
                <Text style={styles.sampleSub}>SAMPLE RESPONDERS     4</Text>
                <Text style={styles.sampleSub}>SAMPLE CLINIC STATUS  OPEN</Text>
                <Text style={styles.sampleSub}>SAMPLE RESPONSE AVG  3.2 min</Text>
              </View>
              <View style={styles.sampleCard}>
                <Text style={styles.contactLabel}>SAMPLE CONTACTS</Text>
                <Text style={styles.sampleSub}>School Nurse              loc. 101</Text>
                <Text style={styles.sampleSub}>Security Office           loc. 105</Text>
                <Text style={styles.sampleSub}>Admin Office              loc. 100</Text>
              </View>
            </View>
            <Text style={styles.disclaimer}>
              Reports are saved for staff review. This app does not contact emergency services or dispatch responders. For immediate danger, call local emergency services directly.
            </Text>
          </View>
        )}

        {screen === 'incidents' && (
          <View style={styles.screenSection}>
            <Text style={styles.stepLabel}>STEP 1 OF 4</Text>
            <Text style={styles.title}>Select the Type of Medical Incident</Text>
            <View style={styles.tabRow}>
              <CategoryTab
                label="URGENT / EMERGENCY"
                active={category === 'urgent'}
                urgent
                onPress={() => setCategory('urgent')}
              />
              <CategoryTab
                label="MINOR INCIDENT"
                active={category === 'minor'}
                onPress={() => setCategory('minor')}
              />
            </View>
            <Text style={[styles.categoryHint, category === 'urgent' ? styles.red : styles.green]}>
              {category === 'urgent'
                ? 'THESE CONDITIONS REQUIRE IMMEDIATE EMERGENCY RESPONSE'
                : 'THESE INCIDENTS REQUIRE CLINIC ASSESSMENT AND BASIC FIRST AID'}
            </Text>
            {(category === 'urgent' ? URGENT_INCIDENTS : MINOR_INCIDENTS).map((incident, index) => (
              <Pressable
                accessibilityRole="button"
                key={incident.id}
                onPress={() => {
                  setSelectedIncident(incident);
                  setAcceptedNotice(false);
                  setScreen('notice');
                }}
                style={({ pressed }: { pressed: boolean }) => [styles.incidentCard, pressed && styles.incidentCardPressed]}
              >
                <View style={styles.numberBadge}><Text style={styles.numberText}>{index + 1}</Text></View>
                <View style={styles.incidentCopy}>
                  <Text style={styles.incidentTitle}>{incident.label}</Text>
                  <Text style={styles.incidentSigns}>{incident.signs}</Text>
                </View>
                <Text style={[styles.chevron, incident.severity === 'urgent' ? styles.red : styles.green]}>›</Text>
              </Pressable>
            ))}
          </View>
        )}

        {screen === 'notice' && selectedIncident && (
          <View style={styles.screenSection}>
            <Text style={[styles.stepLabel, selectedIncident.severity === 'urgent' ? styles.red : styles.green]}>REPORT DETAILS</Text>
            <Text style={styles.title}>Describe the incident</Text>
            <View style={[
              styles.selectedIncident,
              selectedIncident.severity === 'urgent' ? styles.urgentPanel : styles.minorPanel,
            ]}>
              <Text style={styles.sampleLabel}>SELECTED INCIDENT</Text>
              <Text style={styles.selectedTitle}>{selectedIncident.label}</Text>
              <Text style={styles.sampleSub}>{selectedIncident.signs}</Text>
            </View>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Where is the incident? *</Text>
              <TextInput
                accessibilityLabel="Incident location"
                value={location}
                onChangeText={setLocation}
                placeholder="Building, room, or campus area"
                placeholderTextColor="#68758b"
                maxLength={200}
                returnKeyType="next"
                style={styles.textInput}
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>What happened? *</Text>
              <TextInput
                accessibilityLabel="Incident description"
                value={description}
                onChangeText={setDescription}
                placeholder="Describe what you observed"
                placeholderTextColor="#68758b"
                maxLength={2000}
                multiline
                textAlignVertical="top"
                style={[styles.textInput, styles.descriptionInput]}
              />
              <Text style={styles.characterCount}>{description.length}/2000</Text>
            </View>
            <View style={styles.noticeCard}>
              <Text style={styles.noticeEyebrow}>IMPORTANT</Text>
              <Text style={styles.noticeTitle}>Before you submit</Text>
              {[
                'Your incident details and manually entered location will be saved to the SAFE incident database for staff review.',
                'This submission does not send notifications to responders or contact emergency services.',
                'For an immediate emergency, call local emergency services or contact your school clinic directly.',
              ].map((text) => (
                <View key={text} style={styles.bulletRow}>
                  <View style={styles.bullet} />
                  <Text style={styles.bulletText}>{text}</Text>
                </View>
              ))}
              <Text style={styles.timeStamp}>
                Submitting as {user.username} · {now.toLocaleDateString()}
              </Text>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acceptedNotice }}
                onPress={() => setAcceptedNotice((accepted) => !accepted)}
                style={styles.acknowledgment}
              >
                <View style={[styles.checkbox, acceptedNotice && styles.checkboxChecked]}>
                  {acceptedNotice && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.acknowledgmentText}>
                  I confirm these details are accurate and understand this will not notify responders.
                </Text>
              </Pressable>
            </View>
            {submitError && (
              <Text accessibilityRole="alert" style={styles.error}>{submitError}</Text>
            )}
            <PrimaryButton
              label={submitting ? 'SUBMITTING REPORT...' : 'SUBMIT INCIDENT REPORT'}
              disabled={
                !acceptedNotice
                || !location.trim()
                || description.trim().length < 3
                || submitting
              }
              onPress={() => void submitReport()}
            />
            {!acceptedNotice && <Text style={styles.hint}>Confirm the notice above to submit.</Text>}
          </View>
        )}

        {screen === 'complete' && selectedIncident && submission && (
          <View style={styles.screenSection}>
            <Text style={styles.completeEyebrow}>REPORT SAVED</Text>
            <Text style={styles.title}>Incident report submitted</Text>
            <Text style={styles.bodyText}>Your report was saved for staff review. No responder notification was sent.</Text>
            <View style={styles.selectedIncident}>
              <Text style={styles.sampleLabel}>INCIDENT TYPE</Text>
              <Text style={styles.selectedTitle}>{selectedIncident.label}</Text>
              <View style={styles.divider} />
              <Text style={styles.sampleLabel}>REPORT NUMBER</Text>
              <Text style={styles.selectedTitle}>{submission.incidentId}</Text>
              <Text style={styles.sampleLabel}>STATUS</Text>
              <Text style={styles.selectedTitle}>{submission.status}</Text>
              <Text style={styles.sampleLabel}>LOCATION</Text>
              <Text style={styles.selectedTitle}>{location}</Text>
              <Text style={styles.sampleLabel}>DESCRIPTION</Text>
              <Text style={styles.sampleSub}>{description}</Text>
              {submission.reportedAt && (
                <>
                  <Text style={styles.sampleLabel}>SUBMITTED</Text>
                  <Text style={styles.sampleSub}>{new Date(submission.reportedAt).toLocaleString()}</Text>
                </>
              )}
            </View>
            <Text style={styles.nextTitle}>What to do next</Text>
            <Text style={styles.sampleSub}>This app has not contacted responders. For immediate danger, contact local emergency services or your school clinic directly.</Text>
            {(selectedIncident.severity === 'urgent' ? URGENT_GUIDANCE : MINOR_GUIDANCE).map((item, index) => (
              <View key={item.title} style={styles.guidanceCard}>
                <View style={styles.numberBadge}><Text style={styles.numberText}>{index + 1}</Text></View>
                <View style={styles.incidentCopy}>
                  <Text style={styles.incidentTitle}>{item.title}</Text>
                  <Text style={styles.incidentSigns}>{item.detail}</Text>
                </View>
              </View>
            ))}
            <View style={styles.emergencyContact}>
              <Text style={styles.contactLabel}>NEED REAL HELP?</Text>
              <Text style={styles.selectedTitle}>Contact local emergency services or your school clinic directly.</Text>
              <Text style={styles.sampleSub}>Do not wait for this app to request help.</Text>
            </View>
            <SecondaryButton label="File Another Report" onPress={reset} />
          </View>
        )}

        {signOutError && <Text accessibilityRole="alert" style={styles.error}>{signOutError}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

function ProgressDots({ step }: { step: number }) {
  return (
    <View style={styles.progressDots}>
      {[1, 2, 3, 4].map((item) => (
        <View key={item} style={[styles.progressDot, item <= step && styles.progressDotActive]} />
      ))}
    </View>
  );
}

function CategoryTab({ label, active, urgent = false, onPress }: {
  label: string;
  active: boolean;
  urgent?: boolean;
  onPress: () => void;
}) {
  const color = urgent ? '#ef4444' : '#22c55e';
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.categoryTab, active && { borderColor: `${color}66`, backgroundColor: `${color}16` }]}
    >
      <Text style={[styles.categoryTabText, active && { color }]}>{label}</Text>
      <Text style={[styles.categoryCount, active && { color }]}>{urgent ? '10' : '10'}</Text>
    </Pressable>
  );
}

function PrimaryButton({ label, onPress, disabled = false }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }: { pressed: boolean }) => [styles.primaryButton, (pressed || disabled) && styles.buttonMuted]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.secondaryButton}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#080a0f' },
  header: { minHeight: 66, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#1d2532', backgroundColor: '#0a0c12' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  brandIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#331417', borderWidth: 1, borderColor: '#653033' },
  brandIconText: { color: '#f87171', fontSize: 21, fontWeight: '800' },
  eyebrow: { color: '#ef4444', fontSize: 9, letterSpacing: 1.5, fontWeight: '700' },
  brand: { color: '#f0f4ff', fontSize: 12, fontWeight: '700', marginTop: 2 },
  signOut: { paddingVertical: 8, paddingHorizontal: 11, borderRadius: 10, borderWidth: 1, borderColor: '#303a4b' },
  signOutText: { color: '#cbd5e1', fontSize: 11, fontWeight: '700' },
  backButton: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#151923', borderWidth: 1, borderColor: '#273244' },
  backButtonText: { color: '#c8d6f0', fontSize: 13, fontWeight: '700' },
  progressDots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  progressDot: { width: 7, height: 7, borderRadius: 5, backgroundColor: '#374151' },
  progressDotActive: { width: 18, backgroundColor: '#ef4444' },
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 18, paddingBottom: 42, gap: 18 },
  homeLayout: { gap: 17 },
  samplePanel: { gap: 10 },
  sampleCard: { backgroundColor: '#0e1117', borderWidth: 1, borderColor: '#202631', borderRadius: 17, padding: 15, gap: 6 },
  sampleLabel: { color: '#7a8fad', fontSize: 9, letterSpacing: 1.3, fontWeight: '700' },
  clock: { color: '#f0f4ff', fontSize: 30, fontWeight: '800', letterSpacing: -1 },
  sampleSub: { color: '#91a0b7', fontSize: 11, lineHeight: 17 },
  sampleNumber: { fontSize: 32, fontWeight: '800' },
  orange: { color: '#f97316' },
  hero: { alignItems: 'center', gap: 11, paddingVertical: 12 },
  demoPill: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 20, backgroundColor: '#10251b', borderColor: '#1c5537', borderWidth: 1, paddingHorizontal: 11, paddingVertical: 7 },
  statusDot: { width: 7, height: 7, borderRadius: 5, backgroundColor: '#22c55e' },
  demoPillText: { color: '#22c55e', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  heroTitle: { color: '#f0f4ff', fontSize: 24, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center' },
  heroSubtitle: { color: '#7a8fad', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  previewButton: { width: 214, height: 214, borderRadius: 120, backgroundColor: '#991b1b', borderWidth: 4, borderColor: '#ef444477', alignItems: 'center', justifyContent: 'center', shadowColor: '#dc2626', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 30, elevation: 10, marginVertical: 9 },
  previewButtonPressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  previewButtonIcon: { color: '#fff', fontSize: 62, fontWeight: '900', lineHeight: 72 },
  previewButtonText: { color: '#fff', fontSize: 19, fontWeight: '900', letterSpacing: 1 },
  demoWarning: { color: '#a5b4cb', fontSize: 9, lineHeight: 15, fontWeight: '700', letterSpacing: 0.6, textAlign: 'center' },
  signedIn: { color: '#566780', fontSize: 10, textAlign: 'center' },
  facilityName: { color: '#f0f4ff', fontSize: 15, fontWeight: '800', marginTop: 4 },
  facilitySub: { color: '#f0f4ff', fontSize: 13, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#252c36', marginVertical: 4 },
  contactLabel: { color: '#0ea5e9', fontSize: 9, letterSpacing: 1.2, fontWeight: '800' },
  disclaimer: { color: '#64748b', fontSize: 10, textAlign: 'center', lineHeight: 16, paddingHorizontal: 6 },
  screenSection: { gap: 14 },
  stepLabel: { color: '#ef4444', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: '#f0f4ff', fontSize: 23, lineHeight: 29, fontWeight: '800' },
  tabRow: { flexDirection: 'row', gap: 8, marginTop: 3 },
  categoryTab: { minHeight: 44, flex: 1, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: '#282f3b', backgroundColor: '#0e1117', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  categoryTabText: { color: '#7a8fad', fontSize: 9, fontWeight: '800', letterSpacing: 0.4, textAlign: 'center' },
  categoryCount: { color: '#68758b', fontSize: 9, fontWeight: '700' },
  categoryHint: { fontSize: 9, lineHeight: 15, fontWeight: '800', letterSpacing: 0.7 },
  red: { color: '#ef4444' },
  green: { color: '#22c55e' },
  incidentCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15, borderWidth: 1, borderColor: '#202631', backgroundColor: '#0e1117', paddingHorizontal: 13, paddingVertical: 11 },
  incidentCardPressed: { borderColor: '#ef4444', backgroundColor: '#211316' },
  numberBadge: { width: 31, height: 31, borderRadius: 10, backgroundColor: '#171b23', borderWidth: 1, borderColor: '#2a303c', alignItems: 'center', justifyContent: 'center' },
  numberText: { color: '#91a0b7', fontSize: 11, fontWeight: '800' },
  incidentCopy: { flex: 1, gap: 4 },
  incidentTitle: { color: '#f0f4ff', fontSize: 13, fontWeight: '700', lineHeight: 18 },
  incidentSigns: { color: '#7a8fad', fontSize: 10, lineHeight: 15 },
  chevron: { fontSize: 27, lineHeight: 30, fontWeight: '300' },
  selectedIncident: { backgroundColor: '#0e1117', borderWidth: 1, borderColor: '#35272b', borderRadius: 15, padding: 15, gap: 8 },
  urgentPanel: { backgroundColor: '#211316', borderColor: '#5e292f' },
  minorPanel: { backgroundColor: '#122018', borderColor: '#28553b' },
  selectedTitle: { color: '#f0f4ff', fontSize: 15, lineHeight: 21, fontWeight: '700' },
  formField: { gap: 7 },
  fieldLabel: { color: '#c8d6f0', fontSize: 12, fontWeight: '700' },
  textInput: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#303a4b', backgroundColor: '#0e1117', color: '#f0f4ff', paddingHorizontal: 13, paddingVertical: 11, fontSize: 13 },
  descriptionInput: { minHeight: 110, paddingTop: 12 },
  characterCount: { color: '#64748b', fontSize: 10, textAlign: 'right' },
  noticeCard: { backgroundColor: '#0e1117', borderWidth: 1, borderColor: '#5b4a1f', borderRadius: 16, padding: 15, gap: 13 },
  noticeEyebrow: { color: '#eab308', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  noticeTitle: { color: '#f0f4ff', fontSize: 16, fontWeight: '800', marginTop: -7 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet: { width: 6, height: 6, borderRadius: 4, backgroundColor: '#eab308', marginTop: 5 },
  bulletText: { flex: 1, color: '#c8d6f0', fontSize: 12, lineHeight: 18 },
  timeStamp: { color: '#7a8fad', fontSize: 10, lineHeight: 16, borderTopWidth: 1, borderTopColor: '#252c36', paddingTop: 11 },
  acknowledgment: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 3 },
  checkbox: { width: 21, height: 21, borderRadius: 6, borderWidth: 2, borderColor: '#586578', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { borderColor: '#ef4444', backgroundColor: '#401b20' },
  checkmark: { color: '#f87171', fontSize: 13, fontWeight: '900', lineHeight: 16 },
  acknowledgmentText: { flex: 1, color: '#c8d6f0', fontSize: 12, lineHeight: 18 },
  primaryButton: { minHeight: 52, borderRadius: 14, backgroundColor: '#b91c1c', borderWidth: 1, borderColor: '#ef4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  buttonMuted: { opacity: 0.45 },
  hint: { color: '#7a8fad', fontSize: 10, textAlign: 'center', marginTop: -7 },
  bodyText: { color: '#c8d6f0', fontSize: 12, lineHeight: 18 },
  completeEyebrow: { color: '#f87171', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  nextTitle: { color: '#f0f4ff', fontSize: 18, fontWeight: '800', marginTop: 2 },
  guidanceCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 14, padding: 13, backgroundColor: '#0e1117', borderWidth: 1, borderColor: '#202631' },
  emergencyContact: { borderRadius: 15, padding: 15, gap: 8, backgroundColor: '#211316', borderWidth: 1, borderColor: '#5e292f' },
  secondaryButton: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#303a4b', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  secondaryButtonText: { color: '#c8d6f0', fontSize: 13, fontWeight: '700' },
  error: { color: '#fecaca', backgroundColor: '#3b171a', borderRadius: 10, padding: 12, fontSize: 13, lineHeight: 19 },
});
