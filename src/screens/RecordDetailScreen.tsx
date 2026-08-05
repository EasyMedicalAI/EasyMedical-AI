import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useRecords } from '@/context/RecordsContext';
import { MedicalRecord } from '@/types/medical';

interface RecordDetailScreenProps {
  record: MedicalRecord;
  onBack?: () => void;
}

export default function RecordDetailScreen({ record, onBack }: RecordDetailScreenProps) {
  const { deleteRecord, updateRecord } = useRecords();
  const [editingReason, setEditingReason] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [reasonText, setReasonText] = useState('');
  const [notesText, setNotesText] = useState('');

  if (!record) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Record not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleEditReason = () => {
    setReasonText(record.reasonForVisit || '');
    setEditingReason(true);
  };

  const handleSaveReason = async () => {
    await updateRecord({ ...record, reasonForVisit: reasonText });
    setEditingReason(false);
  };

  const handleEditNotes = () => {
    setNotesText(record.notes || '');
    setEditingNotes(true);
  };

  const handleSaveNotes = async () => {
    await updateRecord({ ...record, notes: notesText });
    setEditingNotes(false);
  };

  const handleDelete = () => {
    Alert.alert('Delete Record', 'Are you sure you want to delete this record?', [
      {
        text: 'Cancel',
        onPress: () => {},
      },
      {
        text: 'Delete',
        onPress: async () => {
          await deleteRecord(record.id);
          onBack?.();
        },
        style: 'destructive',
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backArrow}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete}>
          <Text style={styles.deleteButton}>Delete</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.specialty}>{record.specialty}</Text>
          <Text style={styles.provider}>{record.provider}</Text>
        </View>

        {/* Image */}
        {record.imageUri && (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: record.imageUri }}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
        )}

        {/* Summary Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <Text style={styles.summaryText}>{record.summary}</Text>
        </View>

        {/* Formatted Data Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Record Details</Text>
          <View style={styles.dataTable}>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Date</Text>
              <Text style={styles.dataValue}>
                {new Date(record.appointmentDate || record.uploadDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </View>
            <View style={[styles.dataRow, styles.dataRowBorder]}>
              <Text style={styles.dataLabel}>Provider</Text>
              <Text style={styles.dataValue}>{record.provider}</Text>
            </View>
            <View style={[styles.dataRow, styles.dataRowBorder]}>
              <Text style={styles.dataLabel}>Reason</Text>
              <Text style={styles.dataValue}>{record.reasonForVisit || '—'}</Text>
            </View>
            <View style={[styles.dataRow, styles.dataRowBorder]}>
              <Text style={styles.dataLabel}>Findings</Text>
              <Text style={styles.dataValue}>{record.findings || '—'}</Text>
            </View>
            <View style={[styles.dataRow, styles.dataRowBorder]}>
              <Text style={styles.dataLabel}>Next Steps</Text>
              <Text style={styles.dataValue}>{record.nextSteps || '—'}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.editButton} onPress={handleEditReason}>
            <Text style={styles.editButtonText}>Edit Reason for Visit</Text>
          </TouchableOpacity>
        </View>

        {/* Notes Section */}
        <View style={styles.section}>
          <View style={styles.notesHeader}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <TouchableOpacity onPress={handleEditNotes}>
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.notesBox}>
            <Text style={styles.notesText}>
              {record.notes || 'No notes added yet. Tap Edit to add notes.'}
            </Text>
          </View>
        </View>

        {/* Original Content if needed */}
        {record.originalText && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Original Text</Text>
            <View style={styles.originalTextBox}>
              <Text style={styles.originalText}>{record.originalText}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Edit Reason Modal */}
      <Modal visible={editingReason} animationType="slide" onRequestClose={() => setEditingReason(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditingReason(false)}>
              <Text style={styles.modalCloseButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Reason for Visit</Text>
            <TouchableOpacity onPress={handleSaveReason}>
              <Text style={styles.modalSaveButton}>Save</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter reason for visit..."
              placeholderTextColor="#999"
              value={reasonText}
              onChangeText={setReasonText}
              multiline
            />
          </View>
        </View>
      </Modal>

      {/* Edit Notes Modal */}
      <Modal visible={editingNotes} animationType="slide" onRequestClose={() => setEditingNotes(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditingNotes(false)}>
              <Text style={styles.modalCloseButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Notes</Text>
            <TouchableOpacity onPress={handleSaveNotes}>
              <Text style={styles.modalSaveButton}>Save</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <TextInput
              style={styles.modalInput}
              placeholder="Add your notes here..."
              placeholderTextColor="#999"
              value={notesText}
              onChangeText={setNotesText}
              multiline
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backArrow: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  deleteButton: {
    fontSize: 14,
    color: '#FF3333',
    fontWeight: '600',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 20,
  },
  errorSubtext: {
    fontSize: 12,
    color: '#999',
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  content: {
    padding: 20,
  },
  titleSection: {
    marginBottom: 24,
  },
  provider: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  specialty: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  imageContainer: {
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFF',
  },
  image: {
    width: '100%',
    height: 300,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
  },
  dataTable: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 12,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
  },
  dataRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  dataLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dataValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    flex: 1,
    textAlign: 'right',
  },
  editButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    marginTop: 8,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  notesBox: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 16,
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  notesText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  originalTextBox: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 12,
    maxHeight: 200,
  },
  originalText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    paddingTop: 50,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalCloseButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
  },
  modalSaveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 16,
    fontSize: 15,
    color: '#000',
    textAlignVertical: 'top',
  },
});
