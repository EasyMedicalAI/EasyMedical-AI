// The vaccine form, shown inside the Vaccines page: the name, the date given, and when the next dose is due.
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import DateWheel from '@/components/DateWheel';

export interface VaccineFormValues {
  name: string;
  date: Date | null;
  nextDue: Date | null;
}

export const blankVaccineForm = (name = ''): VaccineFormValues => ({ name, date: new Date(), nextDue: null });

export default function VaccineForm({
  values,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  values: VaccineFormValues;
  onChange: (patch: Partial<VaccineFormValues>) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  return (
    <View>
      <Text style={styles.label}>VACCINE</Text>
      <TextInput
        style={styles.input}
        value={values.name}
        onChangeText={(name) => onChange({ name })}
        placeholder="e.g. Flu shot"
        placeholderTextColor="#8E8E93"
      />

      <DateWheel label="Date given" value={values.date} onChange={(date) => onChange({ date })} maximumDate={new Date()} />

      <DateWheel
        label="Next due (optional)"
        value={values.nextDue}
        onChange={(nextDue) => onChange({ nextDue })}
        placeholder="Not set"
        minimumDate={values.date ?? undefined}
      />
      {values.nextDue ? (
        <TouchableOpacity style={styles.clearLink} onPress={() => onChange({ nextDue: null })}>
          <Text style={styles.link}>Remove next due date</Text>
        </TouchableOpacity>
      ) : null}

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
          <Text style={styles.deleteText}>Delete vaccine</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '600', color: '#8E8E93', letterSpacing: 0.5, marginTop: 4, marginBottom: 6 },
  input: { backgroundColor: '#F2F2F7', borderRadius: 12, paddingHorizontal: 14, minHeight: 50, fontSize: 17, color: '#000' },
  clearLink: { paddingVertical: 8 },
  link: { fontSize: 15, color: '#007AFF', fontWeight: '500' },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 14 },
  cancelButton: { flex: 1, backgroundColor: '#E5E5EA', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  cancelText: { fontSize: 16, fontWeight: '500', color: '#000' },
  saveButton: { flex: 1, backgroundColor: '#007AFF', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  saveText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  deleteLink: { alignItems: 'center', paddingVertical: 14 },
  deleteText: { fontSize: 15, color: '#FF3B30', fontWeight: '500' },
});
