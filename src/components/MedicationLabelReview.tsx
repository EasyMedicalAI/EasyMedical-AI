// Checks what was read from a medication label before it is saved. Every field can be changed.
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { ListCard, Divider } from '@/components/ScreenKit';
import { parseTime, formatTime } from '@/services/doseSchedule';

export interface MedicationDraft {
  name: string;
  dose: string;
  howOften: string;
  reminderTimes: string[];
  isOtc: boolean;
  notes: string;
  confidence: 'high' | 'medium' | 'low';
}

export default function MedicationLabelReview({
  draft,
  onSave,
  onCancel,
  saving = false,
}: {
  draft: MedicationDraft;
  onSave: (draft: MedicationDraft) => void;
  onCancel: () => void;
  saving?: boolean;
}) {
  const [name, setName] = useState(draft.name);
  const [dose, setDose] = useState(draft.dose);
  const [howOften, setHowOften] = useState(draft.howOften);
  const [isOtc, setIsOtc] = useState(draft.isOtc);
  const [times, setTimes] = useState<string[]>(draft.reminderTimes);
  const [timeText, setTimeText] = useState('');

  const addTime = () => {
    const time = parseTime(timeText);
    if (!time) {
      Alert.alert('Check the time', 'Enter a time such as 8:00 AM.');
      return;
    }
    setTimes((current) => (current.includes(time) ? current : [...current, time].sort()));
    setTimeText('');
  };

  const save = () => {
    if (!name.trim()) {
      Alert.alert('Add a name', 'Enter the medication name.');
      return;
    }
    onSave({ name: name.trim(), dose: dose.trim(), howOften: howOften.trim(), reminderTimes: times, isOtc, notes: draft.notes, confidence: draft.confidence });
  };

  const unsure = draft.confidence === 'low' || draft.notes.length > 0;

  return (
    <View>
      <Text style={styles.title}>Check the label</Text>
      {unsure && (
        <Text style={styles.note}>
          {draft.notes || 'Some of this was hard to read. Check each line before saving.'}
        </Text>
      )}

      <ListCard>
        <View style={styles.field}>
          <Text style={styles.label}>Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Medication name" placeholderTextColor="#999" />
        </View>
        <Divider />
        <View style={styles.field}>
          <Text style={styles.label}>Dose</Text>
          <TextInput style={styles.input} value={dose} onChangeText={setDose} placeholder="e.g. 50 mg" placeholderTextColor="#999" />
        </View>
        <Divider />
        <View style={styles.field}>
          <Text style={styles.label}>How often</Text>
          <TextInput style={styles.input} value={howOften} onChangeText={setHowOften} placeholder="e.g. twice a day" placeholderTextColor="#999" />
        </View>
        <Divider />
        <View style={styles.field}>
          <Text style={styles.label}>Type</Text>
          <View style={styles.chipRow}>
            <TouchableOpacity style={[styles.chip, !isOtc && styles.chipSelected]} onPress={() => setIsOtc(false)}>
              <Text style={[styles.chipText, !isOtc && styles.chipTextSelected]}>Prescription</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.chip, isOtc && styles.chipSelected]} onPress={() => setIsOtc(true)}>
              <Text style={[styles.chipText, isOtc && styles.chipTextSelected]}>Over the counter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ListCard>

      <View style={styles.sectionGap} />
      <Text style={styles.label}>Reminder times</Text>
      <ListCard>
        <View style={styles.chipRow}>
          {times.length === 0 && <Text style={styles.empty}>No reminders yet.</Text>}
          {times.map((time) => (
            <TouchableOpacity key={time} style={styles.timeChip} onPress={() => setTimes((current) => current.filter((t) => t !== time))}>
              <Text style={styles.timeChipText}>{formatTime(time)}  ×</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Divider />
        <View style={styles.addRow}>
          <TextInput style={styles.timeInput} value={timeText} onChangeText={setTimeText} placeholder="e.g. 8:00 AM" placeholderTextColor="#999" />
          <TouchableOpacity style={styles.addButton} onPress={addTime}>
            <Text style={styles.addText}>Add</Text>
          </TouchableOpacity>
        </View>
      </ListCard>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.cancel} onPress={onCancel} disabled={saving}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.save} onPress={save} disabled={saving}>
          <Text style={styles.saveText}>Save medication</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '600', color: '#000', marginBottom: 10 },
  note: { fontSize: 13, color: '#B45309', marginBottom: 12, lineHeight: 19 },
  field: { paddingVertical: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 6 },
  input: { fontSize: 16, color: '#000', paddingVertical: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: '#D0D0D5' },
  chipSelected: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  chipText: { fontSize: 14, color: '#333' },
  chipTextSelected: { color: '#FFF', fontWeight: '600' },
  sectionGap: { height: 16 },
  empty: { fontSize: 13, color: '#666', paddingVertical: 8 },
  timeChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#E8F1FF' },
  timeChipText: { fontSize: 13, color: '#007AFF', fontWeight: '500' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  timeInput: { flex: 1, fontSize: 15, color: '#000', paddingVertical: 6 },
  addButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#007AFF' },
  addText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancel: { flex: 1, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#007AFF', paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: '#007AFF', fontWeight: '600', fontSize: 15 },
  save: { flex: 1.4, borderRadius: 10, backgroundColor: '#007AFF', paddingVertical: 12, alignItems: 'center' },
  saveText: { color: '#FFF', fontWeight: '600', fontSize: 15 },
});
