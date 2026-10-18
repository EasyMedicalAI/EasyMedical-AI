// The form for adding or editing a medication: name, dose, how often, start and end dates, reminder times, and days to skip.
// The label photo scan is a separate option, not part of this form.
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { dateFromKey, dateKey, formatTime, shiftDate } from '@/services/doseSchedule';
import { UserHealthData } from '@/types/medical';

export interface MedicationFormValues {
  name: string;
  dose: string;
  frequency: string;
  startDate: Date | null; // null when the start isn't known (some medications from Epic)
  endDate: Date | null; // null for no end date
  times: string[]; // "HH:MM"
  skipDays: number[]; // 0 = Sunday ... 6 = Saturday
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n: number) => String(n).padStart(2, '0');

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function blankMedicationForm(): MedicationFormValues {
  return { name: '', dose: '', frequency: '', startDate: startOfDay(new Date()), endDate: null, times: ['08:00'], skipDays: [] };
}

// The form as it was saved for a medication
export function formFromMedication(
  name: string,
  active?: NonNullable<UserHealthData['medicationHistory']>[number]
): MedicationFormValues {
  return {
    name,
    dose: active?.dose || '',
    frequency: active?.frequency || '',
    startDate: active?.startDate ? startOfDay(new Date(active.startDate)) : null,
    endDate: active?.lastDoseDate ? dateFromKey(active.lastDoseDate) : null,
    times: [...(active?.reminderTimes || [])].sort(),
    skipDays: [...(active?.skipDays || [])].sort(),
  };
}

// The saved fields for a medication. Empty fields are cleared.
export function medicationFieldsFromForm(form: MedicationFormValues) {
  return {
    dose: form.dose.trim() || undefined,
    frequency: form.frequency.trim() || undefined,
    startDate: form.startDate ? startOfDay(form.startDate).toISOString() : undefined,
    lastDoseDate: form.endDate ? dateKey(form.endDate) : undefined,
    reminderTimes: form.times.length > 0 ? [...form.times].sort() : undefined,
    skipDays: form.skipDays.length > 0 ? [...form.skipDays].sort() : undefined,
  };
}

const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const toDate = (time: string) => {
  const [hour, minute] = time.split(':').map((n) => parseInt(n, 10));
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
};
const toTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Which picker is open: the start or end date, one reminder time, or a new time being added (index null)
type Open = { kind: 'start' | 'end' } | { kind: 'time'; index: number | null } | null;

