// Shows parsed entries as a list to check before anything is saved. Tap an entry to change its fields inline.
// Used by Quick Log and by the review of an uploaded summary.
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LogEntry, describeEntry, savableEntries } from '@/services/quickLog';
import { ListCard, Divider } from '@/components/ScreenKit';

type EntryType = LogEntry['type'];
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const ROW_ICON: Partial<Record<EntryType, IconName>> = {
  weight: 'scale-bathroom',
  blood_pressure: 'heart-pulse',
  height: 'human-male-height',
  blood_type: 'water-outline',
  birthday: 'gift-outline',
  gender: 'account-outline',
  start_medication: 'pill',
  stop_medication: 'pill',
  add_condition: 'stethoscope',
  add_allergy: 'alert-outline',
  log_sleep: 'moon-waning-crescent',
  log_exercise: 'run',
  log_meal: 'food-fork-drink',
  add_appointment: 'calendar-outline',
  add_vaccine: 'needle',
  add_screening: 'clipboard-pulse-outline',
};

const ROW_TITLE: Partial<Record<EntryType, string>> = {
  weight: 'Weight',
  blood_pressure: 'Blood pressure',
  height: 'Height',
  blood_type: 'Blood type',
  birthday: 'Birthday',
  gender: 'Sex',
  start_medication: 'Medication started',
  stop_medication: 'Medication stopped',
  add_condition: 'Condition',
  add_allergy: 'Allergy',
  log_sleep: 'Sleep',
  log_exercise: 'Exercise',
  log_meal: 'Food',
  add_appointment: 'Appointment',
  add_vaccine: 'Vaccine',
  add_screening: 'Screening',
};

type Field = {
  key: keyof LogEntry;
  label: string;
  kind: 'text' | 'number' | 'date' | 'choice';
  required?: boolean;
};

const FIELDS: Partial<Record<EntryType, Field[]>> = {
  weight: [
    { key: 'weight_lbs', label: 'Weight (lbs)', kind: 'number', required: true },
    { key: 'date', label: 'Date', kind: 'date', required: true },
  ],
  blood_pressure: [
    { key: 'systolic', label: 'Top number', kind: 'number', required: true },
    { key: 'diastolic', label: 'Bottom number', kind: 'number', required: true },
    { key: 'date', label: 'Date', kind: 'date', required: true },
  ],
  blood_type: [{ key: 'blood_type', label: 'Blood type', kind: 'choice', required: true }],
  log_sleep: [
    { key: 'hours', label: 'Hours slept', kind: 'number', required: true },
    { key: 'date', label: 'Date', kind: 'date', required: true },
  ],
  log_exercise: [
    { key: 'minutes', label: 'Minutes', kind: 'number', required: true },
    { key: 'activity', label: 'Activity', kind: 'text' },
    { key: 'date', label: 'Date', kind: 'date', required: true },
  ],
  log_meal: [
    { key: 'meal', label: 'What you ate or drank', kind: 'text', required: true },
    { key: 'date', label: 'Date', kind: 'date', required: true },
  ],
  start_medication: [
    { key: 'medication_name', label: 'Medication', kind: 'text', required: true },
    { key: 'dose', label: 'Dose', kind: 'text' },
    { key: 'date', label: 'Started', kind: 'date', required: true },
  ],
  stop_medication: [
    { key: 'medication_name', label: 'Medication', kind: 'text', required: true },
    { key: 'date', label: 'Stopped', kind: 'date', required: true },
  ],
  add_condition: [{ key: 'condition_name', label: 'Condition', kind: 'text', required: true }],
  add_allergy: [
    { key: 'allergy_name', label: 'Allergy', kind: 'text', required: true },
    { key: 'allergy_reaction', label: 'Reaction', kind: 'text' },
  ],
  add_appointment: [
    { key: 'date', label: 'Date', kind: 'date', required: true },
    { key: 'time', label: 'Time', kind: 'text' },
    { key: 'doctor_name', label: 'Doctor', kind: 'text' },
  ],
  add_vaccine: [
    { key: 'vaccine_name', label: 'Vaccine', kind: 'text', required: true },
    { key: 'date', label: 'Date given', kind: 'date', required: true },
    { key: 'next_due', label: 'Next due', kind: 'date' },
  ],
};

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Stored dates are YYYY-MM-DD. The editor shows and accepts MM/DD/YYYY.
function toInputDate(iso?: unknown): string {
  const match = typeof iso === 'string' ? iso.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  return match ? `${match[2]}/${match[3]}/${match[1]}` : '';
}

