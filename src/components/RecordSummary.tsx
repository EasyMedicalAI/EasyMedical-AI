// The single layout every medical record is shown in, using the same sections and lists as Home:
// header, reason, summary, findings, lab table, diagnoses, medications, next steps, and the original document.
import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { MedicalRecord } from '@/types/medical';
import { LabFlag, formatRecordDate, getDisplayData } from '@/services/recordFormat';
import { decodeEntities } from '@/services/ehrService';
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

// A clinical note from Epic: a Summary tab with the reason and key finding, and a Full note tab with the whole text
function EpicNote({ record }: { record: MedicalRecord }) {
  const [tab, setTab] = useState<'summary' | 'note'>('summary');
  const text = decodeEntities(record.originalText || '');
  const keyFinding = text.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
  const reason = record.reasonForVisit || record.summary;

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>{record.provider}</Text>
        <Text style={styles.subtitle}>
          {[record.specialty, formatRecordDate(record.appointmentDate || record.uploadDate)].filter(Boolean).join(' · ')}
        </Text>
      </View>

      <View style={styles.segmented}>
        {(['summary', 'note'] as const).map((option) => (
          <TouchableOpacity
            key={option}
            style={[styles.segment, tab === option && styles.segmentOn]}
            onPress={() => setTab(option)}
          >
            <Text style={[styles.segmentText, tab === option && styles.segmentTextOn]}>
              {option === 'summary' ? 'Summary' : 'Full note'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'summary' ? (
        <>
          {reason ? (
            <Section title="Reason">
              <ListCard>
                <Text style={styles.rowText}>{reason}</Text>
              </ListCard>
            </Section>
          ) : null}
          {keyFinding ? (
            <Section title="Key finding">
              <ListCard>
                <Text style={styles.rowText}>{keyFinding}</Text>
              </ListCard>
            </Section>
          ) : null}
        </>
      ) : (
        <Section title="Full note">
          <ListCard>
            <Text style={styles.rowText}>{text}</Text>
          </ListCard>
        </Section>
      )}
    </View>
  );
}

export default function RecordSummary({ record }: { record: MedicalRecord }) {
  if (record.source && record.originalText) return <EpicNote record={record} />;
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
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#E9E9EB',
    borderRadius: 9,
    padding: 2,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 7 },
  segmentOn: {
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { fontSize: 14, fontWeight: '500', color: '#000' },
  segmentTextOn: { fontWeight: '600' },
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
