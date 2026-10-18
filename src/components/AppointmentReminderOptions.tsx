// How often to get notifications about upcoming appointments. Shown at the bottom of the Appointments page.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Section, ListCard, Divider } from '@/components/ScreenKit';
import { UserHealthData } from '@/types/medical';

export type AppointmentReminderLevel = NonNullable<UserHealthData['appointmentReminders']>;

const OPTIONS: { value: AppointmentReminderLevel; label: string; description: string }[] = [
  { value: 'off', label: 'Off', description: 'No notifications about appointments' },
  { value: 'day', label: 'Day before only', description: '9:00 AM the day before' },
  { value: 'standard', label: 'Standard', description: 'The day before, and an hour before' },
  { value: 'frequent', label: 'Frequent', description: 'A week before, the day before, and an hour before' },
];

export default function AppointmentReminderOptions({
  value,
  onChange,
}: {
  value: AppointmentReminderLevel;
  onChange: (value: AppointmentReminderLevel) => void;
}) {
  return (
    <Section title="Appointment notifications">
      <ListCard>
        {OPTIONS.map((option, index) => {
          const selected = option.value === value;
          return (
            <React.Fragment key={option.value}>
              {index > 0 && <Divider />}
              <TouchableOpacity
                style={styles.row}
                onPress={() => onChange(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View style={styles.text}>
                  <Text style={styles.label}>{option.label}</Text>
                  <Text style={styles.description}>{option.description}</Text>
                </View>
                {selected && <MaterialCommunityIcons name="check" size={20} color="#007AFF" />}
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </ListCard>
    </Section>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  text: {
    flex: 1,
    marginRight: 12,
  },
  label: {
    fontSize: 16,
    color: '#000',
  },
  description: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
});
