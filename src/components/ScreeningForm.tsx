// The screening form, shown inside the Screenings page: the screening, the date it was done, and any notes.
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import DateWheel from '@/components/DateWheel';

export interface ScreeningFormValues {
  type: string;
  date: Date | null;
  notes: string;
}

export const blankScreeningForm = (type = ''): ScreeningFormValues => ({ type, date: new Date(), notes: '' });

export default function ScreeningForm({
  values,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  values: ScreeningFormValues;
  onChange: (patch: Partial<ScreeningFormValues>) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  return (
    <View>
      <Text style={styles.label}>SCREENING</Text>
      <TextInput
        style={styles.input}
        value={values.type}
        onChangeText={(type) => onChange({ type })}
        placeholder="e.g. Colonoscopy, Mammogram"
        placeholderTextColor="#8E8E93"
      />

      <DateWheel label="Date done" value={values.date} onChange={(date) => onChange({ date })} maximumDate={new Date()} />

      <Text style={styles.label}>
        NOTES <Text style={styles.optional}>(OPTIONAL)</Text>
      </Text>
      <TextInput
        style={[styles.input, styles.notes]}
        value={values.notes}
        onChangeText={(notes) => onChange({ notes })}
        placeholder="e.g. Provider name, results, next due date"
        placeholderTextColor="#8E8E93"
        multiline
      />

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveButton} onPress={onSave}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </View>

      {onDelete && (
        <TouchableOpacity style={styles.deleteLink} onPress={onDelete}>
          <Text style={styles.deleteText}>Delete screening</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '600', color: '#8E8E93', letterSpacing: 0.5, marginTop: 4, marginBottom: 6 },
  optional: { fontWeight: '400', letterSpacing: 0 },
  input: { backgroundColor: '#F2F2F7', borderRadius: 12, paddingHorizontal: 14, minHeight: 50, fontSize: 17, color: '#000' },
  notes: { minHeight: 80, paddingTop: 12, textAlignVertical: 'top' },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 14 },
  cancelButton: { flex: 1, backgroundColor: '#E5E5EA', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  cancelText: { fontSize: 16, fontWeight: '500', color: '#000' },
  saveButton: { flex: 1, backgroundColor: '#007AFF', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  saveText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  deleteLink: { alignItems: 'center', paddingVertical: 14 },
  deleteText: { fontSize: 15, color: '#FF3B30', fontWeight: '500' },
});
