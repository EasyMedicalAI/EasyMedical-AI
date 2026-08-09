import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRecords } from '@/context/RecordsContext';
import { LabMetric } from '@/types/medical';

interface MetricDetailScreenProps {
  metricName: string;
  onBack?: () => void;
}

export default function MetricDetailScreen({
  metricName,
  onBack,
}: MetricDetailScreenProps) {
  const { loading, getMetricHistory, calculateTrend } = useRecords();

  const history = useMemo(() => {
    if (!metricName) return [];
    return getMetricHistory(metricName);
  }, [metricName, loading]);

  const trend = useMemo(() => {
    return calculateTrend(metricName);
  }, [metricName, loading]);

  const stats = useMemo(() => {
    if (history.length === 0) {
      return { min: null, max: null, avg: null, latest: null };
    }

    const numericValues = history
      .map(m => {
        if (typeof m.value === 'number') return m.value;
        const parsed = parseFloat(String(m.value));
        return isNaN(parsed) ? null : parsed;
      })
      .filter(v => v !== null) as number[];

    if (numericValues.length === 0) {
      return { min: null, max: null, avg: null, latest: null };
    }

    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);
    const avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
    const latest = history.length > 0 ? history[history.length - 1] : null;

    return {
      min: min.toFixed(1),
      max: max.toFixed(1),
      avg: avg.toFixed(1),
      latest,
    };
  }, [history]);

  const trendIcon = {
    up: '📈',
    down: '📉',
    stable: '→',
    insufficient: '—',
  }[trend];

  const trendLabel = {
    up: 'Increasing',
    down: 'Decreasing',
    stable: 'Stable',
    insufficient: 'Insufficient Data',
  }[trend];

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (history.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => onBack?.()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{metricName}</Text>
          <View />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No history available for this metric</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onBack?.()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{metricName}</Text>
        <View />
      </View>

      {/* Trend Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.trendSection}>
          <Text style={styles.trendIcon}>{trendIcon}</Text>
          <View style={styles.trendInfo}>
            <Text style={styles.trendLabel}>{trendLabel}</Text>
            <Text style={styles.trendSubtext}>
              {history.length} measurement{history.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </View>

      {/* Statistics Cards */}
      <View style={styles.statsContainer}>
        {stats.latest && (
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Latest</Text>
            <Text style={styles.statValue}>
              {stats.latest.value}
              <Text style={styles.statUnit}> {stats.latest.unit}</Text>
            </Text>
            <Text style={styles.statDate}>
              {new Date(stats.latest.date).toLocaleDateString()}
            </Text>
          </View>
        )}

        {stats.avg && (
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Average</Text>
            <Text style={styles.statValue}>
              {stats.avg}
              <Text style={styles.statUnit}> {history[0].unit}</Text>
            </Text>
          </View>
        )}

        {stats.min && (
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Low</Text>
            <Text style={styles.statValue}>{stats.min}</Text>
          </View>
        )}

        {stats.max && (
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>High</Text>
            <Text style={styles.statValue}>{stats.max}</Text>
          </View>
        )}
      </View>

      {/* History Timeline */}
      <View style={styles.historySection}>
        <Text style={styles.historyTitle}>📋 Measurement History</Text>

        {history.map((metric, index) => {
          const statusColor = {
            normal: '#34C759',
            abnormal: '#FF3B30',
            unknown: '#999',
          }[metric.status];

          const isLatest = index === history.length - 1;

          return (
            <View key={metric.id} style={styles.timelineItem}>
              {index < history.length - 1 && (
                <View style={styles.timelineConnector} />
              )}

              <View style={[styles.timelineMarker, { borderColor: statusColor }]} />

              <View style={styles.timelineContent}>
                <View style={styles.timelineHeader}>
                  <Text style={styles.timelineDate}>
                    {new Date(metric.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                  {isLatest && <Text style={styles.latestBadge}>Latest</Text>}
                </View>

                <View style={styles.timelineValue}>
                  <Text style={styles.value}>
                    {metric.value}
                    <Text style={styles.unit}> {metric.unit}</Text>
                  </Text>
                </View>

                <Text style={[styles.statusBadge, { color: statusColor }]}>
                  {metric.status.charAt(0).toUpperCase() + metric.status.slice(1)}
                </Text>

                {metric.normalRange && (
                  <Text style={styles.rangeInfo}>
                    Normal range: {metric.normalRange.min} - {metric.normalRange.max} {metric.unit}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.spacing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    flex: 1,
    textAlign: 'center',
  },
  summaryCard: {
    margin: 20,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  trendSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trendIcon: {
    fontSize: 32,
  },
  trendInfo: {
    flex: 1,
  },
  trendLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  trendSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  statUnit: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  statDate: {
    fontSize: 11,
    color: '#999',
  },
  historySection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  timelineItem: {
    marginBottom: 20,
    position: 'relative',
  },
  timelineConnector: {
    position: 'absolute',
    left: 11,
    top: 40,
    bottom: -20,
    width: 2,
    backgroundColor: '#E0E0E0',
  },
  timelineMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: '#FFF',
    marginBottom: 12,
  },
  timelineContent: {
    marginLeft: 40,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timelineDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  latestBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#007AFF',
    backgroundColor: '#E6F4FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timelineValue: {
    marginBottom: 8,
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  unit: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  rangeInfo: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    minHeight: 300,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  spacing: {
    height: 40,
  },
});
