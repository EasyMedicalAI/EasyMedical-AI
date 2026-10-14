// The single layout every medical record is shown in, using the same sections and lists as Home:
// header, reason, summary, findings, lab table, diagnoses, medications, next steps, and the original document.
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { MedicalRecord } from '@/types/medical';
import { LabFlag, formatRecordDate, getDisplayData } from '@/services/recordFormat';
import { Section, ListCard, ListRow, Divider } from '@/components/ScreenKit';

const FLAG_STYLE: Record<LabFlag, { label: string; color: string }> = {
  normal: { label: 'Normal', color: '#34C759' },
  high: { label: 'High', color: '#FF9500' },
  low: { label: 'Low', color: '#FF9500' },
  abnormal: { label: 'Abnormal', color: '#FF3B30' },
  unknown: { label: '—', color: '#999' },
};

// One or more lines of text, each in its own row of a list
function TextList({ items }: { items: string[] }) {
  return (
    <ListCard>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <Divider />}
          <Text style={styles.rowText}>{item}</Text>
        </React.Fragment>
      ))}
    </ListCard>
  );
}

export default function RecordSummary({ record }: { record: MedicalRecord }) {
  const data = getDisplayData(record);
  const subtitle = [data.provider ? data.specialty : '', formatRecordDate(data.date), data.facility]
    .filter(Boolean)
    .join(' · ');

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>{data.provider || data.specialty}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      {data.reason ? (
        <Section title="Reason">
          <ListCard>
            <Text style={styles.rowText}>{data.reason}</Text>
          </ListCard>
        </Section>
      ) : null}

      {data.summary ? (
        <Section title="Summary">
          <ListCard>
            <Text style={styles.rowText}>{data.summary}</Text>
          </ListCard>
        </Section>
      ) : null}

      {data.keyFindings.length > 0 && (
        <Section title="Key findings">
          <TextList items={data.keyFindings} />
        </Section>
      )}

      {data.labResults.length > 0 && (
        <Section title="Lab results">
          <ListCard>
            <View style={styles.labHeaderRow}>
              <Text style={[styles.labHeaderText, styles.labName]}>Test</Text>
              <Text style={[styles.labHeaderText, styles.labValue]}>Result</Text>
              <Text style={[styles.labHeaderText, styles.labRange]}>Normal range</Text>
              <Text style={[styles.labHeaderText, styles.labFlag]}>Flag</Text>
            </View>
            {data.labResults.map((lab, index) => {
              const flag = FLAG_STYLE[lab.flag] || FLAG_STYLE.unknown;
              return (
                <React.Fragment key={`${lab.name}-${index}`}>
                  <Divider />
                  <View style={styles.labRow}>
                    <Text style={[styles.labNameText, styles.labName]}>{lab.name}</Text>
                    <Text style={[styles.labResultValue, styles.labValue]}>
                      {[lab.value, lab.unit].filter(Boolean).join(' ')}
                    </Text>
                    <Text style={[styles.labRangeText, styles.labRange]}>{lab.referenceRange || '—'}</Text>
                    <View style={styles.labFlag}>
                      <Text style={[styles.flagPill, { color: flag.color, borderColor: flag.color }]}>{flag.label}</Text>
                    </View>
                  </View>
                </React.Fragment>
              );
            })}
          </ListCard>
        </Section>
      )}

      {data.diagnoses.length > 0 && (
        <Section title="Diagnoses">
          <TextList items={data.diagnoses} />
        </Section>
      )}

      {data.medications.length > 0 && (
        <Section title="Medications">
          <ListCard>
            {data.medications.map((med, index) => (
              <React.Fragment key={`${med.name}-${index}`}>
                {index > 0 && <Divider />}
                <ListRow
                  icon="pill"
                  label={[med.name, med.dose].filter(Boolean).join(' · ')}
                  hint={med.instructions || undefined}
                />
              </React.Fragment>
            ))}
          </ListCard>
        </Section>
      )}

      {data.nextSteps.length > 0 && (
        <Section title="Next steps">
          <TextList items={data.nextSteps} />
        </Section>
      )}

      {record.imageUri && (
        <Section title="Original document">
          <ListCard>
            <Image source={{ uri: record.imageUri }} style={styles.image} resizeMode="contain" />
          </ListCard>
        </Section>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  rowText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#222',
    paddingVertical: 14,
  },
  labHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 10,
  },
  labHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  labRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  labName: {
    flex: 2.2,
    paddingRight: 6,
  },
  labNameText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
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
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  labRangeText: {
    fontSize: 13,
    color: '#666',
  },
  flagPill: {
    fontSize: 11,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 320,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    marginVertical: 8,
  },
});
