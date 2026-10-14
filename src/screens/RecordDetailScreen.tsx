import React, { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, Alert, TextInput, Modal } from 'react-native';
import { useRecords } from '@/context/RecordsContext';
import { MedicalRecord } from '@/types/medical';
import RecordSummary from '@/components/RecordSummary';
import { Section, ListCard, ListRow, Divider } from '@/components/ScreenKit';

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
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>

      <RecordSummary record={record} />

      <Section title="Your notes">
        <ListCard>
          <ListRow icon="pencil-outline" label="Reason for visit" hint={record.reasonForVisit || 'Not added yet'} onPress={handleEditReason} />
          <Divider />
          <ListRow icon="note-text-outline" label="Notes" hint={record.notes || 'No notes added yet'} onPress={handleEditNotes} />
        </ListCard>
      </Section>

      <View style={styles.spacing} />

      {/* Edit Reason Modal */}
      <Modal visible={editingReason} animationType="slide" onRequestClose={() => setEditingReason(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditingReason(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Reason for visit</Text>
            <TouchableOpacity onPress={handleSaveReason}>
              <Text style={styles.modalSave}>Save</Text>
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
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Notes</Text>
            <TouchableOpacity onPress={handleSaveNotes}>
              <Text style={styles.modalSave}>Save</Text>
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
  },
  backText: {
    fontSize: 17,
    color: '#007AFF',
  },
  deleteText: {
    fontSize: 17,
    color: '#FF3B30',
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
    paddingBottom: 16,
  },
  modalCancel: {
    fontSize: 17,
    color: '#007AFF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  modalSave: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalInput: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    padding: 16,
    fontSize: 15,
    color: '#000',
    textAlignVertical: 'top',
  },
});
