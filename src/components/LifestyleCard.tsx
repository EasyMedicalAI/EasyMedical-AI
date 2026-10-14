// Lifestyle: sleep, exercise, and food, logged by hand. Tapping a row opens its chart and history, where entries can be added or removed.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, ScrollView, StyleSheet, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { rowIconSize } from '@/components/rowIcons';
import { useRecords } from '@/context/RecordsContext';

type Kind = 'sleep' | 'exercise' | 'meal';
type DrinkKind = 'water' | 'coffee' | 'alcohol' | 'sugary';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const todayText = () => {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
};

// MM/DD/YYYY -> a date at midday, or today's exact time. Null if it isn't a real, non-future date.
const parseDay = (text: string): Date | null => {
  const m = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const month = parseInt(m[1], 10), day = parseInt(m[2], 10), year = parseInt(m[3], 10);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  if (date.getTime() > Date.now() + 24 * 60 * 60 * 1000) return null;
  return date.toDateString() === new Date().toDateString() ? new Date() : date;
};

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const shortDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const CHART_HEIGHT = 120;
const PRESET_ACTIVITIES = ['Walking', 'Running', 'Cycling', 'Strength', 'HIIT', 'Yoga', 'Swimming'];
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const MEAL_TAGS = ['Vegetables', 'Fruit', 'Whole grains', 'Protein', 'High sugar', 'High salt', 'Fried', 'Processed'];
const DRINK_KINDS: { key: DrinkKind; label: string }[] = [
  { key: 'water', label: 'Water' },
  { key: 'coffee', label: 'Coffee or tea' },
  { key: 'alcohol', label: 'Alcoholic drinks' },
  { key: 'sugary', label: 'Sugary drinks' },
];
const DIET_OPTIONS = ['Low sodium', 'Diabetic diet', 'Gluten-free', 'Vegetarian', 'Dairy-free'];

type Bar = { date: string; value: number };

