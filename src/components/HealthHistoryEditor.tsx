// Add or edit a surgery, family history item, past condition, or hospitalization.
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

export type HistoryType = 'surgical' | 'family' | 'hospitalization';

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const FAMILY_MEMBERS = ['Mother', 'Father', 'Sister', 'Brother', 'Grandmother', 'Grandfather', 'Aunt', 'Uncle'];
const TITLES: Record<HistoryType, string> = {
  surgical: 'surgery',
  family: 'family history',
  hospitalization: 'hospitalization',
};

// Saved as "Mar 2019"
export const formatHistoryDate = (date: Date) => `${SHORT_MONTHS[date.getMonth()]} ${date.getFullYear()}`;

// Reads "Mar 2019" or "March 2019" back into a date; today if it can't be read
export function historyDateFrom(text?: string): Date {
  const match = text?.match(/([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{4})/);
  if (match) {
    const month = SHORT_MONTHS.findIndex((name) => name.toLowerCase() === match[1].toLowerCase());
    if (month >= 0) return new Date(parseInt(match[2], 10), month, 1);
  }
  return new Date();
}

export default function HealthHistoryEditor({
  visible,
  type,
  isEditing,
  name,
  member,
  customMember,
  condition,
  date,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  visible: boolean;
  type: HistoryType | null;
  isEditing: boolean;
  name: string;
  member: string;
  customMember: boolean;
  condition: string;
  date: Date;
  onChange: (patch: { name?: string; member?: string; customMember?: boolean; condition?: string; date?: Date }) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [pickingDate, setPickingDate] = useState(false);
  const title = type ? TITLES[type] : '';
  const hasDate = type === 'surgical' || type === 'hospitalization';

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
          {type === 'surgical' && (
            <>
              <Text style={styles.label}>SURGERY</Text>
              <TextInput style={styles.input} value={name} onChangeText={(value) => onChange({ name: value })} placeholder="e.g. Appendectomy" placeholderTextColor="#8E8E93" />
            </>
          )}

          {type === 'hospitalization' && (
            <>
              <Text style={styles.label}>REASON</Text>
              <TextInput style={styles.input} value={name} onChangeText={(value) => onChange({ name: value })} placeholder="e.g. Pneumonia treatment" placeholderTextColor="#8E8E93" />
            </>
          )}

          {type === 'family' && (
            <>
              <Text style={styles.label}>FAMILY MEMBER</Text>
              <View style={styles.chips}>
                {FAMILY_MEMBERS.map((option) => {
                  const selected = !customMember && member === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[styles.chip, selected && styles.chipOn]}
                      onPress={() => onChange({ member: option, customMember: false })}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{option}</Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[styles.chip, customMember && styles.chipOn]}
                  onPress={() => onChange({ member: '', customMember: true })}
                >
                  <Text style={[styles.chipText, customMember && styles.chipTextOn]}>Other</Text>
                </TouchableOpacity>
              </View>
              {customMember && (
                <TextInput style={styles.input} value={member} onChangeText={(value) => onChange({ member: value })} placeholder="e.g. Cousin" placeholderTextColor="#8E8E93" />
              )}

              <Text style={styles.label}>CONDITION</Text>
              <TextInput style={styles.input} value={condition} onChangeText={(value) => onChange({ condition: value })} placeholder="e.g. Diabetes" placeholderTextColor="#8E8E93" />
            </>
          )}

          {hasDate && (
            <>
              <Text style={styles.label}>DATE</Text>
              <TouchableOpacity style={styles.input} onPress={() => setPickingDate(!pickingDate)}>
                <Text style={styles.inputText}>{formatHistoryDate(date)}</Text>
              </TouchableOpacity>
              {pickingDate && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="spinner"
                  onChange={(_, picked) => picked && onChange({ date: new Date(picked.getFullYear(), picked.getMonth(), 1) })}
                />
              )}
            </>
          )}

          {isEditing && onDelete && (
            <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
              <Text style={styles.deleteText}>Delete</Text>
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
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 50,
    justifyContent: 'center',
    fontSize: 17,
    color: '#000',
    marginTop: 0,
    marginBottom: 8,
  },
  inputText: { fontSize: 17, color: '#000' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D0D0D5',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#FFF',
  },
  chipOn: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  chipText: { fontSize: 15, color: '#000', fontWeight: '500' },
  chipTextOn: { color: '#FFF' },
  deleteButton: {
    marginTop: 32,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
  },
  deleteText: { fontSize: 17, color: '#FF3B30', fontWeight: '500' },
});
