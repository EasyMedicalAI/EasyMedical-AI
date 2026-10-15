// Type or speak a note such as "my weight is 182". The entries are listed for review. Tap one to change it, then save.
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SpeechModule, speechAvailable, useSpeechEvent } from '@/services/speech';
import { UserHealthData } from '@/types/medical';
import { LogEntry, parseLogText, describeEntry, savableEntries, currentMedicationNames } from '@/services/quickLog';
import { DetailPage, ListCard, Divider } from '@/components/ScreenKit';

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

function EntryEditor({
  entry,
  active,
  onDone,
  onRemove,
}: {
  entry: LogEntry;
  active: string[];
  onDone: (next: LogEntry) => void;
  onRemove: () => void;
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
    <>
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
    </>
  );
}

export default function QuickLogBox({
  userData,
  onSave,
}: {
  userData: UserHealthData;
  onSave: (entries: LogEntry[]) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [entries, setEntries] = useState<LogEntry[] | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [listening, setListening] = useState(false);

  const active = currentMedicationNames(userData);
  const savableCount = entries ? savableEntries(entries, active).length : 0;

  // Speech fills the text box as the person talks; they still review it and tap Review
  useSpeechEvent('start', () => setListening(true));
  useSpeechEvent('end', () => setListening(false));
  useSpeechEvent('result', (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) {
      setText(transcript);
      setEntries(null);
    }
  });
  useSpeechEvent('error', (event) => {
    setListening(false);
    if (event.error !== 'aborted') {
      Alert.alert('Could not hear that', event.message || 'Please try again, or type it instead.');
    }
  });

  const toggleListening = async () => {
    if (!speechAvailable || !SpeechModule) {
      Alert.alert('Speaking needs an app update', 'This version of the app cannot listen yet. You can still type your note.');
      return;
    }
    if (listening) {
      SpeechModule.stop();
      return;
    }
    const permission = await SpeechModule.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microphone off', 'Turn on Microphone and Speech Recognition for EasyMedical in Settings to speak your notes.');
      return;
    }
    SpeechModule.start({ lang: 'en-US', interimResults: true, continuous: false });
  };

  const send = async () => {
    const note = text.trim();
    if (!note || loading) return;
    setLoading(true);
    try {
      const parsed = await parseLogText(note, active);
      setEntries(parsed.length > 0 ? parsed : [{ type: 'unclear', message: 'Nothing to log. Try saying it another way.' } as LogEntry]);
      setText('');
    } catch (error) {
      Alert.alert('Could not log that', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateEntry = (index: number, next: LogEntry) => {
    setEntries((current) => (current ? current.map((entry, i) => (i === index ? next : entry)) : current));
  };

  const removeEntry = (index: number) => {
    setEntries((current) => {
      const remaining = current ? current.filter((_, i) => i !== index) : current;
      if (remaining && remaining.length === 0) return null;
      return remaining;
    });
    setEditingIndex(null);
  };

  const confirm = async () => {
    if (!entries || saving) return;
    const toSave = savableEntries(entries, active);
    if (toSave.length === 0) {
      Alert.alert('Nothing to save', 'Tap an entry to fix it, or type a new note.');
      return;
    }
    setSaving(true);
    try {
      await onSave(toSave);
      setEntries(null);
      setText('');
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => setEntries(null);

  const editing = editingIndex !== null && entries ? entries[editingIndex] : null;

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Quick Log</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={listening ? 'Listening...' : 'Type, or tap the microphone to speak'}
          placeholderTextColor="#999"
          value={text}
          onChangeText={(value) => {
            setText(value);
            if (entries) setEntries(null);
          }}
          multiline
          editable={!loading && !saving}
        />
        <TouchableOpacity
          style={[styles.micButton, listening && styles.micButtonActive]}
          onPress={toggleListening}
          disabled={loading || saving}
          accessibilityLabel={listening ? 'Stop listening' : 'Speak your note'}
        >
          <MaterialCommunityIcons name={listening ? 'stop' : 'microphone-outline'} size={20} color={listening ? '#FFF' : '#333'} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, (!text.trim() || loading) && styles.buttonDisabled]}
        onPress={send}
        disabled={!text.trim() || loading}
      >
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Review</Text>}
      </TouchableOpacity>

      <Text style={styles.hint}>For example: my weight is 182, I slept 7 hours</Text>

      {entries && (
        <View style={styles.review}>
          <Text style={styles.reviewTitle}>Check your entries</Text>
          <Text style={styles.reviewSub}>Tap an entry to change it</Text>
          <ListCard>
            {entries.map((entry, index) => {
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

          <View style={styles.reviewButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={cancel} disabled={saving}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, savableCount === 0 && styles.buttonDisabled]}
              onPress={confirm}
              disabled={savableCount === 0 || saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.saveText}>Save {savableCount} {savableCount === 1 ? 'entry' : 'entries'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <DetailPage
        visible={editing !== null}
        title={editing ? ROW_TITLE[editing.type] ?? 'Check this entry' : undefined}
        onClose={() => setEditingIndex(null)}
      >
        <View style={styles.editorWrap}>
          {editing && editingIndex !== null && (
            <EntryEditor
              key={editingIndex}
              entry={editing}
              active={active}
              onDone={(next) => {
                updateEntry(editingIndex, next);
                setEditingIndex(null);
              }}
              onRemove={() => removeEntry(editingIndex)}
            />
          )}
        </View>
      </DetailPage>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 32,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 10,
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D0D0D5',
    borderRadius: 10,
    padding: 12,
    minHeight: 44,
    fontSize: 15,
    color: '#000',
    backgroundColor: '#FFF',
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D0D0D5',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonActive: {
    backgroundColor: '#FF3B30',
    borderColor: '#FF3B30',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#A9CFFF',
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
  },
  review: {
    marginTop: 16,
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  reviewSub: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
    marginBottom: 10,
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
  saveText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
  },
  editorWrap: {
    paddingHorizontal: 20,
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
