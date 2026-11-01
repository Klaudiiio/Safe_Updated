import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

export default function HistoryScreen() {
  const [subTab, setSubTab] = useState<'my' | 'all'>('my');

  const myReports = [
    { id: '1', title: 'Medical Assistance', date: '2026-11-01', status: 'Resolved' },
  ];
  const allReports = [
    { id: '1', title: 'Medical Assistance', author: 'clyde', date: '2026-11-01', status: 'Resolved' },
    { id: '2', title: 'Fire Hazard Near Gate', author: 'johndoe', date: '2026-10-30', status: 'Pending' },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Incident History</Text>
     
      <View style={styles.subTabContainer}>
        <TouchableOpacity
          style={[styles.subTabButton, subTab === 'my' && styles.activeSubTab]}
          onPress={() => setSubTab('my')}
        >
          <Text style={[styles.subTabText, subTab === 'my' && styles.activeSubText]}>My Reports</Text>
        </TouchableOpacity>
       
        <TouchableOpacity
          style={[styles.subTabButton, subTab === 'all' && styles.activeSubTab]}
          onPress={() => setSubTab('all')}
        >
          <Text style={[styles.subTabText, subTab === 'all' && styles.activeSubText]}>All Reports (7 Days)</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.listContainer}>
        {subTab === 'my' ? (
          myReports.length === 0 ? (
            <Text style={styles.emptyText}>You haven't submitted any reports yet.</Text>
          ) : (
            myReports.map((report) => (
              <View key={report.id} style={styles.card}>
                <Text style={styles.cardTitle}>{report.title}</Text>
                <Text style={styles.cardDate}>
                  {report.date} • <Text style={{ color: '#22C55E', fontWeight: '600' }}>{report.status}</Text>
                </Text>
              </View>
            ))
          )
        ) : (
          allReports.length === 0 ? (
            <Text style={styles.emptyText}>No reports found in the last 7 days.</Text>
          ) : (
            allReports.map((report) => (
              <View key={report.id} style={styles.card}>
                <Text style={styles.cardTitle}>
                  {report.title} <Text style={{ fontSize: 12, color: '#9CA3AF' }}>(By: {report.author})</Text>
                </Text>
                <Text style={styles.cardDate}>
                  {report.date} • <Text style={{ color: '#FACC15', fontWeight: '600' }}>{report.status}</Text>
                </Text>
              </View>
            ))
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080a0f', paddingTop: 60, paddingHorizontal: 16 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 16 },
  subTabContainer: { flexDirection: 'row', backgroundColor: '#0F1825', borderRadius: 8, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: '#1F2937' },
  subTabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  activeSubTab: { backgroundColor: '#3B82F6' },
  subTabText: { color: '#9CA3AF', fontWeight: '600', fontSize: 13 },
  activeSubText: { color: '#FFFFFF' },
  listContainer: { paddingBottom: 20 },
  card: { backgroundColor: '#0F1825', padding: 16, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#1F2937' },
  cardTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  cardDate: { color: '#9CA3AF', fontSize: 12, marginTop: 4 },
  emptyText: { color: '#9CA3AF', textAlign: 'center', marginTop: 40 },
});