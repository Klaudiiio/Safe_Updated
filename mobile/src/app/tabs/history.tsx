import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native';
import {
  Search,
  Clock,
  MapPin,
  AlertCircle,
  FileText,
  RefreshCw,
} from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../context/ThemeContext';

interface IncidentRecord {
  id: string | number;
  incident_type: string;
  location: string;
  description: string;
  status: string;
  created_at: string;
}

const RAW_API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000';
// Thoroughly clean base URL to prevent duplicate /api or /auth segments
const API_BASE_URL = RAW_API_URL
  .replace(/\/api\/auth\/?$/, '')
  .replace(/\/api\/?$/, '')
  .replace(/\/$/, '');

export default function HistoryScreen() {
  const { session } = useAuth();
  const { isDark } = useTheme();

  const [reports, setReports] = useState<IncidentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch incident history through your Django backend API with a 1-minute timeout protection
  const fetchMyReports = useCallback(async (isRefresh = false) => {
    if (!session?.access) {
      setLoading(false);
      return;
    }

    try {
      if (!isRefresh) {
        setLoading(true);
      }
      setError(null);

      const controller = new AbortController();
      // Extended timeout window to 1 minute (60,000 ms)
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      // Correct path including the /api/auth/ prefix:
      const response = await fetch(`${API_BASE_URL}/api/auth/incidents/`, {
        headers: {
          Authorization: `Bearer ${session.access}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      setReports(Array.isArray(data) ? data : data.results || []);
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        setError('Connection is slow');
      } else {
        setError(err.message || 'Failed to load report history.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  // Automatically fetch reports when navigating into this tab from other tabs
  useFocusEffect(
    useCallback(() => {
      void fetchMyReports();
    }, [fetchMyReports])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    void fetchMyReports(true);
  };

  // Filter list based on search query
  const filteredReports = reports.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      r.incident_type?.toLowerCase().includes(q) ||
      r.location?.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.status?.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status: string) => {
    const s = (status || 'pending').toLowerCase();
    if (s === 'resolved' || s === 'completed') {
      return { bg: '#10b98120', border: '#10b98140', text: '#10b981', label: 'Resolved' };
    }
    if (s === 'responding' || s === 'in_progress' || s === 'active') {
      return { bg: '#f59e0b20', border: '#f59e0b40', text: '#f59e0b', label: 'Responding' };
    }
    return { bg: '#ef444420', border: '#ef444440', text: '#ef4444', label: 'Pending' };
  };

  const dynamicStyles = {
    container: { backgroundColor: isDark ? '#060913' : '#f8fafc' },
    card: { backgroundColor: isDark ? '#0f172a' : '#ffffff', borderColor: isDark ? '#1e293b' : '#e2e8f0' },
    textMain: { color: isDark ? '#ffffff' : '#0f172a' },
    textSub: { color: isDark ? '#94a3b8' : '#64748b' },
    input: { backgroundColor: isDark ? '#0b1322' : '#ffffff', borderColor: isDark ? '#1e293b' : '#cbd5e1', color: isDark ? '#ffffff' : '#0f172a' },
  };

  return (
    <SafeAreaView style={[styles.safeArea, dynamicStyles.container]}>
      <View style={styles.container}>
        {/* Header Title */}
        <View style={styles.headerRow}>
          <Text style={[styles.title, dynamicStyles.textMain]}>Incident History</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn}>
            <RefreshCw size={18} color={isDark ? '#94a3b8' : '#64748b'} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBox}>
          <Search size={18} color={isDark ? '#64748b' : '#94a3b8'} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, dynamicStyles.input]}
            placeholder="Search reports by type, location..."
            placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Content Area */}
        {loading && !refreshing ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={[styles.loadingText, dynamicStyles.textSub]}>Loading your reports (this may take a minute)...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <AlertCircle size={36} color={error === 'Connection is slow' ? '#f59e0b' : '#ef4444'} />
            <Text style={[styles.errorText, error === 'Connection is slow' && styles.warningText]}>
              {error === 'Connection is slow' ? '⚠️ Connection is slow. Please check your network.' : error}
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleRefresh}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : filteredReports.length === 0 ? (
          <View style={styles.centerBox}>
            <FileText size={48} color={isDark ? '#334155' : '#cbd5e1'} />
            <Text style={[styles.emptyText, dynamicStyles.textMain]}>No past reports found</Text>
            <Text style={[styles.emptySub, dynamicStyles.textSub]}>
              Any emergency or incident report submitted will appear here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredReports}
            keyExtractor={(item, idx) => String(item.id || idx)}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#3b82f6" />
            }
            contentContainerStyle={styles.listContainer}
            renderItem={({ item }) => {
              const badge = getStatusBadge(item.status);
              const dateObj = new Date(item.created_at);
              const formattedDate = isNaN(dateObj.getTime())
                ? 'Recently'
                : dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
              const formattedTime = isNaN(dateObj.getTime())
                ? ''
                : dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <View style={[styles.card, dynamicStyles.card]}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.incidentType, dynamicStyles.textMain]}>
                      {item.incident_type || 'General Incident'}
                    </Text>
                    <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                      <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
                    </View>
                  </View>

                  {/* Location */}
                  <View style={styles.detailRow}>
                    <MapPin size={14} color="#3b82f6" />
                    <Text style={[styles.detailText, dynamicStyles.textSub]}>
                      {item.location || 'Location not specified'}
                    </Text>
                  </View>

                  {/* Description */}
                  {Boolean(item.description) && (
                    <Text style={[styles.descriptionText, dynamicStyles.textSub]} numberOfLines={3}>
                      {item.description}
                    </Text>
                  )}

                  {/* Footer / Time */}
                  <View style={styles.cardFooter}>
                    <Clock size={12} color={isDark ? '#64748b' : '#94a3b8'} />
                    <Text style={styles.timeText}>
                      {formattedDate} {formattedTime ? `• ${formattedTime}` : ''}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 16 : 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 'bold' },
  refreshBtn: { padding: 8 },
  searchBox: { position: 'relative', marginBottom: 16 },
  searchIcon: { position: 'absolute', left: 12, top: 14, zIndex: 1 },
  searchInput: { borderWidth: 1, borderRadius: 12, paddingLeft: 40, paddingRight: 16, paddingVertical: 10, fontSize: 14 },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30, marginTop: 40 },
  loadingText: { marginTop: 12, fontSize: 14, textAlign: 'center' },
  errorText: { color: '#ef4444', fontSize: 14, marginTop: 8, textAlign: 'center' },
  warningText: { color: '#f59e0b' },
  retryBtn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#3b82f6', borderRadius: 8 },
  retryText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  emptyText: { fontSize: 16, fontWeight: 'bold', marginTop: 12 },
  emptySub: { fontSize: 13, textAlign: 'center', marginTop: 6 },
  listContainer: { paddingBottom: 30 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  incidentType: { fontSize: 15, fontWeight: 'bold', flex: 1, marginRight: 8 },
  badge: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: 'bold' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  detailText: { fontSize: 13, fontWeight: '500' },
  descriptionText: { fontSize: 13, marginBottom: 12, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 5, borderTopWidth: 1, borderTopColor: '#1e293b20', paddingTop: 8 },
  timeText: { color: '#64748b', fontSize: 11, fontWeight: '500' },
});