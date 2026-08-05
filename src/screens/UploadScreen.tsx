import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRecords } from '@/context/RecordsContext';
import { claudeService } from '@/services/claudeService';
import { useRouter } from 'expo-router';
import { v4 as uuidv4 } from 'uuid';

export default function UploadScreen() {
  const [activeTab, setActiveTab] = useState<'photo' | 'text' | 'gallery'>('photo');
  const [textInput, setTextInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  // Initialize with today's date
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth()); // Today's month
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate()); // Today's day
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear()); // Today's year
  const [recordDate, setRecordDate] = useState('');
  const { addRecord } = useRecords();
  const router = useRouter();

  const handlePhotoCapture = async () => {
    Alert.alert('Coming Soon', 'Camera upload feature coming soon. Use text input for now!');
  };

  const handlePhotoLibrary = async () => {
    Alert.alert('Coming Soon', 'Gallery upload feature coming soon. Use text input for now!');
  };

  const handleDatePickerDone = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedDate = `${months[selectedMonth]} ${selectedDay}, ${selectedYear}`;
    setRecordDate(formattedDate);
    setShowDatePicker(false);
  };

  const processImage = async (base64: string) => {
    setLoading(true);
    try {
      const recordId = uuidv4();
      const parsedRecord = await claudeService.parseRecordFromImage(base64, recordId);

      await addRecord({
        id: recordId,
        uploadDate: parsedRecord.uploadDate || new Date().toISOString(),
        imageUri: parsedRecord.imageUri,
        specialty: parsedRecord.specialty || 'Unspecified',
        provider: parsedRecord.provider || 'Unknown',
        summary: parsedRecord.summary || 'Document uploaded',
        extractedData: parsedRecord.extractedData || {},
        processed: true,
      });

      Alert.alert('Success', 'Record uploaded and processed', [
        {
          text: 'View Record',
          onPress: () => router.push(`/detail/${recordId}`),
        },
        {
          text: 'Back to Home',
          onPress: () => router.push('/'),
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to process image: ' + String(error));
      console.error('Image processing error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTextSubmit = async () => {
    if (textInput.trim().length < 10) {
      Alert.alert('Error', 'Please enter at least 10 characters');
      return;
    }

    setLoading(true);
    try {
      const recordId = uuidv4();
      const parsedRecord = await claudeService.parseRecordFromText(textInput, recordId);

      await addRecord({
        id: recordId,
        uploadDate: recordDate || parsedRecord.uploadDate || new Date().toISOString(),
        originalText: parsedRecord.originalText,
        specialty: parsedRecord.specialty || 'Unspecified',
        provider: parsedRecord.provider || 'Unknown',
        summary: parsedRecord.summary || 'Document uploaded',
        extractedData: parsedRecord.extractedData || {},
        processed: true,
      });

      setTextInput('');
      setRecordDate('');
      Alert.alert('Success', 'Record uploaded and processed', [
        {
          text: 'View Record',
          onPress: () => router.push(`/detail/${recordId}`),
        },
        {
          text: 'Back to Home',
          onPress: () => router.push('/'),
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to process text: ' + String(error));
      console.error('Text processing error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.topBar}>
        <View />
        <Text style={styles.appName}>EasyMedical AI</Text>
      </View>
      <View style={styles.header}>
        <Text style={styles.title}>Upload Medical Record</Text>
        <Text style={styles.subtitle}>Choose how to add your record</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'photo' && styles.activeTab]}
          onPress={() => setActiveTab('photo')}
        >
          <Text style={[styles.tabText, activeTab === 'photo' && styles.activeTabText]}>
            📷 Camera
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'gallery' && styles.activeTab]}
          onPress={() => setActiveTab('gallery')}
        >
          <Text style={[styles.tabText, activeTab === 'gallery' && styles.activeTabText]}>
            🖼️ Gallery
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'text' && styles.activeTab]}
          onPress={() => setActiveTab('text')}
        >
          <Text style={[styles.tabText, activeTab === 'text' && styles.activeTabText]}>
            ✏️ Text
          </Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Processing your record...</Text>
        </View>
      )}

      {!loading && activeTab === 'photo' && (
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardIcon}>📷</Text>
            <Text style={styles.cardTitle}>Take a Photo</Text>
            <Text style={styles.cardSubtitle}>
              Use your camera to photograph medical records
            </Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handlePhotoCapture}
              disabled={loading}
            >
              <Text style={styles.actionButtonText}>Open Camera</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!loading && activeTab === 'gallery' && (
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardIcon}>🖼️</Text>
            <Text style={styles.cardTitle}>Choose from Gallery</Text>
            <Text style={styles.cardSubtitle}>
              Select a photo from your device
            </Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handlePhotoLibrary}
              disabled={loading}
            >
              <Text style={styles.actionButtonText}>Open Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!loading && activeTab === 'text' && (
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardIcon}>✏️</Text>
            <Text style={styles.cardTitle}>Manual Entry</Text>
            <Text style={styles.cardSubtitle}>
              Type or paste your medical information
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter medical information..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={8}
              value={textInput}
              onChangeText={setTextInput}
            />
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateButtonLabel}>📅 Date of Appointment</Text>
              <Text style={styles.dateButtonValue}>
                {recordDate || 'Tap to select date (today)'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleTextSubmit}
              disabled={loading}
            >
              <Text style={styles.actionButtonText}>Process & Upload</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Date Picker Modal */}
      <Modal visible={showDatePicker} animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Date</Text>
            <TouchableOpacity onPress={() => setShowDatePicker(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.datePickerContent}>
            <View style={styles.pickerRow}>
              {/* Month Picker */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Month</Text>
                <ScrollView style={styles.scrollPicker} showsVerticalScrollIndicator={false}>
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.pickerOption, selectedMonth === idx && styles.pickerOptionSelected]}
                      onPress={() => setSelectedMonth(idx)}
                    >
                      <Text style={[styles.pickerOptionText, selectedMonth === idx && styles.pickerOptionTextSelected]}>
                        {month}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Day Picker */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Day</Text>
                <ScrollView style={styles.scrollPicker} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[styles.pickerOption, selectedDay === day && styles.pickerOptionSelected]}
                      onPress={() => setSelectedDay(day)}
                    >
                      <Text style={[styles.pickerOptionText, selectedDay === day && styles.pickerOptionTextSelected]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Year Picker */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Year</Text>
                <ScrollView style={styles.scrollPicker} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i).map((year) => (
                    <TouchableOpacity
                      key={year}
                      style={[styles.pickerOption, selectedYear === year && styles.pickerOptionSelected]}
                      onPress={() => setSelectedYear(year)}
                    >
                      <Text style={[styles.pickerOptionText, selectedYear === year && styles.pickerOptionTextSelected]}>
                        {year}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <TouchableOpacity
              style={styles.datePickerDoneButton}
              onPress={handleDatePickerDone}
            >
              <Text style={styles.datePickerDoneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    padding: 20,
    paddingTop: 50,
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
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  tabText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  activeTabText: {
    color: '#FFF',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  cardIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  textInput: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#000',
    marginBottom: 20,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  actionButton: {
    width: '100%',
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    marginTop: 40,
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
  },
  dateButton: {
    width: '100%',
    backgroundColor: '#F0F8FF',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#007AFF',
    padding: 14,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  dateButtonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 6,
  },
  dateButtonValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    paddingTop: 50,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  closeButton: {
    fontSize: 24,
    color: '#999',
  },
  datePickerContent: {
    flex: 1,
    flexDirection: 'column',
    paddingHorizontal: 20,
  },
  pickerRow: {
    flexDirection: 'row',
    marginBottom: 20,
    marginHorizontal: -20,
    paddingHorizontal: 20,
    gap: 16,
    marginTop: 20,
  },
  pickerColumn: {
    flex: 1,
    minHeight: 280,
    maxHeight: 280,
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 12,
    paddingHorizontal: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  scrollPicker: {
    height: 240,
    backgroundColor: 'transparent',
  },
  pickerOption: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerOptionSelected: {
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    marginHorizontal: 4,
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
  },
  pickerOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '700',
    fontSize: 17,
  },
  datePickerDoneButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  datePickerDoneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
