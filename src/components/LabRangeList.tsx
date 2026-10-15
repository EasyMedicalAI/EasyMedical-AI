// My labs: results grouped by body system. Each result shows where its value sits within its normal range.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { parseRange } from '@/components/LabTrendChart';

export interface LabResult {
  name: string;
  value: string;
  range?: string;
  date: string;
}

const SYSTEM_ORDER = ['Blood sugar', 'Cholesterol', 'Blood count', 'Kidneys', 'Liver', 'Thyroid', 'Electrolytes', 'Vitamins and minerals', 'Other'];

// Which body system a test belongs to, from its name
export function bodySystemFor(name: string): string {
  const rules: Array<[RegExp, string]> = [
    [/a1c|glucose|insulin/i, 'Blood sugar'],
    [/cholesterol|\bldl\b|\bhdl\b|triglyceride/i, 'Cholesterol'],
    [/hemoglobin|hematocrit|\bhgb\b|\bhct\b|\bwbc\b|\brbc\b|platelet|\bmcv\b|\bmch\b|\bmchc\b|\brdw\b|neutrophil|lymphocyte|monocyte|eosinophil|basophil|white blood|red blood/i, 'Blood count'],
    [/creatinine|\bbun\b|urea|egfr|microalbumin|albumin.*creatinine|urine.*albumin/i, 'Kidneys'],
    [/\balt\b|\bast\b|alkaline phosphatase|bilirubin|albumin|total protein|\bggt\b/i, 'Liver'],
    [/\btsh\b|thyroid|\bt4\b|\bt3\b/i, 'Thyroid'],
    [/sodium|potassium|chloride|\bco2\b|bicarbonate|calcium|magnesium|phosphate/i, 'Electrolytes'],
    [/vitamin|b12|folate|ferritin|\biron\b/i, 'Vitamins and minerals'],
  ];
  return rules.find(([pattern]) => pattern.test(name))?.[1] ?? 'Other';
}

// Where the value sits on a bar that spans its normal range, with some room either side
function rangeBar(value: string, range?: string) {
  const v = parseFloat(value);
  const { low, high } = parseRange(range);
  if (isNaN(v) || (low === undefined && high === undefined)) return null;

  let min: number;
  let max: number;
  if (low !== undefined && high !== undefined) {
    const span = high - low || 1;
    min = low - span * 0.3;
    max = high + span * 0.3;
  } else if (high !== undefined) {
    min = 0;
    max = high * 1.5;
  } else {
    min = (low as number) * 0.5;
    max = (low as number) * 1.5;
  }
  const bandStart = low ?? min;
  const bandEnd = high ?? max;
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  return {
    marker: clamp((v - min) / (max - min || 1)),
    bandStart: clamp((bandStart - min) / (max - min || 1)),
    bandEnd: clamp((bandEnd - min) / (max - min || 1)),
    inRange: v >= bandStart && v <= bandEnd,
  };
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function LabRangeList({ labs, onSelect }: { labs: LabResult[]; onSelect: (name: string) => void }) {
  const groups = SYSTEM_ORDER.map((system) => ({
    system,
    labs: labs
      .filter((lab) => bodySystemFor(lab.name) === system)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((group) => group.labs.length > 0);

  return (
    <View>
      {groups.map((group) => (
        <View key={group.system} style={styles.group}>
          <Text style={styles.groupTitle}>{group.system}</Text>
          <View style={styles.card}>
            {group.labs.map((lab, index) => {
              const bar = rangeBar(lab.value, lab.range);
              return (
                <React.Fragment key={lab.name}>
                  {index > 0 && <View style={styles.divider} />}
                  <TouchableOpacity style={styles.row} onPress={() => onSelect(lab.name)}>
                    <View style={styles.topLine}>
                      <Text style={styles.name}>{lab.name}</Text>
                      <Text style={[styles.value, bar && !bar.inRange && styles.valueOutside]}>{lab.value}</Text>
                    </View>
                    {bar && (
                      <View style={styles.track}>
                        <View style={[styles.band, { left: `${bar.bandStart * 100}%`, width: `${(bar.bandEnd - bar.bandStart) * 100}%` }]} />
                        <View
                          style={[
                            styles.marker,
                            { left: `${bar.marker * 100}%`, backgroundColor: bar.inRange ? '#34C759' : '#FF9500' },
                          ]}
                        />
                      </View>
                    )}
                    <View style={styles.bottomLine}>
                      <Text style={styles.rangeText}>{lab.range ? lab.range : 'No normal range listed'}</Text>
                      <Text style={styles.date}>{shortDate(lab.date)}</Text>
                    </View>
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginBottom: 20,
  },
  groupTitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  row: {
    paddingVertical: 14,
  },
  topLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  name: {
    fontSize: 15,
    color: '#333',
    flex: 1,
    paddingRight: 8,
  },
  value: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000',
  },
  valueOutside: {
    color: '#B45309',
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FCEFD9',
  },
  band: {
    position: 'absolute',
    top: 0,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D8F3DC',
  },
  marker: {
    position: 'absolute',
    top: -3,
    width: 14,
    height: 14,
    marginLeft: -7,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  bottomLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  rangeText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
    paddingRight: 8,
  },
  date: {
    fontSize: 12,
    color: '#999',
  },
});
