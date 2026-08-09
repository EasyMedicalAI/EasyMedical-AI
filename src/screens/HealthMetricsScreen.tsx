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

type TrendType = 'up' | 'down' | 'stable' | 'insufficient';

interface MetricCardProps {
  name: string;
  value: string | number;
  unit: string;
  status: 'normal' | 'abnormal' | 'unknown';
  trend: TrendType;
  date: string;
  onPress: () => void;
}

const getTrendIcon = (trend: TrendType): string => {
  switch (trend) {
    case 'up':
      return '📈';
    case 'down':
      return '📉';
    case 'stable':
      return '→';
    case 'insufficient':
      return '—';
  }
};

const getTrendLabel = (trend: TrendType): string => {
  switch (trend) {
    case 'up':
      return 'Increasing';
    case 'down':
      return 'Decreasing';
    case 'stable':
      return 'Stable';
    case 'insufficient':
      return 'Insufficient Data';
  }
};

const MetricCard: React.FC<MetricCardProps> = ({
  name,
  value,
  unit,
  status,
  trend,
  date,
  onPress,
}) => {
  const statusColor = {
    normal: '#34C759',
    abnormal: '#FF3B30',
    unknown: '#999',
  }[status];

  return (
    <TouchableOpacity
      style={[styles.metricCard, { borderLeftColor: statusColor }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.metricHeader}>
        <Text style={styles.metricName}>{name}</Text>
        <Text style={styles.trendIcon}>{getTrendIcon(trend)}</Text>
      </View>

      <View style={styles.metricValue}>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>

      <View style={styles.metricFooter}>
        <Text style={[styles.status, { color: statusColor }]}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Text>
        <Text style={styles.date}>{new Date(date).toLocaleDateString()}</Text>
      </View>

      <Text style={styles.trendLabel}>{getTrendLabel(trend)}</Text>
    </TouchableOpacity>
  );
};

interface HealthMetricsScreenProps {
  onMetricPress?: (metricName: string) => void;
}

export default function HealthMetricsScreen({
  onMetricPress,
}: HealthMetricsScreenProps) {
  const {
    loading,
    getLatestMetrics,
    getUniqueMetricNames,
    calculateTrend,
    getMetricHistory,
  } = useRecords();

  const metricCards = useMemo(() => {
    const latestMetrics = getLatestMetrics();
    if (latestMetrics.size === 0) return [];

    return Array.from(latestMetrics.values()).map(metric => ({
      metric,
      trend: calculateTrend(metric.name),
      history: getMetricHistory(metric.name),
    }));
  }, [loading]);

  const handleMetricPress = (metricName: string) => {
    if (onMetricPress) {
      onMetricPress(metricName);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (metricCards.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <View />
          <Text style={styles.appName}>EasyMedical AI</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>📊 Health Metrics</Text>
          <Text style={styles.emptyText}>
            No lab metrics found. Upload lab results to start tracking your health metrics.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <View />
        <Text style={styles.appName}>EasyMedical AI</Text>
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>📊 Health Metrics</Text>
        <Text style={styles.subtitle}>Your latest lab values and trends</Text>
      </View>

      <View style={styles.content}>
        {metricCards.map(({ metric, trend, history }) => (
          <MetricCard
            key={metric.id}
            name={metric.name}
            value={metric.value}
            unit={metric.unit}
            status={metric.status}
            trend={trend}
            date={metric.date}
            onPress={() => handleMetricPress(metric.name)}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          💡 Tap any metric to see its history and trends
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  metricCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  trendIcon: {
    fontSize: 20,
    marginLeft: 8,
  },
  metricValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  value: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
  },
  unit: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  metricFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  status: {
    fontSize: 12,
    fontWeight: '600',
  },
  date: {
    fontSize: 12,
    color: '#999',
  },
  trendLabel: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    minHeight: 300,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
});
