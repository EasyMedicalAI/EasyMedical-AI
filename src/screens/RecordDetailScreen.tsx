import React, { useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRecords } from '@/context/RecordsContext';

export default function RecordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { records, deleteRecord } = useRecords();
  const router = useRouter();

  const record = useMemo(() => {
    return records.find(r => r.id === id);
  }, [id, records]);

  if (!record) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Record not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleDelete = () => {
    Alert.alert('Delete Record', 'Are you sure you want to delete this record?', [
      {
        text: 'Cancel',
        onPress: () => {},
      },
      {
        text: 'Delete',
        onPress: async () => {
          await deleteRecord(record.id);
          router.back();
        },
        style: 'destructive',
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete}>
          <Text style={styles.deleteButton}>Delete</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.titleSection}>
          <Text style={styles.provider}>{record.provider}</Text>
          <Text style={styles.specialty}>{record.specialty}</Text>
          <Text style={styles.date}>
            {new Date(record.uploadDate).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>

        {record.imageUri && (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: record.imageUri }}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <Text style={styles.summaryText}>{record.summary}</Text>
        </View>

        {record.extractedData.medications && record.extractedData.medications.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Medications</Text>
            {record.extractedData.medications.map((med, idx) => (
              <View key={idx} style={styles.listItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.itemText}>{med}</Text>
              </View>
            ))}
          </View>
        )}

        {record.extractedData.allergies && record.extractedData.allergies.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, styles.allergyTitle]}>⚠️ Allergies</Text>
            {record.extractedData.allergies.map((allergy, idx) => (
              <View key={idx} style={[styles.listItem, styles.allergyItem]}>
                <Text style={styles.bullet}>⚠️</Text>
                <Text style={styles.itemText}>{allergy}</Text>
              </View>
            ))}
          </View>
        )}

        {record.extractedData.conditions && record.extractedData.conditions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Conditions</Text>
            {record.extractedData.conditions.map((condition, idx) => (
              <View key={idx} style={styles.listItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.itemText}>{condition}</Text>
              </View>
            ))}
          </View>
        )}

        {record.extractedData.testResults && Object.keys(record.extractedData.testResults).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Test Results</Text>
            {Object.entries(record.extractedData.testResults).map(([testName, testValue], idx) => (
              <View key={idx} style={styles.resultItem}>
                <Text style={styles.resultName}>{testName}:</Text>
                <Text style={styles.resultValue}>{testValue}</Text>
              </View>
            ))}
          </View>
        )}

        {record.extractedData.dates && Object.keys(record.extractedData.dates).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Important Dates</Text>
            {Object.entries(record.extractedData.dates).map(([dateType, dateValue], idx) => (
              <View key={idx} style={styles.dateItem}>
                <Text style={styles.dateType}>{dateType}:</Text>
                <Text style={styles.dateValue}>{dateValue}</Text>
              </View>
            ))}
          </View>
        )}

        {record.originalText && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Original Text</Text>
            <View style={styles.originalTextBox}>
              <Text style={styles.originalText}>{record.originalText}</Text>
            </View>
          </View>
        )}
      </View>
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
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backArrow: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  deleteButton: {
    fontSize: 14,
    color: '#FF3333',
    fontWeight: '600',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  content: {
    padding: 20,
  },
  titleSection: {
    marginBottom: 20,
  },
  provider: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  specialty: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '600',
    marginBottom: 4,
  },
  date: {
    fontSize: 13,
    color: '#999',
  },
  imageContainer: {
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFF',
  },
  image: {
    width: '100%',
    height: 300,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  allergyTitle: {
    color: '#FF3333',
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  allergyItem: {
    backgroundColor: '#FFF5F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  bullet: {
    fontSize: 16,
    color: '#007AFF',
    marginRight: 10,
    width: 20,
  },
  itemText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  resultName: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  resultValue: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
  },
  dateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dateType: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  dateValue: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
  },
  originalTextBox: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 12,
    maxHeight: 200,
  },
  originalText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
});