export default function MedicationForm({
  value,
  onChange,
}: {
  value: MedicationFormValues;
  onChange: (patch: Partial<MedicationFormValues>) => void;
}) {
  const [open, setOpen] = useState<Open>(null);
  const [newTime, setNewTime] = useState('08:00');
  const today = startOfDay(new Date());

  const toggle = (next: Open) => setOpen((current) => (JSON.stringify(current) === JSON.stringify(next) ? null : next));
  const isOpen = (next: Open) => JSON.stringify(open) === JSON.stringify(next);

  return (
    <View>
      <Text style={styles.label}>MEDICATION NAME</Text>
      <TextInput
        style={styles.input}
        value={value.name}
        onChangeText={(name) => onChange({ name })}
        placeholder="e.g. Lisinopril"
        placeholderTextColor="#8E8E93"
      />

      <Text style={styles.label}>
        DOSE <Text style={styles.optional}>(OPTIONAL)</Text>
      </Text>
      <TextInput
        style={styles.input}
        value={value.dose}
        onChangeText={(dose) => onChange({ dose })}
        placeholder="e.g. 10 mg"
        placeholderTextColor="#8E8E93"
      />

      <Text style={styles.label}>FREQUENCY</Text>
      <TextInput
        style={styles.input}
        value={value.frequency}
        onChangeText={(frequency) => onChange({ frequency })}
        placeholder="e.g. twice daily"
        placeholderTextColor="#8E8E93"
      />

      <Text style={styles.label}>START DATE</Text>
      <TouchableOpacity style={styles.input} onPress={() => toggle({ kind: 'start' })}>
        <Text style={styles.inputText}>{value.startDate ? formatDate(value.startDate) : 'Not set'}</Text>
      </TouchableOpacity>
      {isOpen({ kind: 'start' }) && (
        <>
                <DateTimePicker
          value={value.startDate ?? today}
          mode="date"
          display="spinner" textColor="#000"
          onChange={(_, date) => date && onChange({ startDate: startOfDay(date) })}
        />
              <TouchableOpacity style={styles.wheelDone} onPress={() => setOpen(null)}>
                <Text style={styles.wheelDoneText}>Done</Text>
              </TouchableOpacity>
                </>
      )}

      <Text style={styles.label}>
        END DATE <Text style={styles.optional}>(OPTIONAL)</Text>
      </Text>
      <TouchableOpacity style={styles.input} onPress={() => toggle({ kind: 'end' })}>
        <Text style={value.endDate ? styles.inputText : styles.placeholderText}>
          {value.endDate ? formatDate(value.endDate) : 'No end date'}
        </Text>
      </TouchableOpacity>
      {value.endDate && (
        <TouchableOpacity
          onPress={() => {
            onChange({ endDate: null });
            setOpen(null);
          }}
        >
          <Text style={styles.link}>Remove end date</Text>
        </TouchableOpacity>
      )}
      {isOpen({ kind: 'end' }) && (
        <>
                <DateTimePicker
          value={value.endDate ?? shiftDateObject(value.startDate ?? today, 30)}
          mode="date"
          display="spinner" textColor="#000"
          minimumDate={value.startDate ?? today}
          onChange={(_, date) => date && onChange({ endDate: startOfDay(date) })}
        />
              <TouchableOpacity style={styles.wheelDone} onPress={() => setOpen(null)}>
                <Text style={styles.wheelDoneText}>Done</Text>
              </TouchableOpacity>
                </>
      )}

      {value.times.length === 0 && <Text style={styles.hint}>No reminders yet. Add a time to be reminded.</Text>}
      {value.times.map((time, index) => (
        <View key={index}>
          <Text style={styles.label}>REMINDER TIME</Text>
          <TouchableOpacity style={styles.input} onPress={() => toggle({ kind: 'time', index })}>
            <Text style={styles.inputText}>{formatTime(time)}</Text>
          </TouchableOpacity>
          {isOpen({ kind: 'time', index }) && (
            <>
              <>
                <DateTimePicker
                value={toDate(time)}
                mode="time"
                display="spinner" textColor="#000"
                onChange={(_, date) =>
                  date && onChange({ times: value.times.map((t, i) => (i === index ? toTime(date) : t)) })
                }
              />
              <TouchableOpacity style={styles.wheelDone} onPress={() => setOpen(null)}>
                <Text style={styles.wheelDoneText}>Done</Text>
              </TouchableOpacity>
                </>
              <TouchableOpacity
                onPress={() => {
                  onChange({ times: value.times.filter((_, i) => i !== index) });
                  setOpen(null);
                }}
              >
                <Text style={styles.removeLink}>Remove this time</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ))}
      <TouchableOpacity
        onPress={() => {
          setNewTime('08:00');
          toggle({ kind: 'time', index: null });
        }}
      >
        <Text style={styles.addLink}>+ Add reminder time</Text>
      </TouchableOpacity>
      {isOpen({ kind: 'time', index: null }) && (
        <>
          <>
                <DateTimePicker
            value={toDate(newTime)}
            mode="time"
            display="spinner" textColor="#000"
            onChange={(_, date) => date && setNewTime(toTime(date))}
          />
              <TouchableOpacity style={styles.wheelDone} onPress={() => setOpen(null)}>
                <Text style={styles.wheelDoneText}>Done</Text>
              </TouchableOpacity>
                </>
          <TouchableOpacity
            onPress={() => {
              if (!value.times.includes(newTime)) onChange({ times: [...value.times, newTime].sort() });
              setOpen(null);
            }}
          >
            <Text style={styles.link}>Add {formatTime(newTime)}</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={styles.divider} />

      <Text style={styles.label}>
        SKIP DAYS <Text style={styles.optional}>(OPTIONAL)</Text>
      </Text>
      <Text style={styles.hint}>Tap days to skip. For example, skip Sunday for "daily except Sunday".</Text>
      <View style={styles.dayRow}>
        {DAY_NAMES.map((name, day) => {
          const skipped = value.skipDays.includes(day);
          return (
            <TouchableOpacity
              key={name}
              style={[styles.dayPill, skipped && styles.dayPillOn]}
              onPress={() =>
                onChange({
                  skipDays: skipped ? value.skipDays.filter((d) => d !== day) : [...value.skipDays, day].sort(),
                })
              }
            >
              <Text style={[styles.dayText, skipped && styles.dayTextOn]}>{name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function shiftDateObject(d: Date, days: number): Date {
  return dateFromKey(shiftDate(dateKey(d), days));
}

const styles = StyleSheet.create({
  wheelDone: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 4, marginTop: 4 },
  wheelDoneText: { fontSize: 17, color: '#007AFF', fontWeight: '600' },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 6,
  },
  optional: {
    fontWeight: '400',
    letterSpacing: 0,
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 50,
    justifyContent: 'center',
    fontSize: 17,
    color: '#000',
  },
  inputText: {
    fontSize: 17,
    color: '#000',
  },
  placeholderText: {
    fontSize: 17,
    color: '#8E8E93',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  addLink: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '500',
    marginBottom: 6,
  },
  hint: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 8,
  },
  timeRow: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 50,
    justifyContent: 'center',
    marginBottom: 8,
  },
  link: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '500',
    marginTop: 8,
  },
  removeLink: {
    fontSize: 15,
    color: '#FF3B30',
    fontWeight: '500',
    marginTop: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#D0D0D5',
    marginTop: 24,
  },
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D0D0D5',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#FFF',
  },
  dayPillOn: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  dayText: {
    fontSize: 15,
    color: '#000',
    fontWeight: '500',
  },
  dayTextOn: {
    color: '#FFF',
  },
});
