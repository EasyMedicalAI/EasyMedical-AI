// The one date picker used across the app: a field that opens the native spinner wheels under it.
// Screens that store dates as MM/DD/YYYY text can convert with dateFromText and textFromDate.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

const pad = (n: number) => String(n).padStart(2, '0');

// "10/14/2026" -> a date, or null if it isn't a real date
export function dateFromText(text: string): Date | null {
  const match = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const date = new Date(parseInt(match[3], 10), month - 1, day, 12);
  return date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

// A date -> "10/14/2026"
export const textFromDate = (date: Date) => `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()}`;

const formatLong = (date: Date) => date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

export default function DateWheel({
  label,
  value,
  onChange,
  placeholder = 'Choose a date',
  minimumDate,
  maximumDate,
}: {
  label?: string;
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      {label ? <Text style={styles.label}>{label.toUpperCase()}</Text> : null}
      <TouchableOpacity style={styles.field} onPress={() => setOpen(!open)}>
        <Text style={value ? styles.value : styles.placeholder}>{value ? formatLong(value) : placeholder}</Text>
      </TouchableOpacity>
      {open && (
        <DateTimePicker
          value={value ?? new Date()}
          mode="date"
          display="spinner" textColor="#000"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(_, picked) => picked && onChange(new Date(picked.getFullYear(), picked.getMonth(), picked.getDate(), 12))}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 6,
  },
  field: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 50,
    justifyContent: 'center',
    marginBottom: 4,
  },
  value: { fontSize: 17, color: '#000' },
  placeholder: { fontSize: 17, color: '#8E8E93' },
});
