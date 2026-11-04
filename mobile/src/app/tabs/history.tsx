import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';
import { Search, Calendar, MapPin, CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

export default function HistoryScreen() {
  const { isDark } = useTheme();
  const [search, setSearch] = useState('');

  const historyList = [
    {
      id: 'INC-9482',
      title: 'Medical Assistance',
      date: '2026-11-01',
      time: '12:36 PM',
      status: 'Resolved',
      category: 'Cardiac Arrest',
      location: 'Building B - Level 3, Room 304',
      severity: 'Critical',
    },
    {
      id: 'INC-8311',
      title: 'Heat Exhaustion',
      date: '2026-10-29',
      time: '02:15 PM',
      status: 'Resolved',
      category: 'Dehydration',
      location: 'Outdoor Athletics Field',
      severity: 'Low',
    },
  ];

  const filteredHistory = historyList.filter(
    item =>
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase()) ||
      item.location.toLowerCase().includes(search.toLowerCase())
  );

  const dynamicStyles = {
    container: { backgroundColor: isDark ? '#060913' : '#f8fafc' },
    card: { backgroundColor: isDark ? '#0f172a' : '#ffffff', borderColor: isDark ? '#1e293b' : '#e2e8f0' },
    textMain: { color: isDark ? '#ffffff' : '#0f172a' },
    textSub: { color: isDark ? '#94a3b8' : '#64748b' },
    input: { backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#ffffff' : '#0f172a', borderColor: isDark ? '#273244' : '#cbd5e1' },
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, dynamicStyles.container]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, dynamicStyles.textMain]}>Incident History</Text>
          <Text style={[styles.subtitle, dynamicStyles.textSub]}>Logged safety broadcasts</Text>
        </View>
      </View>

      <View style={[styles.searchBox, dynamicStyles.input]}>
        <Search size={16} color={isDark ? '#94a3b8' : '#64748b'} />
        <TextInput
          style={[styles.searchInput, dynamicStyles.textMain]}
          placeholder="Search reports by title, location..."
          placeholderTextColor={isDark ? '#68758b' : '#94a3b8'}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {filteredHistory.map(item => (
        <View key={item.id} style={[styles.historyCard, dynamicStyles.card]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.incidentId, dynamicStyles.textSub]}>{item.id}</Text>
            <View style={styles.statusBadge}>
              <CheckCircle2 size={12} color="#10b981" />
              <Text style={styles.statusText}>{item.status}</Text>
            </View>
          </View>
          <Text style={[styles.cardTitle, dynamicStyles.textMain]}>{item.title} ({item.category})</Text>
          <View style={styles.cardDetails}>
            <View style={styles.detailRow}>
              <MapPin size={14} color="#3b82f6" />
              <Text style={[styles.detailText, dynamicStyles.textSub]}>{item.location}</Text>
            </View>
            <View style={styles.detailRow}>
              <Calendar size={14} color="#3b82f6" />
              <Text style={[styles.detailText, dynamicStyles.textSub]}>{item.date} · {item.time}</Text>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 40, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 'bold' },
  subtitle: { fontSize: 12, marginTop: 2 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16, gap: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  historyCard: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  incidentId: { fontSize: 11, fontWeight: 'bold' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10b98115', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, gap: 4 },
  statusText: { color: '#10b981', fontSize: 10, fontWeight: 'bold' },
  cardTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 8 },
  cardDetails: { gap: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 12 },
});