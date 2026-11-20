import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  Linking,
  Platform,
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
  ExternalLink,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioPlayer } from 'expo-audio';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  fetchLatestSensorData,
  fetchIncidentTypes,
  fetchEarthquakesWithSession,
  EarthquakeEvent,
  EarthquakeClassification,
} from '../../lib/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const EARTHQUAKE_POLL_INTERVAL_MS = (() => {
  const configured = Number(process.env.EXPO_PUBLIC_EARTHQUAKE_POLL_MS);
  return Number.isFinite(configured) && configured >= 1000 ? configured : 10_000;
})();

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '') || '/api/auth';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let mobileRealtimeClient: SupabaseClient | null = null;

function getMobileRealtimeClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (!mobileRealtimeClient) {
    mobileRealtimeClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return mobileRealtimeClient;
}

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

function getEventTimestampMs(eq: EarthquakeEvent): number {
  if (typeof eq.time === 'number' && Number.isFinite(eq.time)) return eq.time;
  if (typeof eq.time === 'string') {
    const parsed = Date.parse(eq.time);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (eq.event_occurred_at) {
    const parsed = Date.parse(eq.event_occurred_at);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function getEarthquakeEventId(eq: EarthquakeEvent | null | undefined): string {
  if (!eq) return '';
  return String((eq as any).external_event_id || eq.id || '').trim();
}

function getAlertExpiresAtMs(eq: EarthquakeEvent | null | undefined): number | null {
  const rawExpires = (eq as any)?.alert_expires_at;
  if (!rawExpires) return null;
  const parsed = Date.parse(String(rawExpires));
  return Number.isFinite(parsed) ? parsed : null;
}

function isEarthquakeAlertActive(
  eq: EarthquakeEvent | null | undefined,
  dismissedIds: string[],
  nowMs: number
): boolean {
  if (!eq) return false;
  if (eq.classification !== 'earthquake_alert') return false;
  if (Boolean((eq as any).acknowledged)) return false;
  if ((eq as any).alert_active === false) return false;

  const eventId = getEarthquakeEventId(eq);
  if (eventId && dismissedIds.includes(eventId)) return false;

  const expiresAtMs = getAlertExpiresAtMs(eq);
  if (expiresAtMs === null) return false;

  return nowMs < expiresAtMs;
}

function formatClassificationLabel(classification?: EarthquakeClassification): string {
  switch (classification) {
    case 'earthquake_alert':
      return 'Earthquake Alert';
    case 'advisory':
      return 'Advisory';
    default:
      return 'Monitoring';
  }
}

function normalizeRealtimeEarthquakeRow(row: any): EarthquakeEvent | null {
  if (!row || typeof row !== 'object') return null;
  const eventId = String(
    row.external_event_id || row.earthquake_event_id || row.id || ''
  ).trim();
  if (!eventId) return null;

  const rawClass = String(row.classification || '').trim().toLowerCase();
  const classification: EarthquakeClassification =
    rawClass === 'earthquake_alert' || rawClass === 'advisory' || rawClass === 'monitoring'
      ? rawClass
      : 'earthquake_alert';

  const parsedMag =
    typeof row.magnitude === 'number'
      ? row.magnitude
      : row.magnitude != null && row.magnitude !== ''
      ? Number(row.magnitude)
      : null;

  const parsedDepth =
    typeof row.depth_km === 'number'
      ? row.depth_km
      : row.depth_km != null && row.depth_km !== ''
      ? Number(row.depth_km)
      : null;

  const parsedDist =
    typeof row.distance_from_cdo_km === 'number'
      ? row.distance_from_cdo_km
      : row.distance_from_cdo_km != null && row.distance_from_cdo_km !== ''
      ? Number(row.distance_from_cdo_km)
      : 0;

  const occurredAt = row.event_occurred_at || row.created_at || new Date().toISOString();

  return {
    id: eventId,
    external_event_id: row.external_event_id || eventId,
    magnitude: Number.isFinite(parsedMag as number) ? parsedMag : null,
    place: String(row.place || row.location || 'Regional Seismic Zone'),
    time: occurredAt,
    event_occurred_at: occurredAt,
    url: row.url || 'https://www.phivolcs.dost.gov.ph/',
    depth_km: Number.isFinite(parsedDepth as number) ? parsedDepth : null,
    distance_from_cdo_km: Number.isFinite(parsedDist) ? parsedDist : 0,
    reported_intensity: row.reported_intensity ?? null,
    classification,
    source: String(row.source || 'PHIVOLCS'),
    alert_detected_at: row.alert_detected_at ?? null,
    alert_expires_at: row.alert_expires_at ?? null,
    alert_active: typeof row.alert_active === 'boolean' ? row.alert_active : undefined,
    acknowledged: Boolean(row.acknowledged),
  } as EarthquakeEvent;
}

export default function HomeScreen() {
  const { session, submitIncidentReport, updateSession } = useAuth();
  const { isDark } = useTheme();

  const [now, setNow] = useState(() => new Date());
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [currentSeconds, setCurrentSeconds] = useState('00');
  const [temperature, setTemperature] = useState<number | null>(null);
  const [sensorLoading, setSensorLoading] = useState(true);

  // Expo push token & subscription state
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [realtimeSubscribed, setRealtimeSubscribed] = useState(false);

  // Earthquake feed state (keeps full history; active alerts are filtered dynamically)
  const [earthquakes, setEarthquakes] = useState<EarthquakeEvent[]>([]);
  const [dismissedQuakeIds, setDismissedQuakeIds] = useState<string[]>([]);

  // Set to track IDs that have already played sound to prevent repeats across renders/refreshes
  const playedAlertIdsRef = useRef<Set<string>>(new Set());

  // Initialize audio player using expo-audio (SDK 58 compatible)
  const player = useAudioPlayer(require('../../../assets/alert.mp3'));

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

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const stopAlertSiren = useCallback(() => {
    try {
      player.pause();
      player.seekTo(0);
    } catch (err) {
      console.warn('Error stopping alert sound:', err);
    }
  }, [player]);

  const upsertRealtimeEarthquake = useCallback((rawRow: any) => {
    const normalized = normalizeRealtimeEarthquakeRow(rawRow);
    if (!normalized) return;

    const normalizedId = getEarthquakeEventId(normalized);
    const isActiveAlert = isEarthquakeAlertActive(normalized, [], Date.now());
    if (normalized.classification === 'earthquake_alert' && isActiveAlert && normalizedId) {
      setDismissedQuakeIds((prev) => prev.filter((id) => id !== normalizedId));
    }

    setEarthquakes((previous) => {
      const filtered = previous.filter(
        (ev) =>
          getEarthquakeEventId(ev) !== normalizedId &&
          ev.id !== normalized.id &&
          (ev as any).external_event_id !== normalized.id
      );
      return [normalized, ...filtered].sort(
        (a, b) => getEventTimestampMs(b) - getEventTimestampMs(a)
      );
    });
  }, []);

  // Register Expo push token & handle incoming push notifications
  useEffect(() => {
    let isMounted = true;

    const registerPushToken = async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('emergency-alerts', {
            name: 'Emergency Alerts',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#DC2626',
            sound: 'earthquake-alert.mp3',
          });
        }

        if (!Device.isDevice) {
          return;
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          return;
        }

        const projectId =
          Constants?.expoConfig?.extra?.eas?.projectId ??
          (Constants as any)?.easConfig?.projectId;

        if (!projectId || projectId === 'YOUR_EAS_PROJECT_ID') {
          return;
        }

        const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = tokenResponse?.data;
        if (!token || !isMounted) return;

        setExpoPushToken(token);

        if (session?.access) {
          try {
            await fetch(`${API_BASE_URL}/push-tokens/register/`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access}`,
              },
              body: JSON.stringify({
                expo_push_token: token,
                platform: Platform.OS,
              }),
            });
          } catch {
            // Backend push token registration endpoint is optional if handled elsewhere
          }
        }
      } catch (pushErr) {
        console.warn('Expo push registration skipped or failed:', pushErr);
      }
    };

    void registerPushToken();

    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification?.request?.content?.data as Record<string, any> | undefined;
      if (
        data &&
        (data.classification === 'earthquake_alert' ||
          data.type === 'earthquake_alert' ||
          data.external_event_id ||
          data.earthquake_event_id)
      ) {
        upsertRealtimeEarthquake({
          ...data,
          id:
            data.external_event_id ||
            data.earthquake_event_id ||
            notification?.request?.identifier,
          classification: data.classification || 'earthquake_alert',
        });
      }
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data as Record<string, any> | undefined;
      if (
        data &&
        (data.classification === 'earthquake_alert' ||
          data.type === 'earthquake_alert' ||
          data.external_event_id ||
          data.earthquake_event_id)
      ) {
        upsertRealtimeEarthquake({
          ...data,
          id:
            data.external_event_id ||
            data.earthquake_event_id ||
            response?.notification?.request?.identifier,
          classification: data.classification || 'earthquake_alert',
        });
      }
    });

    return () => {
      isMounted = false;
      receivedSub.remove();
      responseSub.remove();
    };
  }, [session?.access, upsertRealtimeEarthquake]);

  // Subscribe to real-time earthquake alerts via Supabase Realtime
  useEffect(() => {
    const rtClient = getMobileRealtimeClient();
    if (!rtClient) return;

    if (session?.supabase_access_token) {
      rtClient.realtime.setAuth(session.supabase_access_token);
    }

    const channelId = `safe-user-quake-${Math.random().toString(36).slice(2, 9)}`;

    const quakeChannel = rtClient
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'earthquake_monitoring',
        },
        (payload: any) => {
          if (payload?.eventType === 'DELETE') {
            const oldId = String(
              payload?.old?.external_event_id || payload?.old?.id || ''
            );
            if (oldId) {
              setEarthquakes((prev) => prev.filter((ev) => ev.id !== oldId));
            }
            return;
          }
          upsertRealtimeEarthquake(payload?.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification',
        },
        (payload: any) => {
          const row = payload?.new as Record<string, any> | undefined;
          if (
            row &&
            (String(row.type || '').toLowerCase() === 'earthquake_alert' ||
              String(row.classification || '').toLowerCase() === 'earthquake_alert' ||
              row.earthquake_event_id)
          ) {
            upsertRealtimeEarthquake({
              ...row,
              id: row.earthquake_event_id || row.external_event_id || row.id,
              classification: row.classification || 'earthquake_alert',
            });
          }
        }
      )
      .subscribe((status: string) => {
        setRealtimeSubscribed(status === 'SUBSCRIBED');
      });

    return () => {
      setRealtimeSubscribed(false);
      void rtClient.removeChannel(quakeChannel);
    };
  }, [session?.supabase_access_token, upsertRealtimeEarthquake]);

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setNow(d);
      setNowMs(d.getTime());
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

    const loadEarthquakeFeed = async () => {
      if (!session) return;
      try {
        const res = await fetchEarthquakesWithSession(session);
        const events = res.events || [];
        setEarthquakes(events);
        setNowMs(Date.now());

        if (
          res.session &&
          updateSession &&
          (res.session.access !== session.access ||
            res.session.refresh !== session.refresh ||
            res.session.supabase_access_token !== session.supabase_access_token)
        ) {
          await updateSession(res.session);
        }
      } catch (err) {
        console.error('Failed to load earthquake feed:', err);
      }
    };

    loadSensorTemperature();
    loadAllIncidentTypes();
    loadEarthquakeFeed();

    const sensorInterval = setInterval(loadSensorTemperature, 10000);
    const earthquakeInterval = setInterval(loadEarthquakeFeed, EARTHQUAKE_POLL_INTERVAL_MS);

    return () => {
      clearInterval(timer);
      clearInterval(sensorInterval);
      clearInterval(earthquakeInterval);
    };
  }, [session, updateSession]);

  // Keep full history in `earthquakes`; only filter active alerts by server `alert_expires_at`
  const activeEarthquakeAlerts = earthquakes.filter((eq) =>
    isEarthquakeAlertActive(eq, dismissedQuakeIds, nowMs)
  );

  const latestAlert = activeEarthquakeAlerts.length > 0 ? activeEarthquakeAlerts[0] : null;
  const latestAlertId = getEarthquakeEventId(latestAlert);
  const reportUrl = (latestAlert as any)?.url || (latestAlert as any)?.detail_url || '';

  // Start siren once per active alert ID; stop modal & siren immediately when expired or dismissed
  useEffect(() => {
    if (!latestAlert || !latestAlertId) {
      stopAlertSiren();
      return;
    }

    if (!playedAlertIdsRef.current.has(latestAlertId)) {
      playedAlertIdsRef.current.add(latestAlertId);
      try {
        player.seekTo(0);
        player.play();
      } catch (audioErr) {
        console.warn('Error playing earthquake alert sound:', audioErr);
      }
    }

    return () => {
      stopAlertSiren();
    };
  }, [latestAlert, latestAlertId, player, stopAlertSiren]);

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

        {/* Centered Modal Earthquake Warning Card */}
        <Modal
          visible={Boolean(latestAlert)}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {}}
        >
          {latestAlert && (
            <View style={styles.centeredModalOverlay}>
              <View style={styles.quakeCenteredCard}>
                <View style={styles.quakeIconCircle}>
                  <AlertTriangle size={42} color="#EF4444" />
                </View>

                <Text style={styles.quakeClassificationBadge}>
                  {formatClassificationLabel(latestAlert.classification).toUpperCase()}
                </Text>

                <Text style={styles.quakeModalTitle}>EARTHQUAKE ALERT!</Text>

                <Text style={styles.quakeMagnitudeText}>
                  {latestAlert.magnitude !== null ? `Mag ${latestAlert.magnitude.toFixed(1)} — ` : ''}
                  {latestAlert.place}
                </Text>
                <Text style={styles.quakeMetaText}>
                  {latestAlert.distance_from_cdo_km !== null ? `${latestAlert.distance_from_cdo_km} km from USTP CDO` : 'PHIVOLCS Bulletin'}
                  {' | Depth: '}
                  {latestAlert.depth_km !== null ? `${latestAlert.depth_km} km` : '—'}
                  {latestAlert.reported_intensity ? ` | Intensity ${latestAlert.reported_intensity}` : ''}
                </Text>

                <View style={styles.quakeModalDivider} />

                <View style={styles.quakeInstructionsBox}>
                  <Text style={styles.quakeInstructionHeader}>DROP, COVER, AND HOLD ON</Text>
                  <Text style={styles.quakeInstructionBody}>
                    Drop to your hands and knees; take cover under sturdy furniture and protect your head and neck; hold on until the shaking stops.
                  </Text>
                </View>

                {reportUrl ? (
                  <TouchableOpacity
                    style={styles.quakeLinkBtn}
                    onPress={() => Linking.openURL(reportUrl)}
                  >
                    <Text style={styles.quakeLinkText}>View PHIVOLCS Report</Text>
                    <ExternalLink size={12} color="#60A5FA" />
                  </TouchableOpacity>
                ) : null}

                <View style={styles.quakeButtonRow}>
                  <TouchableOpacity
                    style={styles.quakeDismissActionBtn}
                    onPress={() => {
                      if (latestAlert) {
                        stopAlertSiren();
                        const targetId = getEarthquakeEventId(latestAlert);
                        if (targetId) {
                          setDismissedQuakeIds((prev) =>
                            prev.includes(targetId) ? prev : [...prev, targetId]
                          );
                        }
                      }
                    }}
                  >
                    <Text style={styles.quakeDismissText}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </Modal>

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

  // Centered Modal Earthquake Warning Card Styles (Red Emergency Theme)
  centeredModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  quakeCenteredCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#1E293B',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#EF4444',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  quakeIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF2F2',
    borderWidth: 2,
    borderColor: '#FCA5A5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  quakeClassificationBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FBBF24',
    backgroundColor: 'rgba(127, 29, 29, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  quakeModalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#EF4444',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  quakeMagnitudeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  quakeMetaText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 16,
  },
  quakeModalDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#334155',
    marginBottom: 16,
  },
  quakeInstructionsBox: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  quakeInstructionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F87171',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  quakeInstructionBody: {
    fontSize: 12,
    fontWeight: '500',
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 18,
  },
  quakeLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  quakeLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#60A5FA',
    textDecorationLine: 'underline',
  },
  quakeButtonRow: {
    width: '100%',
  },
  quakeDismissActionBtn: {
    width: '100%',
    minHeight: 46,
    borderRadius: 23,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC2626',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  quakeDismissText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

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
  refDetailsContainer: { width: '100%', gap: 14, marginBottom: 20 },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  refIconBox: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  refTextGroup: { flex: 1 },
  refLabelText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  refValueText: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  statusBadgeText: { fontSize: 13, fontWeight: '800', color: '#dc2626' },
  refButton: { width: '100%', paddingVertical: 14, borderRadius: 16, backgroundColor: '#0284c7', alignItems: 'center' },
  refButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
});