// Bar chart, oldest on the left. The tallest bar is at least `floor`, so small values still look small.
function BarChart({ bars, floor }: { bars: Bar[]; floor: number }) {
  const max = Math.max(floor, ...bars.map((b) => b.value));
  return (
    <View>
      <View style={styles.bars}>
        {bars.map((b, i) => (
          <View key={`${b.date}-${i}`} style={styles.barColumn}>
            <Text style={styles.barValue}>{b.value > 0 ? b.value : ''}</Text>
            <View style={[styles.bar, { height: (b.value / max) * (CHART_HEIGHT - 40) }]} />
          </View>
        ))}
      </View>
      <View style={styles.chartDates}>
        <Text style={styles.chartDate}>{shortDay(bars[0].date)}</Text>
        <Text style={styles.chartDate}>{shortDay(bars[bars.length - 1].date)}</Text>
      </View>
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function LifestyleCard() {
  const { userData, patchUserData } = useRecords();
  const [open, setOpen] = useState<Kind | null>(null);
  const [value, setValue] = useState('');
  const [date, setDate] = useState('');
  const [activity, setActivity] = useState('');
  const [typingActivity, setTypingActivity] = useState(false);
  const [mealType, setMealType] = useState('');
  const [mealTags, setMealTags] = useState<string[]>([]);

  const sleep = [...(userData.sleepHistory || [])].sort((a, b) => b.date.localeCompare(a.date));
  const exercise = [...(userData.exerciseHistory || [])].sort((a, b) => b.date.localeCompare(a.date));
  const meals = [...(userData.mealHistory || [])].sort((a, b) => b.date.localeCompare(a.date));
  const drinksToday = (userData.drinkHistory || []).filter((d) => isToday(d.date));

  // Sleep is an average of the nights logged in the last 7 days.
  const recentSleep = sleep.filter((e) => Date.now() - new Date(e.date).getTime() <= WEEK_MS);
  const sleepAverage = recentSleep.length ? recentSleep.reduce((sum, e) => sum + e.hours, 0) / recentSleep.length : null;
  const sleepBars: Bar[] = [...sleep].slice(0, 14).reverse().map((e) => ({ date: e.date, value: e.hours }));

  // Exercise is a total of the last 7 days. The chart has one bar per day for the last 14 days, including days with none.
  const recentExercise = exercise.filter((e) => Date.now() - new Date(e.date).getTime() <= WEEK_MS);
  const weekMinutes = recentExercise.reduce((sum, e) => sum + e.minutes, 0);
  const exerciseBars: Bar[] = Array.from({ length: 14 }, (_, i) => {
    const day = new Date();
    day.setHours(12, 0, 0, 0);
    day.setDate(day.getDate() - (13 - i));
    const key = day.toDateString();
    const minutes = exercise
      .filter((e) => new Date(e.date).toDateString() === key)
      .reduce((sum, e) => sum + e.minutes, 0);
    return { date: day.toISOString(), value: minutes };
  });
  // Minutes per activity this week. Entries with no name are grouped together.
  const weekByActivity = Object.entries(
    recentExercise.reduce<Record<string, number>>((totals, e) => {
      const name = e.activity || 'No activity name';
      totals[name] = (totals[name] || 0) + e.minutes;
      return totals;
    }, {})
  ).sort((a, b) => b[1] - a[1]);
  // Activity choices: the presets, plus any names already used in the history.
  const activityOptions = Array.from(
    new Set([...PRESET_ACTIVITIES, ...exercise.map((e) => e.activity).filter((name): name is string => !!name)])
  );

  const mealsToday = meals.filter((m) => isToday(m.date));
  const drinkCount = (kind: DrinkKind) => drinksToday.filter((d) => d.kind === kind).length;

  const latestLine = (kind: Kind) => {
    if (kind === 'sleep') {
      if (sleep.length === 0) return 'Nothing logged yet';
      if (sleepAverage === null) return 'No nights logged in the last 7 days';
      return `${sleepAverage.toFixed(1)} hours avg · ${recentSleep.length} night${recentSleep.length === 1 ? '' : 's'}`;
    }
    if (kind === 'exercise') {
      if (exercise.length === 0) return 'Nothing logged yet';
      if (recentExercise.length === 0) return 'Nothing logged in the last 7 days';
      return `${weekMinutes} min this week · ${recentExercise.length} session${recentExercise.length === 1 ? '' : 's'}`;
    }
    const parts: string[] = [];
    if (mealsToday.length) parts.push(`${mealsToday.length} meal${mealsToday.length === 1 ? '' : 's'} today`);
    else if (meals[0]) parts.push(`Last: ${meals[0].description}`);
    if (drinksToday.length) parts.push(`${drinksToday.length} drink${drinksToday.length === 1 ? '' : 's'} today`);
    return parts.length ? parts.join(' · ') : 'Nothing logged yet';
  };

  const openDetail = (kind: Kind) => {
    setValue('');
    setDate(todayText());
    setActivity('');
    setTypingActivity(false);
    setMealType('');
    setMealTags([]);
    setOpen(kind);
  };

  // Drinks are counted per tap. Minus removes the most recent drink of that kind logged today.
  const adjustDrink = async (kind: DrinkKind, delta: number) => {
    const all = userData.drinkHistory || [];
    if (delta > 0) {
      await patchUserData({ drinkHistory: [...all, { date: new Date().toISOString(), kind }] });
      return;
    }
    const index = all.map((d) => d.kind === kind && isToday(d.date)).lastIndexOf(true);
    if (index < 0) return;
    await patchUserData({ drinkHistory: all.filter((_, i) => i !== index) });
  };

  const toggleDiet = (name: string) => {
    const current = userData.dietProfile || [];
    patchUserData({ dietProfile: current.includes(name) ? current.filter((n) => n !== name) : [...current, name] });
  };

  const toggleMealTag = (tag: string) =>
    setMealTags((current) => (current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]));

  const save = async () => {
    if (!open) return;
    const when = parseDay(date);
    if (!when) {
      Alert.alert('Check the date', 'Please use MM/DD/YYYY. The date cannot be in the future.');
      return;
    }
    const stamp = when.toISOString();
    if (open === 'sleep') {
      const hours = Number(value);
      if (!value.trim() || isNaN(hours) || hours < 0 || hours > 24) return Alert.alert('Check the hours', 'Enter the hours slept, for example 7.5.');
      await patchUserData({ sleepHistory: [...(userData.sleepHistory || []), { date: stamp, hours }] });
    } else if (open === 'exercise') {
      const minutes = Number(value);
      if (!value.trim() || isNaN(minutes) || minutes <= 0) return Alert.alert('Check the minutes', 'Enter the minutes exercised, for example 30.');
      const name = activity.trim();
      await patchUserData({
        exerciseHistory: [...(userData.exerciseHistory || []), { date: stamp, minutes, ...(name ? { activity: name } : {}) }],
      });
    } else {
      if (!value.trim()) return Alert.alert('Add a note', 'Describe what you ate or drank.');
      await patchUserData({
        mealHistory: [
          ...(userData.mealHistory || []),
          {
            date: stamp,
            description: value.trim(),
            ...(mealType ? { mealType } : {}),
            ...(mealTags.length ? { tags: mealTags } : {}),
          },
        ],
      });
    }
    setValue('');
    setActivity('');
    setTypingActivity(false);
    setMealType('');
    setMealTags([]);
  };

  const remove = (kind: Kind, index: number) => {
    Alert.alert('Delete entry', 'Remove this entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (kind === 'sleep') await patchUserData({ sleepHistory: (userData.sleepHistory || []).filter((_, i) => i !== index) });
          if (kind === 'exercise') await patchUserData({ exerciseHistory: (userData.exerciseHistory || []).filter((_, i) => i !== index) });
          if (kind === 'meal') await patchUserData({ mealHistory: (userData.mealHistory || []).filter((_, i) => i !== index) });
        },
      },
    ]);
  };

  const titles: Record<Kind, string> = { sleep: 'Sleep', exercise: 'Exercise', meal: 'Food' };
  const prompts: Record<Kind, string> = {
    sleep: 'Hours slept',
    exercise: 'Minutes exercised',
    meal: 'What you ate or drank',
  };
  const list = open === 'sleep' ? sleep : open === 'exercise' ? exercise : meals;
  const mealDetail = (item: { mealType?: string; tags?: string[] }) => [item.mealType, ...(item.tags || [])].filter(Boolean).join(' · ');

  const rows: { kind: Kind; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }[] = [
    { kind: 'sleep', label: 'Sleep', icon: 'moon-waning-crescent' },
    { kind: 'exercise', label: 'Exercise', icon: 'run' },
    { kind: 'meal', label: 'Food', icon: 'food-fork-drink' },
  ];

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Lifestyle</Text>
        </View>
      </View>

      <View style={styles.card}>
        {rows.map((row, index) => (
          <React.Fragment key={row.kind}>
            {index > 0 && <View style={styles.divider} />}
            <TouchableOpacity style={styles.row} onPress={() => openDetail(row.kind)}>
              <MaterialCommunityIcons name={row.icon} size={rowIconSize(row.icon)} color="#666" style={styles.rowIcon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{row.label}</Text>
                <Text style={styles.latest}>{latestLine(row.kind)}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#C7C7CC" style={styles.rowChevron} />
            </TouchableOpacity>
          </React.Fragment>
        ))}

        <Modal visible={open !== null} animationType="slide" onRequestClose={() => setOpen(null)}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setOpen(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.close}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent}>
              {open && (
                <>
                  <Text style={styles.title}>{titles[open]}</Text>

                  {open === 'meal' && (
                    <>
                      <Text style={styles.sectionLabel}>Drinks today</Text>
                      {DRINK_KINDS.map((d) => (
                        <View key={d.key} style={styles.counterRow}>
                          <Text style={styles.counterLabel}>{d.label}</Text>
                          <View style={styles.stepper}>
                            <TouchableOpacity style={styles.stepButton} onPress={() => adjustDrink(d.key, -1)} accessibilityLabel={`Remove a ${d.label.toLowerCase()}`}>
                              <Text style={styles.stepText}>−</Text>
                            </TouchableOpacity>
                            <Text style={styles.stepCount}>{drinkCount(d.key)}</Text>
                            <TouchableOpacity style={styles.stepButton} onPress={() => adjustDrink(d.key, 1)} accessibilityLabel={`Add a ${d.label.toLowerCase()}`}>
                              <Text style={styles.stepText}>+</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </>
                  )}

                  {open === 'sleep' && sleepBars.length > 0 && (
                    <>
                      <Text style={styles.sectionLabel}>Last {sleepBars.length} nights</Text>
                      <BarChart bars={sleepBars} floor={10} />
                      {sleepAverage !== null && (
                        <Text style={styles.summaryText}>
                          7-day average: {sleepAverage.toFixed(1)} hours ({recentSleep.length} night{recentSleep.length === 1 ? '' : 's'})
                        </Text>
                      )}
                    </>
                  )}

                  {open === 'exercise' && exercise.length > 0 && (
                    <>
                      <Text style={styles.sectionLabel}>Last 14 days (minutes)</Text>
                      <BarChart bars={exerciseBars} floor={30} />
                      <Text style={styles.summaryText}>
                        7-day total: {weekMinutes} min ({recentExercise.length} session{recentExercise.length === 1 ? '' : 's'})
                      </Text>
                      {weekByActivity.map(([name, total]) => (
                        <Text key={name} style={styles.summaryDetail}>{`${name}: ${total} min`}</Text>
                      ))}
                    </>
                  )}

                  <Text style={styles.fieldLabel}>{prompts[open]}</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType={open === 'meal' ? 'default' : 'decimal-pad'}
                    placeholder={open === 'sleep' ? 'e.g. 7.5' : open === 'exercise' ? 'e.g. 30' : 'e.g. chicken salad for lunch'}
                    placeholderTextColor="#999"
                    value={value}
                    onChangeText={setValue}
                    multiline={open === 'meal'}
                  />

                  {open === 'meal' && (
                    <>
                      <Text style={styles.fieldLabel}>Meal (optional)</Text>
                      <View style={styles.chipRow}>
                        {MEAL_TYPES.map((name) => (
                          <Chip key={name} label={name} selected={mealType === name} onPress={() => setMealType(mealType === name ? '' : name)} />
                        ))}
                      </View>
                      <Text style={styles.fieldLabel}>Tags (optional)</Text>
                      <View style={styles.chipRow}>
                        {MEAL_TAGS.map((tag) => (
                          <Chip key={tag} label={tag} selected={mealTags.includes(tag)} onPress={() => toggleMealTag(tag)} />
                        ))}
                      </View>
                    </>
                  )}

                  {open === 'exercise' && (
                    <>
                      <Text style={styles.fieldLabel}>Activity (optional)</Text>
                      <View style={styles.chipRow}>
                        {activityOptions.map((name) => (
                          <Chip
                            key={name}
                            label={name}
                            selected={!typingActivity && activity === name}
                            onPress={() => {
                              setActivity(name);
                              setTypingActivity(false);
                            }}
                          />
                        ))}
                        <Chip
                          label="+ New"
                          selected={typingActivity}
                          onPress={() => {
                            setActivity('');
                            setTypingActivity(true);
                          }}
                        />
                      </View>
                      {typingActivity && (
                        <TextInput
                          style={styles.input}
                          placeholder="e.g. Pickleball"
                          placeholderTextColor="#999"
                          value={activity}
                          onChangeText={setActivity}
                        />
                      )}
                    </>
                  )}

                  <Text style={styles.fieldLabel}>Date (MM/DD/YYYY)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numbers-and-punctuation"
                    placeholder="e.g. 10/14/2026"
                    placeholderTextColor="#999"
                    value={date}
                    onChangeText={setDate}
                  />

                  <TouchableOpacity style={styles.button} onPress={save}>
                    <Text style={styles.buttonText}>Save</Text>
                  </TouchableOpacity>

                  <Text style={styles.sectionLabel}>History</Text>
                  {list.length === 0 && <Text style={styles.empty}>Nothing logged yet.</Text>}
                  {list.map((item: any, index: number) => {
                    const original = (open === 'sleep' ? userData.sleepHistory : open === 'exercise' ? userData.exerciseHistory : userData.mealHistory) || [];
                    const originalIndex = original.indexOf(item);
                    const main = open === 'sleep' ? `${item.hours} hours` : open === 'exercise' ? `${item.minutes} minutes${item.activity ? ` · ${item.activity}` : ''}` : item.description;
                    const detail = open === 'meal' ? mealDetail(item) : '';
                    return (
                      <View key={`${item.date}-${index}`} style={styles.historyRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.historyValue}>{main}</Text>
                          <Text style={styles.historyDate}>{detail ? `${formatDay(item.date)} · ${detail}` : formatDay(item.date)}</Text>
                        </View>
                        <TouchableOpacity onPress={() => remove(open, originalIndex)}>
                          <Text style={styles.delete}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}

                  {open === 'meal' && (
                    <>
                      <Text style={styles.sectionLabel}>Diet profile</Text>
                      <Text style={styles.helper}>Set once. Shown to your doctor.</Text>
                      <View style={styles.chipRow}>
                        {DIET_OPTIONS.map((name) => (
                          <Chip key={name} label={name} selected={(userData.dietProfile || []).includes(name)} onPress={() => toggleDiet(name)} />
                        ))}
                      </View>
                    </>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </Modal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 10,
  },
  sectionIcon: {
    fontSize: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  sectionMeta: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  latest: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  rowIcon: {
    width: 22,
    marginRight: 12,
  },
  rowChevron: {
    marginLeft: 8,
  },
  modal: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  close: {
    fontSize: 26,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalContent: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    marginBottom: 6,
  },
  helper: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#000',
    backgroundColor: '#FFF',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 6,
  },
  empty: {
    color: '#666',
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 10,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barValue: {
    fontSize: 9,
    color: '#666',
    marginBottom: 2,
  },
  bar: {
    width: '70%',
    maxWidth: 18,
    minHeight: 2,
    borderRadius: 3,
    backgroundColor: '#007AFF',
  },
  chartDates: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  chartDate: {
    fontSize: 11,
    color: '#999',
  },
  summaryText: {
    fontSize: 14,
    color: '#333',
    marginTop: 10,
  },
  summaryDetail: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  counterLabel: {
    fontSize: 15,
    color: '#333',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D0D0D0',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    fontSize: 20,
    color: '#333',
  },
  stepCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    minWidth: 20,
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
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
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  historyValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  historyDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  delete: {
    color: '#FF3B30',
    fontWeight: '600',
    marginLeft: 12,
  },
});
