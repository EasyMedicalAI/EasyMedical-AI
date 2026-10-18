// Add or edit an insurance plan: the provider, member ID, and group number.
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';

export default function InsuranceEditor({
  visible,
  isEditing,
  provider,
  memberId,
  groupNumber,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  visible: boolean;
  isEditing: boolean;
  provider: string;
  memberId: string;
  groupNumber: string;
  onChange: (patch: { provider?: string; memberId?: string; groupNumber?: string }) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{isEditing ? 'Edit insurance' : 'New insurance'}</Text>
          <TouchableOpacity onPress={onSave} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.save}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>PROVIDER</Text>
          <TextInput
            style={styles.input}
            value={provider}
            onChangeText={(value) => onChange({ provider: value })}
            placeholder="e.g. Blue Cross Blue Shield"
            placeholderTextColor="#8E8E93"
          />

          <Text style={styles.label}>MEMBER ID</Text>
          <TextInput
            style={styles.input}
            value={memberId}
            onChangeText={(value) => onChange({ memberId: value })}
            placeholder="e.g. BCX123456789"
            placeholderTextColor="#8E8E93"
            autoCapitalize="characters"
          />

          <Text style={styles.label}>
            GROUP NUMBER <Text style={styles.optional}>(OPTIONAL)</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={groupNumber}
            onChangeText={(value) => onChange({ groupNumber: value })}
            placeholder="e.g. GRP789"
            placeholderTextColor="#8E8E93"
            autoCapitalize="characters"
          />

          {isEditing && onDelete && (
            <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
              <Text style={styles.deleteText}>Delete insurance</Text>
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
