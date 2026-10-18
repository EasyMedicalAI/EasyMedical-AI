// Add or edit an appointment: doctor, specialty, date, and time. The date and time wheels open under their fields.
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { appointmentMoment } from '@/services/reminders';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n: number) => String(n).padStart(2, '0');

// The date and time as saved: "October 20, 2026 • 2:00 PM"
export function formatAppointmentDateTime(date: Date, time: Date): string {
  const hour = time.getHours();
  const shown = hour % 12 === 0 ? 12 : hour % 12;
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} • ${shown}:${pad(time.getMinutes())} ${hour < 12 ? 'AM' : 'PM'}`;
}

// The date and time of a saved appointment. Without a time, 9:00 AM is used.
export function appointmentPartsFrom(dateTime: string): { date: Date; time: Date } {
  const moment = appointmentMoment(dateTime) || { at: new Date(), hasTime: false };
  const date = new Date(moment.at.getFullYear(), moment.at.getMonth(), moment.at.getDate());
  return { date, time: moment.hasTime ? moment.at : defaultAppointmentTime() };
}

// 9:00 AM today, the starting time for a new appointment
export function defaultAppointmentTime(): Date {
  const time = new Date();
  time.setHours(9, 0, 0, 0);
  return time;
}

type Open = 'date' | 'time' | null;

export default function AppointmentEditor({
  visible,
  isEditing,
  doctorName,
  specialty,
  date,
  time,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  visible: boolean;
  isEditing: boolean;
  doctorName: string;
  specialty: string;
  date: Date;
  time: Date;
  onChange: (patch: { doctorName?: string; specialty?: string; date?: Date; time?: Date }) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState<Open>(null);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{isEditing ? 'Edit appointment' : 'New appointment'}</Text>
          <TouchableOpacity onPress={onSave} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.save}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>DOCTOR</Text>
          <TextInput
            style={styles.input}
            value={doctorName}
            onChangeText={(value) => onChange({ doctorName: value })}
            placeholder="e.g. Dr. Sarah Johnson"
            placeholderTextColor="#8E8E93"
          />

          <Text style={styles.label}>SPECIALTY</Text>
          <TextInput
            style={styles.input}
            value={specialty}
            onChangeText={(value) => onChange({ specialty: value })}
            placeholder="e.g. Cardiology"
            placeholderTextColor="#8E8E93"
          />

          <Text style={styles.label}>DATE</Text>
          <TouchableOpacity style={styles.input} onPress={() => setOpen(open === 'date' ? null : 'date')}>
            <Text style={styles.inputText}>
              {date.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
          </TouchableOpacity>
          {open === 'date' && (
            <DateTimePicker
              value={date}
              mode="date"
              display="spinner"
              onChange={(_, picked) => picked && onChange({ date: new Date(picked.getFullYear(), picked.getMonth(), picked.getDate()) })}
            />
          )}

          <Text style={styles.label}>TIME</Text>
          <TouchableOpacity style={styles.input} onPress={() => setOpen(open === 'time' ? null : 'time')}>
            <Text style={styles.inputText}>
              {time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>
          {open === 'time' && (
            <DateTimePicker value={time} mode="time" display="spinner" onChange={(_, picked) => picked && onChange({ time: picked })} />
          )}

          {isEditing && onDelete && (
            <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
              <Text style={styles.deleteText}>Delete appointment</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
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
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  cancel: {
    fontSize: 17,
    color: '#007AFF',
  },
  save: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
  form: {
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
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
  },
  inputText: {
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
  deleteText: {
    fontSize: 17,
    color: '#FF3B30',
    fontWeight: '500',
  },
});
