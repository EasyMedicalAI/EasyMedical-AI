// Trend chart for one lab test: each result plotted by date, with the normal range shaded.
// Built from plain Views, so it needs no extra native module.
import React, { useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';

export interface TrendPoint {
  value: string;
  date: string;
}

const PLOT_HEIGHT = 170;
const PAD_LEFT = 46;
const PAD_RIGHT = 14;
const PAD_TOP = 14;
const PAD_BOTTOM = 30;
const CONTAINER_PADDING = 20; // matches the lab history screen's horizontal padding

const IN_RANGE = '#34C759';
const OUT_OF_RANGE = '#FF9500';
const NEUTRAL = '#007AFF';
const LINE = '#7FB4F5';

// First number in a result string, e.g. "5.1 %" -> 5.1. NaN when there isn't one.
const toNumber = (value: string): number => {
  const match = String(value).match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : NaN;
};

// Reads the bounds from a reference range such as "70–99 mg/dL", "Below 5.7%", or "Above 40 mg/dL"
export function parseRange(range?: string): { low?: number; high?: number } {
  if (!range) return {};
  const text = range.replace(/[–—]/g, '-');

  const between = text.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (between) return { low: parseFloat(between[1]), high: parseFloat(between[2]) };

  const upper = text.match(/(?:below|under|less than|up to|<|≤)\s*(\d+(?:\.\d+)?)/i);
  if (upper) return { high: parseFloat(upper[1]) };

  const lower = text.match(/(?:above|over|greater than|at least|>|≥)\s*(\d+(?:\.\d+)?)/i);
  if (lower) return { low: parseFloat(lower[1]) };

  return {};
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });

const formatAxis = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(1));

