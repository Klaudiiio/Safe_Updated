import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
} from 'react-native';
import {
  ShieldAlert,
  Thermometer,
  Clock,
  HeartPulse,
  Wind,
  Droplets,
  Flame,
  Activity,
  Zap,
  ThermometerSnowflake,
  Brain,
  GlassWater,
  AlertTriangle,
  Bell,
  X,
} from 'lucide-react-native';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../context/ThemeContext';

type Severity = 'urgent' | 'minor';

interface IncidentType {
  id: string;
  label: string;
  signs: string;
  severity: Severity;
}

const URGENT_INCIDENTS: IncidentType[] = [
  { id: 'cardiac', label: 'Cardiac Arrest / Collapse', signs: 'Unconscious, not breathing normally, no pulse', severity: 'urgent' },
  { id: 'breathing', label: 'Severe Difficulty Breathing', signs: 'Asthma attack, choking, turning blue', severity: 'urgent' },
  { id: 'bleeding', label: 'Severe Bleeding', signs: 'Blood soaking clothing or spurting from a wound', severity: 'urgent' },
  { id: 'burns', label: 'Severe Burns', signs: 'Electrical burns, large-area burns, facial burns', severity: 'urgent' },
  { id: 'seizure', label: 'Seizure Lasting >5 Minutes', signs: 'Repeated seizures or not waking up afterward', severity: 'urgent' },
  { id: 'anaphylaxis', label: 'Anaphylaxis (Severe Allergy)', signs: 'Swollen throat, wheezing, collapse', severity: 'urgent' },
  { id: 'unconscious', label: 'Unconscious / Unresponsive Student', signs: 'Fainting that does not resolve quickly', severity: 'urgent' },
  { id: 'stroke', label: 'Suspected Stroke', signs: 'Face drooping, arm weakness, speech difficulty', severity: 'urgent' },
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
  { id: 'dehydration', label: 'Mild Dehydration', signs: 'Fluids and observation', severity: 'minor' },
];

const commonIncidentsGrid = [
  { id: 'cardiac', title: 'Cardiac Arrest', icon: HeartPulse, target: URGENT_INCIDENTS[0] },
  { id: 'breathing', title: 'Difficulty Breathing', icon: Wind, target: URGENT_INCIDENTS[1] },
  { id: 'bleeding', title: 'Severe Bleeding', icon: Droplets, target: URGENT_INCIDENTS[2] },
  { id: 'burns', title: 'Severe Burns', icon: Flame, target: URGENT_INCIDENTS[3] },
  { id: 'sprain', title: 'Sprain / Strain', icon: Activity, target: MINOR_INCIDENTS[1] },
  { id: 'dizziness', title: 'Brief Dizziness', icon: Zap, target: MINOR_INCIDENTS[2] },
  { id: 'fever', title: 'Mild Fever', icon: ThermometerSnowflake, target: MINOR_INCIDENTS[3] },
  { id: 'headache', title: 'Headache', icon: Brain, target: MINOR_INCIDENTS[4] },
  { id: 'dehydration', title: 'Dehydration', icon: GlassWater, target: MINOR_INCIDENTS[8] },
];

