import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRecords } from '@/context/RecordsContext';
import { useRouter } from 'expo-router';

export default function SpecialtiesScreen() {
  const { records, loading, getUniqueSpecialties, getRecordsBySpecialty } = useRecords();
  const [expandedSpecialty, setExpandedSpecialty] = useState<string | null>(null);
  const router = useRouter();

  const specialties = getUniqueSpecialties();

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (records.length === 0) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.topBar}>
          <View />
          <Text style={styles.appName}>EasyMedical</Text>
        </View>
        <View style={styles.header}>
          <Text style={styles.title}>By Specialty</Text>
          <Text style={styles.subtitle}>Organize records by medical specialty</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No records yet</Text>
          <Text style={styles.emptySubtext}>Upload records to organize them by specialty</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.topBar}>
        <View />
        <Text style={styles.appName}>EasyMedical</Text>
      </View>
      <View style={styles.header}>
        <Text style={styles.title}>By Specialty</Text>
        <Text style={styles.subtitle}>{specialties.length} specialties • {records.length} records</Text>
      </View>

      <View style={styles.specialtiesContainer}>
        {specialties.map(specialty => {
          const specializationRecords = getRecordsBySpecialty(specialty);
          const isExpanded = expandedSpecialty === specialty;
          const uniqueProviders = new Set(specializationRecords.map(r => r.provider));

          return (
            <View key={specialty} style={styles.specialtySection}>
              <TouchableOpacity
                style={styles.specialtyHeader}
                onPress={() => setExpandedSpecialty(isExpanded ? null : specialty)}
              >
                <View style={styles.specialtyInfo}>
                  <View style={styles.specialtyBadge}>
                    <Text style={styles.specialtyEmoji}>{getSpecialtyEmoji(specialty)}</Text>
                  </View>
                  <View>
                    <Text style={styles.specialtyName}>{specialty}</Text>
                    <Text style={styles.specialtyMeta}>
                      {uniqueProviders.size} provider{uniqueProviders.size !== 1 ? 's' : ''} • {specializationRecords.length} record{specializationRecords.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.arrow, { transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }]}>
                  ▼
                </Text>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.recordsList}>
                  {specializationRecords
                    .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())
                    .map(record => (
                      <TouchableOpacity
                        key={record.id}
                        style={styles.recordItem}
                        onPress={() => router.push(`/detail/${record.id}`)}
                      >
                        <View style={styles.recordContent}>
                          <Text style={styles.recordProvider}>{record.provider}</Text>
                          <Text numberOfLines={2} style={styles.recordSummary}>
                            {record.summary}
                          </Text>
                          <Text style={styles.recordDate}>
                            {new Date(record.uploadDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </Text>
                        </View>
                        <Text style={styles.recordArrow}>›</Text>
                      </TouchableOpacity>
                    ))}
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.spacing} />
    </ScrollView>
  );
}

function getSpecialtyEmoji(specialty: string): string {
  const map: Record<string, string> = {
    cardiology: '❤️',
    orthopedics: '🦴',
    dermatology: '🩹',
    neurology: '🧠',
    ophthalmology: '👁️',
    oncology: '🏥',
    lab: '🔬',
    pharmacy: '💊',
    'primary care': '👨‍⚕️',
    dentistry: '🦷',
    psychiatry: '💭',
    urology: '🔴',
  };

  const key = specialty.toLowerCase();
  return map[key] || '📋';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  header: {
    padding: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  specialtiesContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  specialtySection: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  specialtyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  specialtyInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  specialtyBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  specialtyEmoji: {
    fontSize: 24,
  },
  specialtyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  specialtyMeta: {
    fontSize: 12,
    color: '#999',
  },
  arrow: {
    fontSize: 16,
    color: '#CCC',
  },
  recordsList: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  recordItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  recordContent: {
    flex: 1,
    marginRight: 12,
  },
  recordProvider: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  recordSummary: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
    lineHeight: 18,
  },
  recordDate: {
    fontSize: 12,
    color: '#999',
  },
  recordArrow: {
    fontSize: 18,
    color: '#CCC',
  },
  emptyState: {
    marginTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
  },
  spacing: {
    height: 100,
  },
});
