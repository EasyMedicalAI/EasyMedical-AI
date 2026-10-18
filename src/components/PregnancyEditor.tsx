// Add or edit one pregnancy for the obstetric history: the year, how it ended, and any complications.
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';

export const PREGNANCY_OUTCOMES = ['Vaginal birth', 'C-section', 'Miscarriage', 'Stillbirth', 'Ectopic pregnancy', 'Other'];
export const PREGNANCY_COMPLICATIONS = ['Gestational diabetes', 'Preeclampsia', 'Preterm birth', 'Postpartum hemorrhage', 'Other'];

// A birth counts toward births; a miscarriage, stillbirth or ectopic pregnancy counts as a loss
export const isBirthOutcome = (outcome: string) => outcome === 'Vaginal birth' || outcome === 'C-section';
export const isLossOutcome = (outcome: string) => ['Miscarriage', 'Stillbirth', 'Ectopic pregnancy'].includes(outcome);

export interface PregnancyFormValues {
  year: string;
  outcome: string;
  complications: string[];
}

export const blankPregnancyForm = (): PregnancyFormValues => ({ year: '', outcome: '', complications: [] });

export default function PregnancyEditor({
  visible,
  isEditing,
  values,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  visible: boolean;
  isEditing: boolean;
  values: PregnancyFormValues;
  onChange: (patch: Partial<PregnancyFormValues>) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const toggleComplication = (name: string) => {
    const selected = values.complications.includes(name);
    onChange({
      complications: selected ? values.complications.filter((c) => c !== name) : [...values.complications, name],
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{isEditing ? 'Edit pregnancy' : 'New pregnancy'}</Text>
          <TouchableOpacity onPress={onSave} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.save}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
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

          {isEditing && onDelete && (
            <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
              <Text style={styles.deleteText}>Delete pregnancy</Text>
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
