// A simple line chart of blood pressure: the top number in blue and the bottom number in purple, by date.
// Thin green lines mark the normal limits (120 for the top number, 80 for the bottom). Built from plain Views,
// so it needs no extra native module.
import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';

export interface BloodPressurePoint {
  date: string;
  systolic: number;
  diastolic: number;
}

const PLOT_HEIGHT = 180;
const PAD_LEFT = 34;
const PAD_RIGHT = 36;
const PAD_TOP = 10;
const PAD_BOTTOM = 26;
const MIN = 60;
const MAX = 160;
const TOP_COLOR = '#007AFF';
const BOTTOM_COLOR = '#AF52DE';
const NORMAL_COLOR = '#34C759';
const SCREEN_PADDING = 40; // matches the blood pressure screen's horizontal padding

export default function BloodPressureChart({ points }: { points: BloodPressurePoint[] }) {
  const { width: screenWidth } = useWindowDimensions();
  if (points.length === 0) return null;

  const width = screenWidth - SCREEN_PADDING;
  const plotWidth = width - PAD_LEFT - PAD_RIGHT;
  const x = (i: number) => PAD_LEFT + (points.length === 1 ? plotWidth / 2 : (i / (points.length - 1)) * plotWidth);
  const y = (value: number) => PAD_TOP + (1 - (Math.min(Math.max(value, MIN), MAX) - MIN) / (MAX - MIN)) * PLOT_HEIGHT;
  const last = points.length - 1;

  // A straight line between two points, drawn as a thin rotated bar
  const segment = (x1: number, y1: number, x2: number, y2: number, color: string, key: string) => {
    const length = Math.hypot(x2 - x1, y2 - y1);
    const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    return (
      <View
        key={key}
        style={{
          position: 'absolute',
          left: (x1 + x2) / 2 - length / 2,
          top: (y1 + y2) / 2 - 1,
          width: length,
          height: 2,
          backgroundColor: color,
          transform: [{ rotate: `${angle}deg` }],
        }}
      />
    );
  };

  const dot = (cx: number, cy: number, color: string, key: string) => (
    <View
      key={key}
      style={{ position: 'absolute', left: cx - 4, top: cy - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: color }}
    />
  );

  const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <View>
      <View style={{ width, height: PAD_TOP + PLOT_HEIGHT + PAD_BOTTOM }}>
        {/* Scale labels */}
        {[60, 100, 140].map((value) => (
          <Text key={`scale-${value}`} style={[styles.scale, { top: y(value) - 7 }]}>
            {value}
          </Text>
        ))}

        {/* Normal limits */}
        <View style={[styles.limit, { top: y(120), left: PAD_LEFT, width: plotWidth }]} />
        <View style={[styles.limit, { top: y(80), left: PAD_LEFT, width: plotWidth }]} />
        <Text style={[styles.limitLabel, { top: y(120) - 7, left: PAD_LEFT + plotWidth + 4 }]}>120</Text>
        <Text style={[styles.limitLabel, { top: y(80) - 7, left: PAD_LEFT + plotWidth + 4 }]}>80</Text>

        {/* Top number */}
        {points.slice(1).map((p, i) =>
          segment(x(i), y(points[i].systolic), x(i + 1), y(p.systolic), TOP_COLOR, `sys-line-${i}`)
        )}
        {points.map((p, i) => dot(x(i), y(p.systolic), TOP_COLOR, `sys-dot-${i}`))}

        {/* Bottom number */}
        {points.slice(1).map((p, i) =>
          segment(x(i), y(points[i].diastolic), x(i + 1), y(p.diastolic), BOTTOM_COLOR, `dia-line-${i}`)
        )}
        {points.map((p, i) => dot(x(i), y(p.diastolic), BOTTOM_COLOR, `dia-dot-${i}`))}

        {/* Latest values */}
        <Text style={[styles.latest, { top: y(points[last].systolic) - 8, left: x(last) + 6, color: TOP_COLOR }]}>
          {points[last].systolic}
        </Text>
        <Text style={[styles.latest, { top: y(points[last].diastolic) - 8, left: x(last) + 6, color: BOTTOM_COLOR }]}>
          {points[last].diastolic}
        </Text>

        {/* Dates along the bottom */}
        <Text style={[styles.date, { top: PAD_TOP + PLOT_HEIGHT + 6, left: x(0) - 4 }]}>{shortDate(points[0].date)}</Text>
        {points.length > 1 && (
          <Text style={[styles.date, { top: PAD_TOP + PLOT_HEIGHT + 6, right: width - x(last) - 4 }]}>
            {shortDate(points[last].date)}
          </Text>
        )}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: TOP_COLOR }]} />
          <Text style={styles.legendText}>Top number</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: BOTTOM_COLOR }]} />
          <Text style={styles.legendText}>Bottom number</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: NORMAL_COLOR }]} />
          <Text style={styles.legendText}>Normal limit</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scale: { position: 'absolute', left: 0, width: 28, textAlign: 'right', fontSize: 11, color: '#8E8E93' },
  limit: { position: 'absolute', height: StyleSheet.hairlineWidth * 2, backgroundColor: NORMAL_COLOR },
  limitLabel: { position: 'absolute', fontSize: 11, color: '#248A3D', fontWeight: '600' },
  latest: { position: 'absolute', fontSize: 13, fontWeight: '700' },
  date: { position: 'absolute', fontSize: 11, color: '#8E8E93' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 12, color: '#8E8E93' },
});