function fromInputDate(text: string): string | null {
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  const date = new Date(year, month - 1, day);
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Checks what the person typed and builds the entry. Returns an error message if something is wrong.
function buildEntry(entry: LogEntry, fields: Field[], texts: Record<string, string>): { entry: LogEntry } | { error: string } {
  const next: Record<string, unknown> = { ...entry };
  for (const field of fields) {
    const key = field.key as string;
    const raw = (texts[key] ?? '').trim();
    if (!raw) {
      if (field.required) return { error: `${field.label} can't be empty.` };
      next[key] = undefined;
      continue;
    }
    if (field.kind === 'number') {
      const value = Number(raw);
      if (!isFinite(value)) return { error: `${field.label} needs a number.` };
      next[key] = value;
    } else if (field.kind === 'date') {
      const iso = fromInputDate(raw);
      if (!iso) return { error: `${field.label} should look like 10/14/2026.` };
      next[key] = iso;
    } else {
      next[key] = raw;
    }
  }
  return { entry: next as LogEntry };
}

// The row's detail is the description without the title word at the start
function rowDetail(entry: LogEntry, active: string[]): string {
  const text = describeEntry(entry, active);
  const title = ROW_TITLE[entry.type];
  if (title && text.toLowerCase().startsWith(title.toLowerCase())) {
    return text.slice(title.length).replace(/^\s+/, '');
  }
  return text;
}

// Edits one entry. It sits inline in the review, so it never opens a popup on top of another popup.
function EntryEditor({
  entry,
  onDone,
  onRemove,
  onBack,
}: {
  entry: LogEntry;
  onDone: (next: LogEntry) => void;
  onRemove: () => void;
  onBack: () => void;
}) {
  const fields = FIELDS[entry.type] ?? [];
  const [texts, setTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map((field) => {
        const value = (entry as Record<string, unknown>)[field.key as string];
        return [field.key as string, field.kind === 'date' ? toInputDate(value) : String(value ?? '')];
      })
    )
  );

  const isUnclear = entry.type === 'unclear';
  const offersBloodType = isUnclear && /blood type/i.test(entry.message || '');

  const done = () => {
    const result = buildEntry(entry, fields, texts);
    if ('error' in result) {
      Alert.alert('Check this entry', result.error);
      return;
    }
    onDone(result.entry);
  };

  return (
    <View>
      <TouchableOpacity onPress={onBack} style={styles.backRow} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.backText}>‹ Back</Text>
      </TouchableOpacity>
      <Text style={styles.editorTitle}>{isUnclear ? 'Needs a check' : ROW_TITLE[entry.type] ?? 'Entry'}</Text>

      {isUnclear ? (
        <>
          <Text style={styles.unclearText}>{entry.message || 'Could you say that another way?'}</Text>
          {offersBloodType && (
            <ListCard>
              <View style={styles.chipRow}>
                {BLOOD_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={styles.chip}
                    onPress={() => onDone({ type: 'blood_type', blood_type: type } as LogEntry)}
                  >
                    <Text style={styles.chipText}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ListCard>
          )}
        </>
      ) : fields.length === 0 ? (
        <Text style={styles.unclearText}>This entry can't be changed here. Remove it and say it again.</Text>
      ) : (
        <ListCard>
          {fields.map((field, index) => {
            const key = field.key as string;
            return (
              <React.Fragment key={key}>
                {index > 0 && <Divider />}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  {field.kind === 'choice' ? (
                    <View style={styles.chipRow}>
                      {BLOOD_TYPES.map((type) => {
                        const selected = texts[key] === type;
                        return (
                          <TouchableOpacity
                            key={type}
                            style={[styles.chip, selected && styles.chipSelected]}
                            onPress={() => setTexts((current) => ({ ...current, [key]: type }))}
                          >
                            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{type}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
                    <TextInput
                      style={styles.fieldInput}
                      value={texts[key] ?? ''}
                      onChangeText={(value) => setTexts((current) => ({ ...current, [key]: value }))}
                      placeholder={field.kind === 'date' ? 'MM/DD/YYYY' : undefined}
                      placeholderTextColor="#999"
                      keyboardType={field.kind === 'number' ? 'decimal-pad' : field.kind === 'date' ? 'numbers-and-punctuation' : 'default'}
                    />
                  )}
                </View>
              </React.Fragment>
            );
          })}
        </ListCard>
      )}

      <View style={styles.editorButtons}>
        <TouchableOpacity style={styles.removeButton} onPress={onRemove}>
          <Text style={styles.removeText}>Remove</Text>
        </TouchableOpacity>
        {!isUnclear && fields.length > 0 && (
          <TouchableOpacity style={styles.doneButton} onPress={done}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function EntryReview({
  entries,
  active,
  saveLabel = 'Save',
  saving = false,
  onSave,
  onCancel,
}: {
  entries: LogEntry[];
  active: string[];
  saveLabel?: string;
  saving?: boolean;
  onSave: (entries: LogEntry[]) => void;
  onCancel: () => void;
}) {
  const [items, setItems] = useState<LogEntry[]>(entries);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const savableCount = savableEntries(items, active).length;

  const updateItem = (index: number, next: LogEntry) => {
    setItems((current) => current.map((entry, i) => (i === index ? next : entry)));
    setEditingIndex(null);
  };

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, i) => i !== index));
    setEditingIndex(null);
  };

  if (editingIndex !== null && items[editingIndex]) {
    return (
      <EntryEditor
        key={editingIndex}
        entry={items[editingIndex]}
        onDone={(next) => updateItem(editingIndex, next)}
        onRemove={() => removeItem(editingIndex)}
        onBack={() => setEditingIndex(null)}
      />
    );
  }

  return (
    <View>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>Nothing left to save.</Text>
      ) : (
        <>
          <Text style={styles.reviewSub}>Tap an entry to change it</Text>
          <ListCard>
            {items.map((entry, index) => {
              const unclear = entry.type === 'unclear';
              const title = unclear ? 'Needs a check' : ROW_TITLE[entry.type] ?? 'Entry';
              return (
                <React.Fragment key={index}>
                  {index > 0 && <Divider />}
                  <TouchableOpacity style={styles.row} onPress={() => setEditingIndex(index)}>
                    <MaterialCommunityIcons
                      name={ROW_ICON[entry.type] ?? 'file-document-outline'}
                      size={20}
                      color={unclear ? '#B45309' : '#666'}
                      style={styles.rowIcon}
                    />
                    <View style={styles.rowContent}>
                      <Text style={styles.rowTitle}>{title}</Text>
                      <Text style={[styles.rowDetail, unclear && styles.rowDetailUnclear]}>
                        {unclear ? entry.message : rowDetail(entry, active)}
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color="#C7C7CC" />
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}
          </ListCard>
        </>
      )}

      <View style={styles.reviewButtons}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel} disabled={saving}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, savableCount === 0 && styles.buttonDisabled]}
          onPress={() => onSave(savableEntries(items, active))}
          disabled={savableCount === 0 || saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.saveText}>{saveLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  reviewSub: {
    fontSize: 13,
    color: '#666',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  rowIcon: {
    width: 22,
    marginRight: 12,
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  rowDetail: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  rowDetailUnclear: {
    color: '#B45309',
  },
  reviewButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelButton: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 15,
  },
  saveButton: {
    flex: 1.4,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#A9CFFF',
  },
  saveText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
  },
  backRow: {
    marginBottom: 6,
  },
  backText: {
    fontSize: 16,
    color: '#007AFF',
  },
  editorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 10,
  },
  unclearText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#B45309',
    marginBottom: 14,
  },
  field: {
    paddingVertical: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  fieldInput: {
    fontSize: 16,
    color: '#000',
    paddingVertical: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D0D0D5',
    backgroundColor: '#FFF',
  },
  chipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  chipText: {
    fontSize: 14,
    color: '#333',
  },
  chipTextSelected: {
    color: '#FFF',
    fontWeight: '600',
  },
  editorButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  removeButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FF3B30',
    paddingVertical: 12,
    alignItems: 'center',
  },
  removeText: {
    color: '#FF3B30',
    fontWeight: '600',
    fontSize: 15,
  },
  doneButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    alignItems: 'center',
  },
  doneText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
  },
});
