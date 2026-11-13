import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  FlatList,
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
  ChevronDown,
  MapPin,
  FileText,
  Send,
  Navigation,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { fetchLatestSensorData, fetchIncidentTypes } from '../../lib/api';

interface IncidentType {
  id: string;
  label: string;
}

const commonIncidentsGrid = [
  { id: 'cardiac', title: 'Cardiac Arrest', icon: HeartPulse, label: 'Cardiac Arrest / Collapse' },
  { id: 'breathing', title: 'Difficulty Breathing', icon: Wind, label: 'Severe Difficulty Breathing' },
  { id: 'bleeding', title: 'Severe Bleeding', icon: Droplets, label: 'Severe Bleeding' },
  { id: 'burns', title: 'Severe Burns', icon: Flame, label: 'Severe Burns' },
  { id: 'sprain', title: 'Sprain / Strain', icon: Activity, label: 'Minor Sprain or Strain' },
  { id: 'dizziness', title: 'Brief Dizziness', icon: Zap, label: 'Brief Dizziness' },
  { id: 'fever', title: 'Mild Fever', icon: ThermometerSnowflake, label: 'Mild Fever' },
  { id: 'headache', title: 'Headache', icon: Brain, label: 'Headache' },
  { id: 'dehydration', title: 'Dehydration', icon: GlassWater, label: 'Mild Dehydration' },
];