export default function LabTrendChart({ history, range }: { history: TrendPoint[]; range?: string }) {
  const { width: screenWidth } = useWindowDimensions();
  // Use the width the chart actually gets on screen, so it fits inside whatever card holds it
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const containerWidth = measuredWidth ?? screenWidth - CONTAINER_PADDING * 2;
  const plotWidth = containerWidth - PAD_LEFT - PAD_RIGHT;

  const points = history
    .map((p) => ({ time: new Date(p.date).getTime(), value: toNumber(p.value), date: p.date }))
    .filter((p) => !isNaN(p.time) && !isNaN(p.value))
    .sort((a, b) => a.time - b.time);

  if (points.length === 0) {
    return <Text style={styles.empty}>No numeric results to chart for this test.</Text>;
  }

  const { low, high } = parseRange(range);

  // Vertical scale covers every result and the normal range, with a little room at the top and bottom
  const candidates = [...points.map((p) => p.value), low, high].filter(
    (v): v is number => v !== undefined && !isNaN(v)
  );
  let min = Math.min(...candidates);
  let max = Math.max(...candidates);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  min -= span * 0.1;
  max += span * 0.1;

  const yFor = (v: number) => PAD_TOP + (1 - (v - min) / (max - min)) * PLOT_HEIGHT;

  // Horizontal scale is by date, so results from far apart sit far apart
  const tMin = points[0].time;
  const tMax = points[points.length - 1].time;
  const xFor = (t: number) =>
    tMax === tMin ? PAD_LEFT + plotWidth / 2 : PAD_LEFT + ((t - tMin) / (tMax - tMin)) * plotWidth;

  const inRange = (v: number) => (low === undefined || v >= low) && (high === undefined || v <= high);
  const hasRange = low !== undefined || high !== undefined;

  // Shaded normal band, clipped to the plot
  const bandTop = high !== undefined ? yFor(high) : PAD_TOP;
  const bandBottom = low !== undefined ? yFor(low) : PAD_TOP + PLOT_HEIGHT;

  const showAllDates = points.length <= 6;

  return (
    <View
      style={[styles.wrapper, { overflow: 'hidden' }]}
      onLayout={(e) => setMeasuredWidth(e.nativeEvent.layout.width)}
    >
      <View style={{ width: containerWidth, height: PLOT_HEIGHT + PAD_TOP + PAD_BOTTOM }}>
        {/* Normal range band */}
        {hasRange && (
          <>
            <View
              style={[
                styles.band,
                {
                  left: PAD_LEFT,
                  width: plotWidth,
                  top: Math.max(PAD_TOP, bandTop),
                  height: Math.max(0, Math.min(PAD_TOP + PLOT_HEIGHT, bandBottom) - Math.max(PAD_TOP, bandTop)),
                },
              ]}
            />
            <Text style={[styles.bandLabel, { left: PAD_LEFT + 6, top: Math.max(PAD_TOP, bandTop) + 3 }]}>
              Normal range
            </Text>
          </>
        )}

        {/* Axes */}
        <View style={[styles.axisLine, { left: PAD_LEFT, top: PAD_TOP, height: PLOT_HEIGHT }]} />
        <View style={[styles.axisLine, { left: PAD_LEFT, top: PAD_TOP + PLOT_HEIGHT, width: plotWidth, height: 1 }]} />
        <Text style={[styles.axisLabel, { left: 0, top: PAD_TOP - 6, width: PAD_LEFT - 6 }]}>{formatAxis(max)}</Text>
        <Text
          style={[styles.axisLabel, { left: 0, top: PAD_TOP + PLOT_HEIGHT - 6, width: PAD_LEFT - 6 }]}
        >
          {formatAxis(min)}
        </Text>

        {/* Lines between consecutive results */}
        {points.slice(1).map((p, i) => {
          const prev = points[i];
          const x1 = xFor(prev.time);
          const y1 = yFor(prev.value);
          const x2 = xFor(p.time);
          const y2 = yFor(p.value);
          const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
          const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
          return (
            <View
              key={`line-${i}`}
              style={[
                styles.segment,
                {
                  width: length,
                  left: (x1 + x2) / 2 - length / 2,
                  top: (y1 + y2) / 2 - 1,
                  transform: [{ rotate: `${angle}deg` }],
                },
              ]}
            />
          );
        })}

        {/* Result points, value labels, and date labels */}
        {points.map((p, i) => {
          const x = xFor(p.time);
          const y = yFor(p.value);
          const color = !hasRange ? NEUTRAL : inRange(p.value) ? IN_RANGE : OUT_OF_RANGE;
          const showLabel = points.length <= 10;
          const showDate = showAllDates || i === 0 || i === points.length - 1;
          return (
            <React.Fragment key={`point-${i}`}>
              <View style={[styles.point, { left: x - 7, top: y - 7, backgroundColor: color }]} />
              {showLabel && (
                <Text style={[styles.pointLabel, { left: x - 30, width: 60, top: y - 24 }]}>
                  {String(p.value)}
                </Text>
              )}
              {showDate && (
                <Text
                  style={[
                    styles.dateLabel,
                    { left: Math.min(Math.max(x - 32, 0), containerWidth - 64), width: 64, top: PAD_TOP + PLOT_HEIGHT + 6 },
                  ]}
                >
                  {shortDate(p.date)}
                </Text>
              )}
            </React.Fragment>
          );
        })}
      </View>

      <View style={styles.legend}>
        {hasRange && (
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: '#D4F2DF' }]} />
            <Text style={styles.legendText}>Normal range</Text>
          </View>
        )}
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: IN_RANGE }]} />
          <Text style={styles.legendText}>In range</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: OUT_OF_RANGE }]} />
          <Text style={styles.legendText}>Outside range</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 20,
  },
  empty: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 20,
  },
  band: {
    position: 'absolute',
    backgroundColor: '#E8F8EE',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#B7E6C8',
  },
  bandLabel: {
    position: 'absolute',
    fontSize: 10,
    fontWeight: '600',
    color: '#2E8B57',
  },
  axisLine: {
    position: 'absolute',
    width: 1,
    backgroundColor: '#BBB',
  },
  axisLabel: {
    position: 'absolute',
    fontSize: 11,
    color: '#666',
    textAlign: 'right',
  },
  segment: {
    position: 'absolute',
    height: 2,
    backgroundColor: LINE,
  },
  point: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  pointLabel: {
    position: 'absolute',
    fontSize: 12,
    fontWeight: '700',
    color: '#222',
    textAlign: 'center',
  },
  dateLabel: {
    position: 'absolute',
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 14,
    height: 10,
    borderRadius: 2,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    color: '#666',
  },
});
