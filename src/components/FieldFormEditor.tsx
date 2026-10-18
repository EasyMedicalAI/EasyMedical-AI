// A simple add or edit form: a title, a list of text fields, Cancel and Save at the top, and an optional Delete at the bottom.
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, StyleSheet, KeyboardTypeOptions } from 'react-native';

export interface FormField {
  key: string;
  label: string;
  placeholder: string;
  optional?: boolean;
  keyboardType?: KeyboardTypeOptions;
}

export default function FieldFormEditor({
  visible,
  title,
  isEditing,
  fields,
  values,
  onChange,
  onSave,
  onCancel,
  onDelete,
  deleteLabel,
}: {
  visible: boolean;
  title: string;
  isEditing: boolean;
  fields: FormField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{isEditing ? `Edit ${title}` : `New ${title}`}</Text>
          <TouchableOpacity onPress={onSave} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.save}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
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

          {isEditing && onDelete && (
            <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
              <Text style={styles.deleteText}>{deleteLabel || `Delete ${title}`}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D0D0D5',
  },
  title: { fontSize: 17, fontWeight: '600', color: '#000' },
  cancel: { fontSize: 17, color: '#007AFF' },
  save: { fontSize: 17, fontWeight: '600', color: '#007AFF' },
  form: { paddingHorizontal: 20, paddingBottom: 48 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 6,
  },
  optional: { fontWeight: '400', letterSpacing: 0 },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 50,
    justifyContent: 'center',
    fontSize: 17,
    color: '#000',
  },
  deleteButton: {
    marginTop: 32,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
  },
  deleteText: { fontSize: 17, color: '#FF3B30', fontWeight: '500' },
});