export default function HomeScreen() {
  const { user, submitIncidentReport } = useAuth();
  const { isDark } = useTheme();

  // Telemetry & Time State
  const [now, setNow] = useState(() => new Date());
  const [currentSeconds, setCurrentSeconds] = useState('00');
  const [temperature, setTemperature] = useState(28);
  const [weatherCondition, setWeatherCondition] = useState('Sunny');

  // Interactive Flow States
  const [isReporting, setIsReporting] = useState(false);
  const [severityCategory, setSeverityCategory] = useState<Severity>('urgent');
  const [selectedIncident, setSelectedIncident] = useState<IncidentType | null>(null);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [acceptedNotice, setAcceptedNotice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setNow(d);
      const sec = d.getSeconds();
      setCurrentSeconds(sec < 10 ? `0${sec}` : `${sec}`);
    }, 1000);

    const tempTimer = setInterval(() => {
      setTemperature(prev => parseFloat((prev + (Math.random() - 0.5) * 0.4).toFixed(1)));
    }, 6000);

    return () => {
      clearInterval(timer);
      clearInterval(tempTimer);
    };
  }, []);

  const handleReset = () => {
    setIsReporting(false);
    setSelectedIncident(null);
    setLocation('');
    setDescription('');
    setAcceptedNotice(false);
    setSeverityCategory('urgent');
  };

  const handleFullSubmit = async () => {
    if (!selectedIncident || submitting) return;
    setSubmitting(true);
    try {
      if (submitIncidentReport) {
        await submitIncidentReport({
          incident_type: selectedIncident.label,
          description: description.trim(),
          location: location.trim(),
        } as any);
      }
      showToast('🚨 Emergency report successfully logged!');
      Alert.alert(
        'Report Saved',
        'Your incident report has been securely saved to the database.',
        [{ text: 'OK', onPress: handleReset }]
      );
    } catch (err) {
      Alert.alert('Submission Error', err instanceof Error ? err.message : 'Failed to send report.');
    } finally {
      setSubmitting(false);
    }
  };

  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const dynamicStyles = {
    container: { backgroundColor: isDark ? '#060913' : '#f8fafc' },
    card: { backgroundColor: isDark ? '#0f172a' : '#ffffff', borderColor: isDark ? '#1e293b' : '#e2e8f0' },
    textMain: { color: isDark ? '#ffffff' : '#0f172a' },
    textSub: { color: isDark ? '#94a3b8' : '#64748b' },
    gridCard: { backgroundColor: isDark ? '#0b1322' : '#ffffff', borderColor: isDark ? '#1e293b' : '#e2e8f0' },
    gridText: { color: isDark ? '#cbd5e1' : '#334155' },
    input: { backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#ffffff' : '#0f172a', borderColor: isDark ? '#273244' : '#cbd5e1' },
  };

  if (isReporting) {
    return (
      <ScrollView contentContainerStyle={[styles.container, dynamicStyles.container]} keyboardShouldPersistTaps="handled">
        <View style={styles.wizardHeader}>
          <TouchableOpacity onPress={handleReset} style={styles.backButtonRow}>
            <Text style={styles.backButtonText}>‹ Back to Dashboard</Text>
          </TouchableOpacity>
          <Text style={[styles.wizardTitle, dynamicStyles.textMain]}>Emergency Incident Wizard</Text>
        </View>

        {!selectedIncident ? (
          <>
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.categoryTab, dynamicStyles.card, severityCategory === 'urgent' && styles.activeUrgentTab]}
                onPress={() => setSeverityCategory('urgent')}
              >
                <Text style={[styles.categoryTabText, severityCategory === 'urgent' && styles.activeTabText]}>
                  URGENT / EMERGENCY
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.categoryTab, dynamicStyles.card, severityCategory === 'minor' && styles.activeMinorTab]}
                onPress={() => setSeverityCategory('minor')}
              >
                <Text style={[styles.categoryTabText, severityCategory === 'minor' && styles.activeTabText]}>
                  MINOR INCIDENT
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.wizardSubtitle, dynamicStyles.textSub]}>Select specific incident type below:</Text>

            {(severityCategory === 'urgent' ? URGENT_INCIDENTS : MINOR_INCIDENTS).map((item, idx) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.incidentRowCard, dynamicStyles.card]}
                onPress={() => {
                  setSelectedIncident(item);
                  showToast(`Selected: ${item.label}`);
                }}
              >
                <View style={[styles.badgeCircle, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
                  <Text style={[styles.badgeText, dynamicStyles.textMain]}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.incidentRowTitle, dynamicStyles.textMain]}>{item.label}</Text>
                  <Text style={[styles.incidentRowSigns, dynamicStyles.textSub]}>{item.signs}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </>
        ) : (
          <>
            <View style={[styles.selectedBanner, dynamicStyles.card]}>
              <Text style={styles.bannerLabel}>SELECTED INCIDENT:</Text>
              <Text style={[styles.bannerValue, dynamicStyles.textMain]}>{selectedIncident.label}</Text>
              <Text style={[styles.bannerSigns, dynamicStyles.textSub]}>{selectedIncident.signs}</Text>
            </View>

            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, dynamicStyles.textMain]}>Building / Location *</Text>
              <TextInput
                style={[styles.textInput, dynamicStyles.input]}
                placeholder="e.g., Building C, Room 302, Main Gate"
                placeholderTextColor={isDark ? '#68758b' : '#94a3b8'}
                value={location}
                onChangeText={setLocation}
              />
            </View>

            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, dynamicStyles.textMain]}>Description / What Happened *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea, dynamicStyles.input]}
                placeholder="Provide details about the incident..."
                placeholderTextColor={isDark ? '#68758b' : '#94a3b8'}
                multiline
                numberOfLines={4}
                value={description}
                onChangeText={setDescription}
              />
            </View>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setAcceptedNotice(!acceptedNotice)}
            >
              <View style={[styles.checkbox, acceptedNotice && styles.checkboxChecked]}>
                {acceptedNotice && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={[styles.checkboxLabel, dynamicStyles.textSub]}>
                I confirm these details are accurate for clinic and staff review.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitReportButton,
                (!acceptedNotice || !location.trim() || !description.trim() || submitting) && styles.buttonDisabled,
              ]}
              disabled={!acceptedNotice || !location.trim() || !description.trim() || submitting}
              onPress={handleFullSubmit}
            >
              <Text style={styles.submitReportButtonText}>
                {submitting ? 'Submitting Report...' : 'Confirm & Submit Report'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setSelectedIncident(null)}
            >
              <Text style={styles.cancelButtonText}>Choose a different incident</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, dynamicStyles.container]}>
      {toastMessage && (
        <View style={[styles.toastContainer, { backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
          <Bell size={16} color="#38bdf8" />
          <Text style={[styles.toastText, dynamicStyles.textMain]}>{toastMessage}</Text>
          <TouchableOpacity onPress={() => setToastMessage(null)}>
            <X size={16} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      )}

      {/* Telemetry Status Widgets (Temperature & Live Clock) */}
      <View style={styles.metricsRow}>
        <TouchableOpacity
          style={[styles.metricCard, dynamicStyles.card]}
          onPress={() => {
            setWeatherCondition(prev => (prev === 'Sunny' ? 'Humid' : prev === 'Humid' ? 'Breezy' : 'Sunny'));
            showToast(`Weather mode: ${weatherCondition}`);
          }}
        >
          <View style={styles.metricTopRow}>
            <Text style={[styles.metricLabel, dynamicStyles.textSub]}>Temperature</Text>
            <View style={styles.weatherPill}>
              <Thermometer size={10} color="#f59e0b" />
              <Text style={styles.weatherPillText}>{weatherCondition}</Text>
            </View>
          </View>
          <View style={styles.metricValueGroup}>
            <View style={styles.iconBoxSky}>
              <Thermometer size={16} color="#38bdf8" />
            </View>
            <View>
              <Text style={[styles.metricValueText, dynamicStyles.textMain]}>{temperature}°C</Text>
              <Text style={styles.metricSubText}>Safe Zone</Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={[styles.metricCard, dynamicStyles.card]}>
          <View style={styles.metricTopRow}>
            <Text style={[styles.metricLabel, dynamicStyles.textSub]}>System Time</Text>
            <View style={styles.livePill}>
              <Text style={styles.livePillText}>LIVE</Text>
            </View>
          </View>
          <View style={styles.metricValueGroup}>
            <View style={styles.iconBoxBlue}>
              <Clock size={16} color="#3b82f6" />
            </View>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <Text style={[styles.metricValueText, dynamicStyles.textMain]}>{timeString}</Text>
                <Text style={styles.secondsText}>{currentSeconds}</Text>
              </View>
              <Text style={styles.metricSubText}>Satellite Synced</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeaderRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={14} color="#f59e0b" />
          <Text style={[styles.sectionTitle, dynamicStyles.textSub]}>Common Incidents</Text>
        </View>
        <Text style={styles.sectionHint}>Select before SOS</Text>
      </View>

      <View style={styles.gridContainer}>
        {commonIncidentsGrid.map((item) => {
          const IconComponent = item.icon;
          const isSelected = selectedIncident?.id === item.target.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.gridCard,
                dynamicStyles.gridCard,
                isSelected && styles.gridCardSelected,
              ]}
              onPress={() => {
                setSeverityCategory(item.target.severity);
                setSelectedIncident(item.target);
                setIsReporting(true);
                showToast(`Selected: ${item.title}`);
              }}
            >
              {isSelected && <View style={styles.selectionDot} />}
              <View style={[styles.gridIconBox, isSelected && styles.gridIconBoxSelected, { backgroundColor: isDark ? '#1e293b80' : '#f1f5f9' }]}>
                <IconComponent size={18} color={isSelected ? '#ffffff' : (isDark ? '#94a3b8' : '#475569')} />
              </View>
              <Text
                style={[
                  styles.gridCardText,
                  dynamicStyles.gridText,
                  isSelected && styles.gridCardTextSelected,
                ]}
                numberOfLines={2}
              >
                {item.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.emergencyButtonWrapper}>
        <View style={styles.outerGlowRing} />
        <TouchableOpacity
          style={styles.emergencyButton}
          activeOpacity={0.85}
          onPress={() => {
            setSeverityCategory('urgent');
            setSelectedIncident(null);
            setIsReporting(true);
          }}
        >
          <View style={styles.innerFlare} />
          <ShieldAlert size={32} color="#ffffff" style={{ marginBottom: 4 }} />
          <Text style={styles.emergencyButtonText}>EMERGENCY{'\n'}REPORT</Text>
          {selectedIncident && (
            <View style={styles.selectedPillBadge}>
              <Text style={styles.selectedPillText} numberOfLines={1}>
                {selectedIncident.label}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  toastContainer: { position: 'absolute', top: 10, left: 20, right: 20, zIndex: 99, borderRadius: 14, borderWidth: 1, borderColor: '#38bdf840', flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 6 },
  toastText: { fontSize: 13, fontWeight: '600', flex: 1 },
  metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  metricCard: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 12 },
  metricTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  metricLabel: { fontSize: 11, fontWeight: '600' },
  weatherPill: { backgroundColor: '#38bdf820', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 3 },
  weatherPillText: { color: '#0284c7', fontSize: 9, fontWeight: 'bold' },
  livePill: { backgroundColor: '#10b98120', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  livePillText: { color: '#059669', fontSize: 9, fontWeight: 'bold' },
  metricValueGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBoxSky: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#38bdf815', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#38bdf830' },
  iconBoxBlue: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#3b82f615', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#3b82f630' },
  metricValueText: { fontSize: 16, fontWeight: '800' },
  secondsText: { color: '#0284c7', fontSize: 11, fontWeight: '700' },
  metricSubText: { color: '#64748b', fontSize: 9, fontWeight: '500' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 2 },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionHint: { color: '#64748b', fontSize: 10 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginBottom: 24 },
  gridCard: { width: '31.5%', borderWidth: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', minHeight: 84 },
  gridCardSelected: { backgroundColor: '#eff6ff', borderColor: '#3b82f6', shadowColor: '#3b82f6', shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 },
  selectionDot: { position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: '#3b82f6' },
  gridIconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  gridIconBoxSelected: { backgroundColor: '#3b82f6' },
  gridCardText: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  gridCardTextSelected: { color: '#1d4ed8', fontWeight: 'bold' },
  emergencyButtonWrapper: { alignItems: 'center', justifyContent: 'center', marginVertical: 10 },
  outerGlowRing: { position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: '#ef444415' },
  emergencyButton: { width: 160, height: 160, borderRadius: 80, backgroundColor: '#dc2626', borderWidth: 4, borderColor: '#fca5a550', alignItems: 'center', justifyContent: 'center', shadowColor: '#ef4444', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 10 },
  innerFlare: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%', backgroundColor: '#ffffff15', borderTopLeftRadius: 80, borderTopRightRadius: 80 },
  emergencyButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '900', textAlign: 'center', letterSpacing: 0.5 },
  selectedPillBadge: { position: 'absolute', bottom: 10, backgroundColor: '#00000088', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: '#fca5a540', maxWidth: 130 },
  selectedPillText: { color: '#fee2e2', fontSize: 9, fontWeight: 'bold' },
  wizardHeader: { marginBottom: 16 },
  backButtonRow: { marginBottom: 8 },
  backButtonText: { color: '#0284c7', fontSize: 15, fontWeight: '600' },
  wizardTitle: { fontSize: 22, fontWeight: 'bold' },
  wizardSubtitle: { fontSize: 13, marginBottom: 12 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  categoryTab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1 },
  activeUrgentTab: { backgroundColor: '#fee2e2', borderColor: '#ef4444' },
  activeMinorTab: { backgroundColor: '#dcfce7', borderColor: '#22c55e' },
  categoryTabText: { color: '#64748b', fontWeight: 'bold', fontSize: 11 },
  activeTabText: { color: '#0f172a' },
  incidentRowCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, padding: 12, borderRadius: 12, marginBottom: 8, gap: 10 },
  badgeCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontWeight: 'bold', fontSize: 11 },
  incidentRowTitle: { fontSize: 14, fontWeight: '600' },
  incidentRowSigns: { fontSize: 11, marginTop: 2 },
  chevron: { color: '#94a3b8', fontSize: 20, fontWeight: 'bold' },
  selectedBanner: { borderWidth: 1, borderColor: '#3b82f6', borderRadius: 12, padding: 14, marginBottom: 16 },
  bannerLabel: { color: '#3b82f6', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  bannerValue: { fontSize: 16, fontWeight: 'bold', marginTop: 2 },
  bannerSigns: { fontSize: 12, marginTop: 2 },
  formField: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  textInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14 },
  textArea: { height: 90, textAlignVertical: 'top' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#3b82f6' },
  checkmark: { color: '#ffffff', fontWeight: 'bold', fontSize: 12 },
  checkboxLabel: { fontSize: 12, flex: 1 },
  submitReportButton: { backgroundColor: '#ef4444', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 6 },
  submitReportButtonText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  buttonDisabled: { opacity: 0.5 },
  cancelButton: { padding: 12, alignItems: 'center', marginTop: 6 },
  cancelButtonText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
});