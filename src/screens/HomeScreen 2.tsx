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

export default function HomeScreen() {
  const { records, userData, loading, getAllMedications, getAllAllergies, getRecentResults, updateUserData } = useRecords();
  const router = useRouter();
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editData, setEditData] = useState(userData);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const medications = getAllMedications();
  const allergies = getAllAllergies();
  const recentRecords = getRecentResults(90);

  const handleSaveEdit = async () => {
    try {
      await updateUserData(editData);
      setEditingSection(null);
      Alert.alert('Success', 'Changes saved');
    } catch (error) {
      Alert.alert('Error', 'Failed to save changes');
    }
  };

  const handleCancel = () => {
    setEditData(userData);
    setEditingSection(null);
  };

  return (
    <>
      <ScrollView style={styles.container}>
        <View style={styles.topBar}>
          <View />
          <Text style={styles.appName}>EasyMedical AI</Text>
        </View>

        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => router.push('/upload')}
        >
          <Text style={styles.uploadButtonText}>+ Upload New Record</Text>
        </TouchableOpacity>

        {records.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No records yet</Text>
            <Text style={styles.emptySubtext}>
              Upload medical records to get started
            </Text>
          </View>
        ) : (
          <>
            {medications.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.cardTitle}>Active Medications</Text>
                  <TouchableOpacity onPress={() => {
                    setEditData(userData);
                    setEditingSection('medications');
                  }}>
                    <Text style={styles.editButton}>✏️ Edit</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.card}>
                  <View style={styles.tagContainer}>
                    {medications.map((med, idx) => (
                      <View key={idx} style={styles.tag}>
                        <Text style={styles.tagText}>{med}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {allergies.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.cardTitle}>Allergies</Text>
                  <TouchableOpacity onPress={() => {
                    setEditData(userData);
                    setEditingSection('allergies');
                  }}>
                    <Text style={styles.editButton}>✏️ Edit</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.card}>
                  <View style={styles.tagContainer}>
                    {allergies.map((allergy, idx) => (
                      <View key={idx} style={[styles.tag, styles.allergyTag]}>
                        <Text style={[styles.tagText, styles.allergyText]}>⚠️ {allergy}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {recentRecords.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.cardTitle}>Recent Records</Text>
                <View style={styles.card}>
                  {recentRecords.slice(0, 3).map(record => (
                    <TouchableOpacity
                      key={record.id}
                      style={styles.recordItem}
                      onPress={() => router.push(`/detail/${record.id}`)}
                    >
                      <View>
                        <Text style={styles.recordProvider}>{record.provider}</Text>
                        <Text style={styles.recordSpecialty}>{record.specialty}</Text>
                        <Text style={styles.recordDate}>
                          {new Date(record.uploadDate).toLocaleDateString()}
                        </Text>
                      </View>
                      <Text style={styles.arrow}>›</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.card, styles.linkCard]}
              onPress={() => router.push('/specialties')}
            >
              <Text style={styles.linkText}>View All Records by Specialty →</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.spacing} />
      </ScrollView>

      {/* Edit Modals */}
      {/* Medications Edit Modal */}
      <Modal
        visible={editingSection === 'medications'}
        animationType="slide"
        onRequestClose={handleCancel}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Medications</Text>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <Text style={styles.label}>Medications (one per line)</Text>
            <TextInput
              style={[styles.input, { minHeight: 120 }]}
              multiline
              value={editData.medications?.join('\n') || ''}
              onChangeText={(text) => setEditData({
                ...editData,
                medications: text.split('\n').filter(m => m.trim())
              })}
              placeholder="Medication 1&#10;Medication 2&#10;Medication 3"
            />
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveEdit}>
                <Text style={styles.buttonTextWhite}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Allergies Edit Modal */}
      <Modal
        visible={editingSection === 'allergies'}
        animationType="slide"
        onRequestClose={handleCancel}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Allergies</Text>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <Text style={styles.label}>Allergies (one per line)</Text>
            <TextInput
              style={[styles.input, { minHeight: 120 }]}
              multiline
              value={editData.allergies?.join('\n') || ''}
              onChangeText={(text) => setEditData({
                ...editData,
                allergies: text.split('\n').filter(a => a.trim())
              })}
              placeholder="Allergy 1&#10;Allergy 2"
            />
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveEdit}>
                <Text style={styles.buttonTextWhite}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
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
  uploadButton: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  uploadButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  editButton: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#E8F0FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  allergyTag: {
    backgroundColor: '#FFE8E8',
  },
  allergyText: {
    color: '#FF3333',
  },
  recordItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  recordProvider: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  recordSpecialty: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  recordDate: {
    fontSize: 12,
    color: '#999',
  },
  arrow: {
    fontSize: 20,
    color: '#CCC',
  },
  linkCard: {
    marginBottom: 20,
    backgroundColor: '#F0F8FF',
  },
  linkText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
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
    backgroundColor: '#FFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  closeButton: {
    fontSize: 24,
    color: '#999',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#000',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 30,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  buttonTextWhite: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
