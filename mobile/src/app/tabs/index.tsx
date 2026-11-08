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
} from 'lucide-react-native';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { fetchLatestSensorData, fetchIncidentTypes } from '../../lib/api';

interface IncidentType {
  id: string;
  label: string;
}

// 9 Common Incidents Grid
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
  const { submitIncidentReport, submitEmergencyReport } = useAuth();
  const { isDark } = useTheme();

  // Telemetry & Time State
  const [now, setNow] = useState(() => new Date());
  const [currentSeconds, setCurrentSeconds] = useState('00');
  const [temperature, setTemperature] = useState<number | null>(null);
  const [sensorLoading, setSensorLoading] = useState(true);

  // Incidents State
  const [dropdownIncidents, setDropdownIncidents] = useState<IncidentType[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<IncidentType | null>(null);
  const [dropdownModalVisible, setDropdownModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  // Form Input State for Specific Incident Reporting
  const [locationInput, setLocationInput] = useState('Building 9, 3rd floor');
  const [descriptionInput, setDescriptionInput] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const KIOSK_DEFAULT_LOCATION = 'Building 9, 3rd floor';

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
          .filter((t) => !commonNamesLower.has(t.incident_name.toLowerCase()))
          .map((t) => ({
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

  // 1. Instant Emergency Report (One Tap, Hardcoded with exact specs)
  const handleImmediateEmergencyReport = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await submitEmergencyReport();
      showToast('🚨 Immediate emergency dispatched!');
      Alert.alert(
        'Emergency Dispatched',
        'Type: emergency\nLocation: Building 9 3rd Floor\nDescription: Immediate emergency needed\n\nClinic staff and emergency responders have been alerted.',
        [{ text: 'OK' }]
      );
    } catch (err) {
      Alert.alert('Submission Error', err instanceof Error ? err.message : 'Failed to dispatch emergency report.');
    } finally {
      setSubmitting(false);
    }
  };

  // Trigger modal when an incident from Grid or Dropdown is clicked
  const openReportForm = (item: IncidentType) => {
    setSelectedIncident(item);
    setLocationInput(KIOSK_DEFAULT_LOCATION);
    setDescriptionInput('');
    setDropdownModalVisible(false);
    setReportModalVisible(true);
  };

  // 2. Submit Detailed Incident Report (With Building & Description)
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
          description: descriptionInput.trim() || 'No additional details provided.',
          location: locationInput.trim(),
        } as any);
      }
      setReportModalVisible(false);
      showToast(`🚨 ${selectedIncident.label} report submitted!`);
      Alert.alert(
        'Report Submitted',
        `Incident: ${selectedIncident.label}\nLocation: ${locationInput.trim()}\nDescription: ${descriptionInput.trim() || 'N/A'}\n\nClinic team notified.`,
        [{ text: 'OK', onPress: () => setSelectedIncident(null) }]
      );
    } catch (err) {
      Alert.alert('Submission Error', err instanceof Error ? err.message : 'Failed to send incident report.');
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
    dropdownBox: { backgroundColor: isDark ? '#0b1322' : '#ffffff', borderColor: isDark ? '#1e293b' : '#e2e8f0' },
    input: { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', color: isDark ? '#ffffff' : '#0f172a', borderColor: isDark ? '#334155' : '#cbd5e1' },
  };

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

      {/* Telemetry Status Widgets */}
      <View style={styles.metricsRow}>
        <View style={[styles.metricCard, dynamicStyles.card]}>
          <Text style={[styles.metricLabel, dynamicStyles.textSub]}>Temperature</Text>
          <View style={styles.metricValueBox}>
            <Thermometer size={16} color="#38bdf8" />
            <Text style={[styles.metricValueText, dynamicStyles.textMain]}>
              {sensorLoading ? 'Loading...' : temperature !== null ? `${temperature}°C` : 'N/A'}
            </Text>
          </View>
        </View>

        <View style={[styles.metricCard, dynamicStyles.card]}>
          <Text style={[styles.metricLabel, dynamicStyles.textSub]}>Time</Text>
          <View style={styles.metricValueBox}>
            <Clock size={16} color="#3b82f6" />
            <Text style={[styles.metricValueText, dynamicStyles.textMain]}>
              {timeString} <Text style={styles.secondsText}>{currentSeconds}</Text>
            </Text>
          </View>
        </View>
      </View>

      {/* Common Incident Section */}
      <View style={styles.sectionHeaderRow}>
        <AlertTriangle size={14} color="#f59e0b" />
        <Text style={[styles.sectionTitle, dynamicStyles.textSub]}>Common Incident</Text>
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
                dynamicStyles.gridCard,
                isSelected && styles.gridCardSelected,
              ]}
              onPress={() => openReportForm(targetObj)}
            >
              <View style={[styles.gridIconBox, { backgroundColor: isDark ? '#1e293b80' : '#f1f5f9' }]}>
                <IconComponent size={18} color={isDark ? '#94a3b8' : '#475569'} />
              </View>
              <Text style={[styles.gridCardText, dynamicStyles.gridText]} numberOfLines={2}>
                {item.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List of Accidents Dropdown Button */}
      <TouchableOpacity
        style={[styles.dropdownButton, dynamicStyles.dropdownBox]}
        onPress={() => setDropdownModalVisible(true)}
      >
        <Text style={[styles.dropdownButtonText, dynamicStyles.gridText]} numberOfLines={1}>
          List of Accidents
        </Text>
        <ChevronDown size={18} color={isDark ? '#94a3b8' : '#64748b'} />
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
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.textMain]}>List of Accidents</Text>
              <TouchableOpacity onPress={() => setDropdownModalVisible(false)}>
                <X size={20} color={isDark ? '#ffffff' : '#0f172a'} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={dropdownIncidents}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, { borderBottomColor: isDark ? '#1e293b' : '#e2e8f0' }]}
                  onPress={() => openReportForm(item)}
                >
                  <Text style={[styles.modalItemTitle, dynamicStyles.textMain]}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Modal 2: Report Details Form (Building # & Description) */}
      <Modal
        visible={reportModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.formModalContent, { backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.textMain]}>
                Report: {selectedIncident?.label}
              </Text>
              <TouchableOpacity onPress={() => setReportModalVisible(false)}>
                <X size={20} color={isDark ? '#ffffff' : '#0f172a'} />
              </TouchableOpacity>
            </View>

            {/* Building Location Input */}
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <MapPin size={14} color="#3b82f6" />
                <Text style={[styles.inputLabel, dynamicStyles.textSub]}>Building / Location</Text>
              </View>
              <TextInput
                style={[styles.textInput, dynamicStyles.input]}
                value={locationInput}
                onChangeText={setLocationInput}
                placeholder="e.g. Building 9, 3rd floor"
                placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              />
            </View>

            {/* Situation Description Input */}
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <FileText size={14} color="#3b82f6" />
                <Text style={[styles.inputLabel, dynamicStyles.textSub]}>Description of Situation</Text>
              </View>
              <TextInput
                style={[styles.textInput, styles.textArea, dynamicStyles.input]}
                value={descriptionInput}
                onChangeText={setDescriptionInput}
                placeholder="Describe what happened or condition of student..."
                placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Submit Button */}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  toastContainer: { position: 'absolute', top: 10, left: 20, right: 20, zIndex: 99, borderRadius: 14, borderWidth: 1, borderColor: '#38bdf840', flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 6 },
  toastText: { fontSize: 13, fontWeight: '600', flex: 1 },
  metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  metricCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: 'center' },
  metricLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  metricValueBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metricValueText: { fontSize: 15, fontWeight: '800' },
  secondsText: { color: '#0284c7', fontSize: 11, fontWeight: '700' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginBottom: 16 },
  gridCard: { width: '31.5%', borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', minHeight: 78 },
  gridCardSelected: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
  gridIconBox: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  gridCardText: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  dropdownButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 16 },
  dropdownButtonText: { fontSize: 13, fontWeight: '600' },
  emergencyButtonWrapper: { alignItems: 'center', justifyContent: 'center', marginVertical: 10 },
  emergencyButton: { width: 200, height: 200, borderRadius: 100, backgroundColor: '#dc2626', borderWidth: 6, borderColor: '#fca5a560', alignItems: 'center', justifyContent: 'center', shadowColor: '#ef4444', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 12 },
  emergencyButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '900', textAlign: 'center', letterSpacing: 0.5, marginTop: 4 },
  buttonDisabled: { opacity: 0.6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '60%' },
  formModalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, width: '100%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: 'bold' },
  modalItem: { paddingVertical: 14, borderBottomWidth: 1 },
  modalItemTitle: { fontSize: 14, fontWeight: '600' },
  inputGroup: { marginBottom: 16 },
  inputLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  inputLabel: { fontSize: 12, fontWeight: '600' },
  textInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textArea: { height: 90 },
  submitReportButton: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  submitReportButtonText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
});