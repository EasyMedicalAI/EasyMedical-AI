// A simple set of text fields that sits inside a page, with Cancel and Save below and an optional Delete.
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import type { FormField } from '@/components/FieldFormEditor';

export default function InlineFieldsForm({
  fields,
  values,
  onChange,
  onSave,
  onCancel,
  onDelete,
  deleteLabel,
  extraLabel,
  onExtra,
}: {
  fields: FormField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  extraLabel?: string;
  onExtra?: () => void;
}) {
  return (
    <View style={styles.form}>
      {fields.map((field) => (
        <View key={field.key}>
          <Text style={styles.label}>
            {field.label.toUpperCase()}
            {field.optional && <Text style={styles.optional}> (OPTIONAL)</Text>}
          </Text>
          <TextInput
            style={styles.input}
            value={values[field.key] || ''}
            onChangeText={(value) => onChange(field.key, value)}
            placeholder={field.placeholder}
            placeholderTextColor="#8E8E93"
            keyboardType={field.keyboardType}
          />
        </View>
      ))}

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveButton} onPress={onSave}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </View>

      {onExtra && extraLabel && (
        <TouchableOpacity style={styles.deleteLink} onPress={onExtra}>
          <Text style={styles.linkText}>{extraLabel}</Text>
        </TouchableOpacity>
      )}

      {onDelete && (
        <TouchableOpacity style={styles.deleteLink} onPress={onDelete}>
          <Text style={styles.deleteText}>{deleteLabel || 'Delete'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { padding: 14, backgroundColor: '#F7FAFF' },
  label: { fontSize: 12, fontWeight: '600', color: '#8E8E93', letterSpacing: 0.5, marginTop: 8, marginBottom: 6 },
  optional: { fontWeight: '400', letterSpacing: 0 },
  input: { backgroundColor: '#F2F2F7', borderRadius: 12, paddingHorizontal: 14, minHeight: 50, fontSize: 17, color: '#000' },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 14 },
  cancelButton: { flex: 1, backgroundColor: '#E5E5EA', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  cancelText: { fontSize: 16, fontWeight: '500', color: '#000' },
  saveButton: { flex: 1, backgroundColor: '#007AFF', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  saveText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  deleteLink: { alignItems: 'center', paddingVertical: 14 },
  linkText: { fontSize: 15, color: '#007AFF', fontWeight: '500' },
  deleteText: { fontSize: 15, color: '#FF3B30', fontWeight: '500' },
});
