// The single layout every medical record is shown in: header, reason, summary, findings,
// lab table, diagnoses, medications, next steps, and the original document.
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { MedicalRecord } from '@/types/medical';
import { LabFlag, formatRecordDate, getDisplayData } from '@/services/recordFormat';

const FLAG_STYLE: Record<LabFlag, { label: string; color: string }> = {
  normal: { label: 'Normal', color: '#34C759' },
  high: { label: 'High', color: '#FF9500' },
  low: { label: 'Low', color: '#FF9500' },
  abnormal: { label: 'Abnormal', color: '#FF3B30' },
  unknown: { label: '—', color: '#999' },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((item, index) => (
        <View key={index} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.body}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export default function RecordSummary({ record }: { record: MedicalRecord }) {
  const data = getDisplayData(record);

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.specialty}>{data.specialty}</Text>
        <Text style={styles.date}>{formatRecordDate(data.date)}</Text>
        {data.provider ? <Text style={styles.provider}>{data.provider}</Text> : null}
        {data.facility ? <Text style={styles.facility}>{data.facility}</Text> : null}
      </View>

      {data.reason ? (
        <Section title="Reason">
          <Text style={styles.body}>{data.reason}</Text>
        </Section>
      ) : null}

      {data.summary ? (
        <Section title="Summary">
          <Text style={styles.body}>{data.summary}</Text>
        </Section>
      ) : null}

      {data.keyFindings.length > 0 && (
        <Section title="Key findings">
          <Bullets items={data.keyFindings} />
        </Section>
      )}

      {data.labResults.length > 0 && (
        <Section title="Lab results">
          <View style={styles.labHeaderRow}>
            <Text style={[styles.labHeaderText, styles.labName]}>Test</Text>
            <Text style={[styles.labHeaderText, styles.labValue]}>Result</Text>
            <Text style={[styles.labHeaderText, styles.labRange]}>Normal range</Text>
            <Text style={[styles.labHeaderText, styles.labFlag]}>Flag</Text>
          </View>
          {data.labResults.map((lab, index) => {
            const flag = FLAG_STYLE[lab.flag] || FLAG_STYLE.unknown;
            return (
              <View key={`${lab.name}-${index}`} style={styles.labRow}>
                <Text style={[styles.body, styles.labName]}>{lab.name}</Text>
                <Text style={[styles.labResultValue, styles.labValue]}>
                  {[lab.value, lab.unit].filter(Boolean).join(' ')}
                </Text>
                <Text style={[styles.labRangeText, styles.labRange]}>{lab.referenceRange || '—'}</Text>
                <View style={styles.labFlag}>
                  <Text style={[styles.flagPill, { color: flag.color, borderColor: flag.color }]}>{flag.label}</Text>
                </View>
              </View>
            );
          })}
        </Section>
      )}

      {data.diagnoses.length > 0 && (
        <Section title="Diagnoses">
          <Bullets items={data.diagnoses} />
        </Section>
      )}

      {data.medications.length > 0 && (
        <Section title="Medications">
          {data.medications.map((med, index) => (
            <View key={`${med.name}-${index}`} style={styles.medCard}>
              <Text style={styles.medName}>
                {[med.name, med.dose].filter(Boolean).join(' · ')}
              </Text>
              {med.instructions ? <Text style={styles.body}>{med.instructions}</Text> : null}
            </View>
          ))}
        </Section>
      )}

      {data.nextSteps.length > 0 && (
        <Section title="Next steps">
          <Bullets items={data.nextSteps} />
        </Section>
      )}

      {record.imageUri && (
        <Section title="Original document">
          <Image source={{ uri: record.imageUri }} style={styles.image} resizeMode="contain" />
        </Section>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  specialty: {
    fontSize: 12,
    fontWeight: '700',
    color: '#007AFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  date: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
  },
  provider: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginTop: 4,
  },
  facility: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: '#222',
    flexShrink: 1,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  bulletDot: {
    fontSize: 15,
    color: '#007AFF',
    width: 16,
  },
  labHeaderRow: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#DDD',
  },
  labHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
  },
  labRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  labName: {
    flex: 2.2,
    paddingRight: 6,
  },
  labValue: {
    flex: 1.2,
    paddingRight: 6,
  },
  labRange: {
    flex: 1.6,
    paddingRight: 6,
  },
  labFlag: {
    flex: 1.2,
    alignItems: 'flex-start',
  },
  labResultValue: {
    fontWeight: '700',
    color: '#000',
  },
  labRangeText: {
    fontSize: 13,
    color: '#666',
  },
  flagPill: {
    fontSize: 11,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  medCard: {
    backgroundColor: '#F7F9FC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  medName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    marginBottom: 2,
  },
  image: {
    width: '100%',
    height: 320,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
});
