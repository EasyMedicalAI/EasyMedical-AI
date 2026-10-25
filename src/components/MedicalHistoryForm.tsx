// The form for one medical history entry, shown inside the Medical history page: a surgery, a family history condition,
// a hospitalization, or a pregnancy. The date and the choices are the same as in the separate editors it replaces.
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import DateWheel from '@/components/DateWheel';
import { PREGNANCY_OUTCOMES, PREGNANCY_COMPLICATIONS } from '@/components/PregnancyEditor';

export type HistoryKind = 'surgery' | 'family' | 'hospitalization' | 'pregnancy';

export interface HistoryDraft {
  name: string;
  member: string;
  customMember: boolean;
  condition: string;
  date: Date;
  year: string;
  outcome: string;
  complications: string[];
}

export const blankHistoryDraft = (): HistoryDraft => ({
  name: '',
  member: '',
  customMember: false,
  condition: '',
  date: new Date(),
  year: '',
  outcome: '',
  complications: [],
});

export const FAMILY_MEMBERS = ['Mother', 'Father', 'Sister', 'Brother', 'Grandmother', 'Grandfather', 'Aunt', 'Uncle'];

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

export default function MedicalHistoryForm({
  kind,
  values,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  kind: HistoryKind;
  values: HistoryDraft;
  onChange: (patch: Partial<HistoryDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const toggleComplication = (name: string) => {
    const selected = values.complications.includes(name);
    onChange({ complications: selected ? values.complications.filter((c) => c !== name) : [...values.complications, name] });
  };

  return (
    <View>
      {kind === 'surgery' && (
        <>
          <Text style={styles.label}>SURGERY</Text>
          <TextInput style={styles.input} value={values.name} onChangeText={(name) => onChange({ name })} placeholder="e.g. Appendectomy" placeholderTextColor="#8E8E93" />
          <DateWheel label="Date (month and year)" value={values.date} onChange={(date) => onChange({ date })} maximumDate={new Date()} />
        </>
      )}

      {kind === 'hospitalization' && (
        <>
          <Text style={styles.label}>REASON</Text>
          <TextInput style={styles.input} value={values.name} onChangeText={(name) => onChange({ name })} placeholder="e.g. Pneumonia treatment" placeholderTextColor="#8E8E93" />
          <DateWheel label="Date (month and year)" value={values.date} onChange={(date) => onChange({ date })} maximumDate={new Date()} />
        </>
      )}

      {kind === 'family' && (
        <>
          <Text style={styles.label}>FAMILY MEMBER</Text>
          <View style={styles.chips}>
            {FAMILY_MEMBERS.map((option) => {
              const selected = !values.customMember && values.member === option;
              return (
                <TouchableOpacity key={option} style={[styles.chip, selected && styles.chipOn]} onPress={() => onChange({ member: option, customMember: false })}>
                  <Text style={[styles.chipText, selected && styles.chipTextOn]}>{option}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={[styles.chip, values.customMember && styles.chipOn]} onPress={() => onChange({ member: '', customMember: true })}>
              <Text style={[styles.chipText, values.customMember && styles.chipTextOn]}>Other</Text>
            </TouchableOpacity>
          </View>
          {values.customMember && (
            <TextInput style={styles.input} value={values.member} onChangeText={(member) => onChange({ member })} placeholder="e.g. Cousin" placeholderTextColor="#8E8E93" />
          )}
          <Text style={styles.label}>CONDITION</Text>
          <TextInput style={styles.input} value={values.condition} onChangeText={(condition) => onChange({ condition })} placeholder="e.g. Diabetes" placeholderTextColor="#8E8E93" />
        </>
      )}

      {kind === 'pregnancy' && (
        <>
          <Text style={styles.label}>YEAR</Text>
          <TextInput
            style={styles.input}
            value={values.year}
            onChangeText={(year) => onChange({ year: year.replace(/\D/g, '').slice(0, 4) })}
            placeholder="e.g. 2019"
            placeholderTextColor="#8E8E93"
            keyboardType="number-pad"
            maxLength={4}
          />
          <Text style={styles.label}>HOW IT ENDED</Text>
          <View style={styles.chips}>
            {PREGNANCY_OUTCOMES.map((option) => {
              const selected = values.outcome === option;
              return (
                <TouchableOpacity key={option} style={[styles.chip, selected && styles.chipOn]} onPress={() => onChange({ outcome: option })}>
                  <Text style={[styles.chipText, selected && styles.chipTextOn]}>{option}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.label}>
            COMPLICATIONS <Text style={styles.optional}>(IF ANY)</Text>
          </Text>
          <View style={styles.chips}>
            {PREGNANCY_COMPLICATIONS.map((option) => {
              const selected = values.complications.includes(option);
              return (
                <TouchableOpacity key={option} style={[styles.chip, selected && styles.chipOn]} onPress={() => toggleComplication(option)}>
                  <Text style={[styles.chipText, selected && styles.chipTextOn]}>{option}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

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
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '600', color: '#8E8E93', letterSpacing: 0.5, marginTop: 4, marginBottom: 6 },
  optional: { fontWeight: '400', letterSpacing: 0 },
  input: { backgroundColor: '#F2F2F7', borderRadius: 12, paddingHorizontal: 14, minHeight: 50, fontSize: 17, color: '#000', marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#D0D0D5', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#FFF' },
  chipOn: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  chipText: { fontSize: 15, color: '#000', fontWeight: '500' },
  chipTextOn: { color: '#FFF' },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 14 },
  cancelButton: { flex: 1, backgroundColor: '#E5E5EA', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  cancelText: { fontSize: 16, fontWeight: '500', color: '#000' },
  saveButton: { flex: 1, backgroundColor: '#007AFF', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  saveText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  deleteLink: { alignItems: 'center', paddingVertical: 14 },
  deleteText: { fontSize: 15, color: '#FF3B30', fontWeight: '500' },
});