export default function HomeScreen() {
  const { submitIncidentReport } = useAuth();
  const { isDark } = useTheme();

  const [now, setNow] = useState(() => new Date());
  const [currentSeconds, setCurrentSeconds] = useState('00');
  const [temperature, setTemperature] = useState<number | null>(null);
  const [sensorLoading, setSensorLoading] = useState(true);

  const [dropdownIncidents, setDropdownIncidents] = useState<IncidentType[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<IncidentType | null>(null);
  const [dropdownModalVisible, setDropdownModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  const [confirmationModalVisible, setConfirmationModalVisible] = useState(false);
  const [submittedDetails, setSubmittedDetails] = useState<{
    type: string;
    location: string;
    description: string;
  } | null>(null);

  const [locationInput, setLocationInput] = useState('Building 8 2nd Floor');
  const [descriptionInput, setDescriptionInput] = useState('Immediate');

  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const KIOSK_DEFAULT_LOCATION = 'Building 8 2nd Floor';

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

    const loadSensorTemperature = async () => {
      try {
        const data = await fetchLatestSensorData();
        if (data && typeof data.temperature_c === 'number') {
          setTemperature(data.temperature_c);
        }
      } catch (err) {
        console.error('Failed to load live temperature:', err);
      } finally {
        setSensorLoading(false);
      }
    };

    const loadAllIncidentTypes = async () => {
      const dbTypes = await fetchIncidentTypes();
      if (dbTypes && dbTypes.length > 0) {
        const commonNamesLower = new Set(commonIncidentsGrid.map((g) => g.label.toLowerCase()));
        const remainingTypes = dbTypes
          .filter((t: any) => !commonNamesLower.has(t.incident_name.toLowerCase()))
          .map((t: any) => ({
            id: String(t.incident_types_id),
            label: t.incident_name,
          }));
        setDropdownIncidents(remainingTypes);
      }
    };

    loadSensorTemperature();
    loadAllIncidentTypes();

    const sensorInterval = setInterval(loadSensorTemperature, 10000);

    return () => {
      clearInterval(timer);
      clearInterval(sensorInterval);
    };
  }, []);

  const handleImmediateEmergencyReport = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (submitIncidentReport) {
        await submitIncidentReport({
          incident_type: 'Emergency',
          description: 'Immediate',
          location: KIOSK_DEFAULT_LOCATION,
        });
      }
      showToast('🚨 Immediate emergency dispatched!');
      setSubmittedDetails({
        type: 'Emergency',
        location: KIOSK_DEFAULT_LOCATION,
        description: 'Immediate',
      });
      setConfirmationModalVisible(true);
    } catch (err) {
      Alert.alert('Submission Error', err instanceof Error ? err.message : 'Failed to dispatch emergency report.');
    } finally {
      setSubmitting(false);
    }
  };

  const openReportForm = (item: IncidentType) => {
    setSelectedIncident(item);
    setLocationInput(KIOSK_DEFAULT_LOCATION);
    setDescriptionInput('Immediate');
    setDropdownModalVisible(false);
    setReportModalVisible(true);
  };

  const handleSubmitDetailedReport = async () => {
    if (!selectedIncident) return;
    if (!locationInput.trim()) {
      Alert.alert('Required Field', 'Please enter a building or location number.');
      return;
    }

    setSubmitting(true);
    try {
      if (submitIncidentReport) {
        await submitIncidentReport({
          incident_type: selectedIncident.label,
          description: descriptionInput.trim() || 'Immediate',
          location: locationInput.trim(),
        });
      }
      setReportModalVisible(false);
      showToast(`🚨 ${selectedIncident.label} report submitted!`);

      setSubmittedDetails({
        type: selectedIncident.label,
        location: locationInput.trim(),
        description: descriptionInput.trim() || 'Immediate',
      });
      setConfirmationModalVisible(true);
      setSelectedIncident(null);
    } catch (err) {
      Alert.alert('Submission Error', err instanceof Error ? err.message : 'Failed to send incident report.');
    } finally {
      setSubmitting(false);
    }
  };

  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <LinearGradient
      colors={['#F0F6FF', '#E0F2FE', '#BAE6FD']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <ScrollView contentContainerStyle={styles.container}>
        {toastMessage && (
          <View style={styles.toastContainer}>
            <Bell size={16} color="#1E293B" />
            <Text style={styles.toastText}>{toastMessage}</Text>
            <TouchableOpacity onPress={() => setToastMessage(null)}>
              <X size={16} color="#64748B" />
            </TouchableOpacity>
          </View>
        )}

        {/* Telemetry Status Widgets */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Temperature</Text>
            <View style={styles.metricValueBox}>
              <Thermometer size={16} color="#0284C7" />
              <Text style={styles.metricValueText}>
                {sensorLoading ? 'Loading...' : temperature !== null ? `${temperature}°C` : 'N/A'}
              </Text>
            </View>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Time</Text>
            <View style={styles.metricValueBox}>
              <Clock size={16} color="#0284C7" />
              <Text style={styles.metricValueText}>
                {timeString} <Text style={styles.secondsText}>{currentSeconds}</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* Common Incident Section */}
        <View style={styles.sectionHeaderRow}>
          <AlertTriangle size={14} color="#D97706" />
          <Text style={styles.sectionTitle}>Common Incident</Text>
        </View>

        {/* 3x3 Grid */}
        <View style={styles.gridContainer}>
          {commonIncidentsGrid.map((item) => {
            const IconComponent = item.icon;
            const targetObj = { id: item.id, label: item.label };
            const isSelected = selectedIncident?.label === item.label;

            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.gridCard,
                  isSelected && styles.gridCardSelected,
                ]}
                onPress={() => openReportForm(targetObj)}
              >
                <View style={styles.gridIconBox}>
                  <IconComponent size={18} color="#0284C7" />
                </View>
                <Text style={styles.gridCardText} numberOfLines={2}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* List of Accidents Dropdown Button */}
        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => setDropdownModalVisible(true)}
        >
          <Text style={styles.dropdownButtonText} numberOfLines={1}>
            List of Accidents
          </Text>
          <ChevronDown size={18} color="#64748B" />
        </TouchableOpacity>

        {/* Big Red Emergency Report Button */}
        <View style={styles.emergencyButtonWrapper}>
          <TouchableOpacity
            style={[styles.emergencyButton, submitting && styles.buttonDisabled]}
            activeOpacity={0.85}
            disabled={submitting}
            onPress={handleImmediateEmergencyReport}
          >
            <ShieldAlert size={36} color="#ffffff" style={{ marginBottom: 4 }} />
            <Text style={styles.emergencyButtonText}>
              {submitting ? 'DISPATCHING...' : 'Emergency Report'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Modal 1: Dropdown Selection List */}
        <Modal
          visible={dropdownModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setDropdownModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>List of Accidents</Text>
                <TouchableOpacity onPress={() => setDropdownModalVisible(false)}>
                  <X size={20} color="#1E293B" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={dropdownIncidents}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => openReportForm(item)}
                  >
                    <Text style={styles.modalItemTitle}>{item.label}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>

        {/* Modal 2: Report Details Form */}
        <Modal
          visible={reportModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setReportModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.formModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Report: {selectedIncident?.label}
                </Text>
                <TouchableOpacity onPress={() => setReportModalVisible(false)}>
                  <X size={20} color="#1E293B" />
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <MapPin size={14} color="#0284C7" />
                  <Text style={styles.inputLabel}>Building / Location</Text>
                </View>
                <TextInput
                  style={styles.textInput}
                  value={locationInput}
                  onChangeText={setLocationInput}
                  placeholder="e.g. Building 8 2nd Floor"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <FileText size={14} color="#0284C7" />
                  <Text style={styles.inputLabel}>Description of Situation</Text>
                </View>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={descriptionInput}
                  onChangeText={setDescriptionInput}
                  placeholder="Describe what happened or condition..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <TouchableOpacity
                style={[styles.submitReportButton, submitting && styles.buttonDisabled]}
                onPress={handleSubmitDetailedReport}
                disabled={submitting}
              >
                <Send size={16} color="#ffffff" />
                <Text style={styles.submitReportButtonText}>
                  {submitting ? 'Submitting...' : 'Submit Incident Report'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Modal 3: Confirmation Card */}
        <Modal
          visible={confirmationModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setConfirmationModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.refCard}>
              <View style={styles.refIconCircle}>
                <AlertTriangle size={36} color="#ef4444" />
              </View>

              <Text style={styles.refTitle}>Emergency Dispatched</Text>
              <Text style={styles.refSubtitle}>
                An emergency incident has been{'\n'}reported. Our team is on the way.
              </Text>

              <View style={styles.refDivider} />

              {submittedDetails && (
                <View style={styles.refDetailsContainer}>
                  <View style={styles.refRow}>
                    <View style={styles.refIconBox}>
                      <MapPin size={16} color="#2563eb" />
                    </View>
                    <View style={styles.refTextGroup}>
                      <Text style={styles.refLabelText}>Type</Text>
                      <Text style={styles.refValueText} numberOfLines={1}>{submittedDetails.type}</Text>
                    </View>
                  </View>

                  <View style={styles.refRow}>
                    <View style={styles.refIconBox}>
                      <Navigation size={15} color="#2563eb" />
                    </View>
                    <View style={styles.refTextGroup}>
                      <Text style={styles.refLabelText}>Location</Text>
                      <Text style={styles.refValueText} numberOfLines={1}>{submittedDetails.location}</Text>
                    </View>
                  </View>

                  <View style={styles.refRow}>
                    <View style={styles.refIconBox}>
                      <FileText size={15} color="#2563eb" />
                    </View>
                    <View style={styles.refTextGroup}>
                      <Text style={styles.refLabelText}>Description</Text>
                      <Text style={styles.refValueText} numberOfLines={1}>{submittedDetails.description}</Text>
                    </View>
                  </View>

                  <View style={styles.refRow}>
                    <View style={styles.refIconBox}>
                      <Bell size={15} color="#2563eb" />
                    </View>
                    <View style={styles.refTextGroup}>
                      <Text style={styles.refLabelText}>Status</Text>
                      <View style={styles.statusBadge}>
                        <View style={styles.statusDot} />
                        <Text style={styles.statusBadgeText}>Emergency</Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={styles.refButton}
                onPress={() => setConfirmationModalVisible(false)}
              >
                <Text style={styles.refButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  toastContainer: {
    position: 'absolute', top: 10, left: 20, right: 20, zIndex: 99,
    borderRadius: 14, borderWidth: 1, borderColor: '#BAE6FD',
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16,
    gap: 10, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, elevation: 4
  },
  toastText: { fontSize: 13, fontWeight: '600', flex: 1, color: '#1E293B' },
 
  metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  metricCard: {
    flex: 1, borderRadius: 14, borderWidth: 1, borderColor: '#BAE6FD',
    padding: 12, alignItems: 'center', backgroundColor: '#FFFFFF',
    shadowColor: '#BAE6FD', shadowOpacity: 0.2, shadowRadius: 4, elevation: 2
  },
  metricLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4, color: '#64748B' },
  metricValueBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metricValueText: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  secondsText: { color: '#0284C7', fontSize: 11, fontWeight: '700' },
 
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: '#334155' },
 
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginBottom: 16 },
  gridCard: {
    width: '31.5%', borderWidth: 1, borderColor: '#BAE6FD', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center',
    minHeight: 78, backgroundColor: '#FFFFFF',
    shadowColor: '#BAE6FD', shadowOpacity: 0.15, shadowRadius: 3, elevation: 1
  },
  gridCardSelected: { backgroundColor: '#E0F2FE', borderColor: '#0284C7' },
  gridIconBox: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 6, backgroundColor: '#F0F6FF' },
  gridCardText: { fontSize: 11, fontWeight: '600', textAlign: 'center', color: '#1E293B' },
 
  dropdownButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#BAE6FD', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16,
    marginBottom: 16, backgroundColor: '#FFFFFF',
    shadowColor: '#BAE6FD', shadowOpacity: 0.15, shadowRadius: 3, elevation: 1
  },
  dropdownButtonText: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
 
  emergencyButtonWrapper: { alignItems: 'center', justifyContent: 'center', marginVertical: 10 },
  emergencyButton: {
    width: 200, height: 200, borderRadius: 100, backgroundColor: '#dc2626',
    borderWidth: 6, borderColor: '#fca5a560', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#ef4444', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 12
  },
  emergencyButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '900', textAlign: 'center', letterSpacing: 0.5, marginTop: 4 },
  buttonDisabled: { opacity: 0.6 },
 
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', borderRadius: 20, padding: 20, maxHeight: '60%', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#BAE6FD' },
  formModalContent: { width: '100%', borderRadius: 20, padding: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#BAE6FD' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  modalItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalItemTitle: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
 
  inputGroup: { marginBottom: 16 },
  inputLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#334155' },
  textInput: { borderWidth: 1, borderColor: '#BAE6FD', backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1E293B' },
  textArea: { height: 90 },
  submitReportButton: { backgroundColor: '#0284C7', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  submitReportButtonText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },

  // Confirmation Card Styles
  refCard: { width: '100%', maxWidth: 360, backgroundColor: '#ffffff', borderRadius: 32, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, elevation: 15 },
  refIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fef2f2', borderWidth: 2, borderColor: '#fee2e2', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  refTitle: { color: '#0f172a', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  refSubtitle: { color: '#475569', fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  refDivider: { width: '100%', height: 1, backgroundColor: '#f1f5f9', marginBottom: 16 },
  refDetailsContainer: { width: '100%', gap: 14, marginBottom: 22 },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  refIconBox: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  refTextGroup: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  refLabelText: { color: '#64748b', fontSize: 12, fontWeight: '500' },
  refValueText: { color: '#0f172a', fontSize: 14, fontWeight: '700', maxWidth: '65%', textAlign: 'right' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fee2e2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' },
  statusBadgeText: { color: '#ef4444', fontSize: 12, fontWeight: '700' },
  refButton: { width: '100%', minHeight: 50, borderRadius: 25, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', shadowColor: '#2563eb', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  refButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
});