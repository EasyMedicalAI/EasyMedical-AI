// A month calendar of medication doses. Each day shows whether its doses were taken; tapping a day lists them.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { UserHealthData } from '@/types/medical';
import { dateKey, dayCounts, dosesForDate, formatTime, monthCells, toggleDoseLog } from '@/services/doseSchedule';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function MedicationCalendar({
  userData,
  onChangeDoseLog,
}: {
  userData: UserHealthData;
  onChangeDoseLog: (log: Record<string, string>) => void;
}) {
  const today = dateKey(new Date());
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState(today);

  const cells = monthCells(month.getFullYear(), month.getMonth());
  const monthLabel = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const doses = dosesForDate(userData, selected);
  const selectedIsFuture = selected > today;

  // Doses taken across the month, for the summary line
  const monthTotals = cells.reduce(
    (sum, date) => {
      if (!date || date > today) return sum;
      const counts = dayCounts(userData, date);
      return { total: sum.total + counts.total, taken: sum.taken + counts.taken };
    },
    { total: 0, taken: 0 }
  );

  const dotFor = (date: string) => {
    if (date > today) return null;
    const counts = dayCounts(userData, date);
    if (counts.total === 0) return null;
    if (counts.taken === counts.total) return '#34C759';
    if (counts.taken > 0) return '#FF9500';
    return '#C7C7CC';
  };

  const shift = (months: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + months, 1));

  const selectedLabel = new Date(selected + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <View>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => shift(-1)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialCommunityIcons name="chevron-left" size={24} color="#666" />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{monthLabel}</Text>
        <TouchableOpacity onPress={() => shift(1)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <Text style={styles.summary}>
        {monthTotals.total === 0
          ? 'No reminders set yet'
          : `${monthTotals.taken} of ${monthTotals.total} doses taken so far this month`}
      </Text>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((day, index) => (
          <Text key={index} style={styles.weekday}>
            {day}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((date, index) => {
          if (!date) return <View key={index} style={styles.cell} />;
          const dayNumber = parseInt(date.slice(8, 10), 10);
          const dot = dotFor(date);
          const isSelected = date === selected;
          const isFuture = date > today;
          return (
            <TouchableOpacity key={index} style={styles.cell} onPress={() => setSelected(date)}>
              <View style={[styles.dayCircle, isSelected && styles.dayCircleSelected]}>
                <Text style={[styles.dayText, isSelected && styles.dayTextSelected, isFuture && styles.dayTextFuture]}>
                  {dayNumber}
                </Text>
              </View>
              <View style={[styles.dot, { backgroundColor: dot ?? 'transparent' }]} />
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.legend}>
        <LegendItem color="#34C759" label="All taken" />
        <LegendItem color="#FF9500" label="Some taken" />
        <LegendItem color="#C7C7CC" label="Not taken" />
      </View>

      <Text style={styles.selectedTitle}>{selectedLabel}</Text>
      {doses.length === 0 ? (
        <Text style={styles.empty}>No reminders for this day.</Text>
      ) : (
        <View style={styles.doseList}>
          {doses.map((dose, index) => (
            <View key={dose.key} style={[styles.doseRow, index > 0 && styles.doseRowBorder]}>
              <Text style={styles.doseTime}>{formatTime(dose.time)}</Text>
              <Text style={styles.doseName}>{dose.name}</Text>
              <TouchableOpacity
                disabled={selectedIsFuture}
                onPress={() => onChangeDoseLog(toggleDoseLog(userData, dose.key))}
                accessibilityLabel={dose.taken ? 'Mark not taken' : 'Mark taken'}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons
                  name={dose.taken ? 'check-circle' : 'circle-outline'}
                  size={24}
                  color={dose.taken ? '#34C759' : selectedIsFuture ? '#D0D0D5' : '#999'}
                />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      {selectedIsFuture && doses.length > 0 && (
        <Text style={styles.note}>Doses can be marked once they're due.</Text>
      )}
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  summary: {
    fontSize: 13,
    color: '#666',
    marginBottom: 10,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: {
    backgroundColor: '#007AFF',
  },
  dayText: {
    fontSize: 14,
    color: '#000',
  },
  dayTextSelected: {
    color: '#FFF',
    fontWeight: '600',
  },
  dayTextFuture: {
    color: '#AAA',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 3,
  },
  legend: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 5,
  },
  legendText: {
    fontSize: 11,
    color: '#666',
  },
  selectedTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  empty: {
    fontSize: 13,
    color: '#666',
  },
  doseList: {
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
  },
  doseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  doseRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  doseTime: {
    width: 72,
    fontSize: 13,
    color: '#666',
  },
  doseName: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  note: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
});
