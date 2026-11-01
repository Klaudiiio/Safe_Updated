import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import {
  Thermometer,
  Clock,
} from 'lucide-react-native';
import { useAuth } from '../../auth/AuthContext';

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

// Most common incident types mapped to the text-only grid boxes
const commonIncidentsGrid = [
  { id: 'cardiac', title: 'Cardiac Arrest', target: URGENT_INCIDENTS[0] },
  { id: 'breathing', title: 'Difficulty Breathing', target: URGENT_INCIDENTS[1] },
  { id: 'bleeding', title: 'Severe Bleeding', target: URGENT_INCIDENTS[4] },
  { id: 'burns', title: 'Severe Burns', target: URGENT_INCIDENTS[8] },
  { id: 'sprain', title: 'Sprain or Strain', target: MINOR_INCIDENTS[1] },
  { id: 'dizziness', title: 'Brief Dizziness', target: MINOR_INCIDENTS[2] },
  { id: 'fever', title: 'Mild Fever', target: MINOR_INCIDENTS[3] },
  { id: 'headache', title: 'Headache', target: MINOR_INCIDENTS[4] },
  { id: 'dehydration', title: 'Dehydration', target: MINOR_INCIDENTS[9] },
];

export default function HomeScreen() {
  const { user, submitIncidentReport } = useAuth();
  
  // Weather & Clock State
  const [now, setNow] = useState(() => new Date());
  const [temperature, setTemperature] = useState('28°C');

  // Reporting Wizard States
  const [isReporting, setIsReporting] = useState(false);
  const [severityCategory, setSeverityCategory] = useState<Severity>('urgent');
  const [selectedIncident, setSelectedIncident] = useState<IncidentType | null>(null);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [acceptedNotice, setAcceptedNotice] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Live time ticker & weather fetch
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);

    fetch('https://api.open-meteo.com/v1/forecast?latitude=8.4542&current=temperature_2m')
      .then((res) => res.json())
      .then((data) => {
        if (data?.current?.temperature_2m) {
          setTemperature(`${Math.round(data.current.temperature_2m)}°C`);
        }
      })
      .catch(() => {});

    return () => clearInterval(timer);
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
      Alert.alert(
        'Report Submitted',
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

  // If user clicked a grid item or the emergency button, show the Incident Selection & Detail Wizard
  if (isReporting) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.wizardHeader}>
          <TouchableOpacity onPress={handleReset}>
            <Text style={styles.backButtonText}>‹ Back to Home</Text>
          </TouchableOpacity>
          <Text style={styles.wizardTitle}>Emergency Incident Wizard</Text>
        </View>

        {!selectedIncident ? (
          <>
            {/* Step 1: Choose Severity / Category */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.categoryTab, severityCategory === 'urgent' && styles.activeUrgentTab]}
                onPress={() => setSeverityCategory('urgent')}
              >
                <Text style={[styles.categoryTabText, severityCategory === 'urgent' && styles.activeTabText]}>
                  URGENT / EMERGENCY
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.categoryTab, severityCategory === 'minor' && styles.activeMinorTab]}
                onPress={() => setSeverityCategory('minor')}
              >
                <Text style={[styles.categoryTabText, severityCategory === 'minor' && styles.activeTabText]}>
                  MINOR INCIDENT
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.wizardSubtitle}>Select the specific incident type:</Text>

            {/* List of Incidents */}
            {(severityCategory === 'urgent' ? URGENT_INCIDENTS : MINOR_INCIDENTS).map((item, idx) => (
              <TouchableOpacity
                key={item.id}
                style={styles.incidentRowCard}
                onPress={() => setSelectedIncident(item)}
              >
                <View style={styles.badgeCircle}>
                  <Text style={styles.badgeText}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.incidentRowTitle}>{item.label}</Text>
                  <Text style={styles.incidentRowSigns}>{item.signs}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </>
        ) : (
          <>
            {/* Step 2: Input Building / Location & Description */}
            <View style={styles.selectedBanner}>
              <Text style={styles.bannerLabel}>SELECTED INCIDENT:</Text>
              <Text style={styles.bannerValue}>{selectedIncident.label}</Text>
            </View>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Building / Location *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Building C, Room 302, Main Gate"
                placeholderTextColor="#68758b"
                value={location}
                onChangeText={setLocation}
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Description / What Happened *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Provide details about the incident..."
                placeholderTextColor="#68758b"
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
              <Text style={styles.checkboxLabel}>
                I confirm these details are accurate for staff review.
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

  // Default Home Dashboard View
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* 1. Header with Logo & Brand */}
      <View style={styles.headerRow}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>🛡️</Text>
        </View>
        <Text style={styles.headerBrandTitle}>SAFE</Text>
      </View>

      <View style={styles.divider} />

      {/* 2. Temperature & Time Metric Cards */}
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Temperature</Text>
          <View style={styles.metricValueGroup}>
            <Thermometer size={20} color="#3B82F6" />
            <Text style={styles.metricValueText}>{temperature}</Text>
          </View>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Time</Text>
          <View style={styles.metricValueGroup}>
            <Clock size={20} color="#3B82F6" />
            <Text style={styles.metricValueText}>{timeString}</Text>
          </View>
        </View>
      </View>

      {/* 3. Common Incidents Grid (Text-only) */}
      <Text style={styles.sectionTitle}>Common Incidents</Text>
      <View style={styles.gridContainer}>
        {commonIncidentsGrid.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.gridCard}
            onPress={() => {
              setSeverityCategory(item.target.severity);
              setSelectedIncident(item.target);
              setIsReporting(true);
            }}
          >
            <Text style={styles.gridCardText} numberOfLines={2}>
              {item.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 4. Large Circular Emergency Button */}
      <View style={styles.emergencyButtonWrapper}>
        <TouchableOpacity
          style={styles.emergencyButton}
          activeOpacity={0.8}
          onPress={() => {
            setSeverityCategory('urgent');
            setSelectedIncident(null);
            setIsReporting(true);
          }}
        >
          <Text style={styles.emergencyButtonText}>Emergency Report</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#080a0f',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 30,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  logoText: {
    fontSize: 22,
  },
  headerBrandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#1F2937',
    marginBottom: 18,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#0F1825',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 14,
    alignItems: 'center',
  },
  metricLabel: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  metricValueGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricValueText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 30,
  },
  gridCard: {
    width: '31%',
    backgroundColor: '#0F1825',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 8,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  gridCardText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  emergencyButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  emergencyButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  emergencyButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  // Wizard Styles
  wizardHeader: {
    marginBottom: 20,
  },
  backButtonText: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  wizardTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  wizardSubtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    marginVertical: 12,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  categoryTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#0F1825',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  activeUrgentTab: {
    backgroundColor: '#3b171a',
    borderColor: '#ef4444',
  },
  activeMinorTab: {
    backgroundColor: '#143822',
    borderColor: '#22c55e',
  },
  categoryTabText: {
    color: '#9CA3AF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  incidentRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1825',
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    gap: 12,
  },
  badgeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  incidentRowTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  incidentRowSigns: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  chevron: {
    color: '#9CA3AF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  selectedBanner: {
    backgroundColor: '#0F1825',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
  },
  bannerLabel: {
    color: '#3B82F6',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  bannerValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  formField: {
    marginBottom: 16,
  },
  fieldLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#0F1825',
    borderWidth: 1,
    borderColor: '#273244',
    borderRadius: 10,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 15,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 14,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#3B82F6',
  },
  checkmark: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  checkboxLabel: {
    color: '#9CA3AF',
    fontSize: 13,
    flex: 1,
  },
  submitReportButton: {
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  submitReportButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  cancelButton: {
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
});