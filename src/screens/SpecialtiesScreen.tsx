import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useRecords } from '@/context/RecordsContext';
import { useRouter } from 'expo-router';
import { v4 as uuidv4 } from 'uuid';
import { claudeService } from '@/services/claudeService';

export default function SpecialtiesScreen() {
  const { records, loading, getUniqueSpecialties, getRecordsBySpecialty, updateUserData } = useRecords();
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [uploadingSpecialty, setUploadingSpecialty] = useState<string | null>(null);
  const [recordText, setRecordText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();
  const { addRecord } = useRecords();

  const defaultSpecialties = [
    'Cardiology',
    'Dermatology',
    'Orthopedics',
    'Neurology',
    'OBGYN',
    'Psychiatry',
    'Ophthalmology',
    'ENT',
    'Gastroenterology',
    'Pulmonology',
    'Rheumatology',
    'Endocrinology',
    'Urology',
    'Oncology',
    'Primary Care',
    'Lab',
    'Dentistry',
  ];

  const specialties = getUniqueSpecialties().length > 0 ? getUniqueSpecialties() : defaultSpecialties;

  const toggleSpecialty = (specialty: string) => {
    setSelectedSpecialties(prev =>
      prev.includes(specialty)
        ? prev.filter(s => s !== specialty)
        : [...prev, specialty]
    );
  };

  const recordsToDisplay = selectedSpecialties.length === 0
    ? []
    : records.filter(record => selectedSpecialties.includes(record.specialty));

  const handleUploadRecord = async () => {
    if (!uploadingSpecialty || !recordText.trim()) {
      Alert.alert('Error', 'Please enter record information');
      return;
    }

    setIsUploading(true);
    try {
      const recordId = uuidv4();
      const parsedRecord = await claudeService.parseRecordFromText(recordText, recordId);

      await addRecord({
        id: recordId,
        uploadDate: parsedRecord.uploadDate || new Date().toISOString(),
        originalText: parsedRecord.originalText,
        specialty: uploadingSpecialty,
        provider: parsedRecord.provider || 'Unknown',
        summary: parsedRecord.summary || 'Medical record',
        extractedData: parsedRecord.extractedData || {},
        processed: true,
        isTeamMember: true,
      });

      setUploadingSpecialty(null);
      setRecordText('');
      Alert.alert('Success', 'Record added to your team!');
    } catch (error) {
      Alert.alert('Error', 'Failed to process record: ' + String(error));
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Get team records (records marked as part of user's team)
  const teamRecords = records.filter(r => r.isTeamMember === true);
  const teamBySpecialty: Record<string, typeof records> = {};
  teamRecords.forEach(record => {
    if (!teamBySpecialty[record.specialty]) {
      teamBySpecialty[record.specialty] = [];
    }
    teamBySpecialty[record.specialty].push(record);
  });

  return (
    <ScrollView style={styles.container}>
      <View style={styles.topBar}>
        <View />
        <Text style={styles.appName}>EasyMedical</Text>
      </View>
      <View style={styles.header}>
        <Text style={styles.title}>My Health Records</Text>
        <Text style={styles.subtitle}>{specialties.length} specialties available</Text>
      </View>

      {/* My Team Section */}
      <View style={styles.teamSection}>
        <Text style={styles.sectionTitle}>👥 My Team</Text>
        {teamRecords.length > 0 ? (
          Object.entries(teamBySpecialty).map(([specialty, docs]) => (
            <View key={specialty} style={styles.teamSpecialtyGroup}>
              <Text style={styles.teamSpecialtyName}>{specialty}</Text>
              {docs.map(doc => (
                <TouchableOpacity
                  key={doc.id}
                  style={styles.teamRecordItem}
                  onPress={() => router.push(`/detail/${doc.id}`)}
                >
                  <View style={styles.teamRecordContent}>
                    <Text style={styles.teamRecordProvider}>{doc.provider}</Text>
                    <Text style={styles.teamRecordMeta}>{doc.summary}</Text>
                  </View>
                  <Text style={styles.recordArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))
        ) : (
          <Text style={styles.teamEmptyText}>Mark doctors as your team to see them here</Text>
        )}
      </View>

      {/* Upload Records Section */}
      <View style={styles.uploadRecordsSection}>
        <Text style={styles.uploadRecordsTitle}>Upload Records</Text>
      </View>

      {/* Specialties for Upload */}
      <View style={styles.uploadSpecialtiesContainer}>
        {[...specialties].sort().map(specialty => (
          <TouchableOpacity
            key={`upload-${specialty}`}
            style={styles.uploadSpecialtyButton}
            onPress={() => setUploadingSpecialty(specialty)}
          >
            <Text style={styles.uploadSpecialtyButtonText}>
              {getSpecialtyEmoji(specialty)} {specialty}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Specialties Filter Header */}
      <View style={styles.filterHeader}>
        <Text style={styles.filterHeaderTitle}>Browse by Specialty</Text>
      </View>

      {/* Specialties Filter */}
      <View style={styles.specialtiesFilterContainer}>
        {[...specialties].sort().map(specialty => {
          const isSelected = selectedSpecialties.includes(specialty);
          return (
            <TouchableOpacity
              key={specialty}
              style={[
                styles.specialtyButtonVertical,
                isSelected && styles.specialtyButtonVerticalSelected
              ]}
              onPress={() => toggleSpecialty(specialty)}
            >
              <Text style={[
                styles.specialtyButtonVerticalText,
                isSelected && styles.specialtyButtonVerticalTextSelected
              ]}>
                {getSpecialtyEmoji(specialty)} {specialty}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Records Display */}
      {selectedSpecialties.length > 0 && (
        <View style={styles.recordsContainer}>
          <Text style={styles.recordsTitle}>
            {recordsToDisplay.length} record{recordsToDisplay.length !== 1 ? 's' : ''} found
          </Text>
          <View style={styles.recordsList}>
            {recordsToDisplay
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
        </View>
      )}

      {selectedSpecialties.length === 0 && (
        <View style={styles.selectPrompt}>
          <Text style={styles.selectPromptText}>Select a specialty above to view records</Text>
        </View>
      )}

      <View style={styles.spacing} />

      {/* Upload Modal */}
      <Modal visible={uploadingSpecialty !== null} animationType="slide" onRequestClose={() => setUploadingSpecialty(null)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Upload {uploadingSpecialty} Record</Text>
            <TouchableOpacity onPress={() => {
              setUploadingSpecialty(null);
              setRecordText('');
            }}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Medical Record Details</Text>
            <Text style={styles.sublabel}>Enter the medical record information, and Claude will extract key details</Text>
            <TextInput
              style={[styles.input, { minHeight: 200 }]}
              placeholder="Paste or type the medical record here..."
              placeholderTextColor="#999"
              value={recordText}
              onChangeText={setRecordText}
              multiline
              editable={!isUploading}
            />
            <TouchableOpacity
              style={[styles.addButton, isUploading && styles.buttonDisabled]}
              onPress={handleUploadRecord}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.addButtonText}>Add to My Team</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

function getSpecialtyEmoji(specialty: string): string {
  const map: Record<string, string> = {
    cardiology: '❤️',
    orthopedics: '🦴',
    dermatology: '🩹',
    neurology: '🧠',
    obgyn: '👶',
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
    paddingTop: 20,
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
  uploadRecordsSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  uploadRecordsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  uploadSpecialtiesContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 8,
  },
  uploadSpecialtyButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#E8E8E8',
  },
  uploadSpecialtyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  filterHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  filterHeaderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  specialtiesFilterContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    marginBottom: 16,
    gap: 8,
  },
  specialtiesScroll: {
    flexGrow: 0,
  },
  specialtyButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E8E8E8',
    marginRight: 8,
  },
  specialtyButtonSelected: {
    backgroundColor: '#000',
  },
  specialtyButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  specialtyButtonTextSelected: {
    color: '#FFF',
  },
  specialtyButtonVertical: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#E8E8E8',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  specialtyButtonVerticalSelected: {
    backgroundColor: '#000',
  },
  specialtyButtonVerticalText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  specialtyButtonVerticalTextSelected: {
    color: '#FFF',
  },
  recordsContainer: {
    paddingHorizontal: 20,
  },
  recordsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  recordsList: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
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
  selectPrompt: {
    marginTop: 40,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  selectPromptText: {
    fontSize: 14,
    color: '#999',
  },
  teamSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  teamSpecialtyGroup: {
    marginBottom: 12,
  },
  teamSpecialtyName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  teamRecordItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  teamRecordContent: {
    flex: 1,
    marginRight: 12,
  },
  teamRecordProvider: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  teamRecordMeta: {
    fontSize: 12,
    color: '#999',
  },
  teamEmptyText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    paddingTop: 50,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  closeButton: {
    fontSize: 24,
    color: '#007AFF',
  },
  modalContent: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  sublabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#CCC',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
