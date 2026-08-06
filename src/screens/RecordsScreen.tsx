import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useRecords } from '@/context/RecordsContext';
import { useRouter } from 'expo-router';
import { v4 as uuidv4 } from 'uuid';
import { claudeService, convertHeicToJpeg } from '@/services/claudeService';
import { epicService, Appointment } from '@/services/epicService';
import { MedicalRecord } from '@/types/medical';

// Helper to detect media type from URI
const getMediaTypeFromUri = (uri: string, assetType?: string): string => {
  // ALWAYS check file extension first - it's more reliable than asset type
  // Expo image picker sometimes gives wrong media types (e.g., says jpeg but file is heic)
  const extension = uri.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'heic': 'image/heic', // Mark as HEIC so we convert it
    'heif': 'image/heif',
    'webp': 'image/webp',
    'gif': 'image/gif',
  };

  // If we detected from extension, use that
  if (extension && mimeTypes[extension]) {
    return mimeTypes[extension];
  }

  // Fall back to asset type only if no extension or unknown extension
  if (assetType && assetType !== 'image') {
    return assetType;
  }

  return 'image/jpeg';
};

let ImagePicker: any;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  console.warn('ImagePicker not available');
}

interface RecordsScreenProps {
  onRecordSelected?: (record: MedicalRecord) => void;
}

export default function RecordsScreen({ onRecordSelected }: RecordsScreenProps) {
  const { records, loading, getUniqueSpecialties, addRecord } = useRecords();
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [uploadingSpecialty, setUploadingSpecialty] = useState<string | null>(null);
  const [recordText, setRecordText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<'method' | 'text' | 'photo'>('method');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoMediaType, setPhotoMediaType] = useState<string>('image/jpeg');
  const [doctorName, setDoctorName] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentSummary, setAppointmentSummary] = useState('');
  const [epicAppointments, setEpicAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showAppointmentDetail, setShowAppointmentDetail] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [showDoctorAppointments, setShowDoctorAppointments] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  // Initialize with today's date
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const router = useRouter();

  useEffect(() => {
    loadAppointments();
  }, []);

  useEffect(() => {
    console.log('📅 showDatePicker state changed to:', showDatePicker);
  }, [showDatePicker]);

  const loadAppointments = async () => {
    try {
      const appointments = await epicService.getAppointments();
      setEpicAppointments(appointments);
    } catch (error) {
      console.error('Failed to load appointments:', error);
    }
  };

  const [scrollViewKey, setScrollViewKey] = useState(0);

  const handleDatePickerDone = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedDate = `${months[selectedMonth]} ${selectedDay}, ${selectedYear}`;
    setAppointmentDate(formattedDate);
    setShowDatePicker(false);
    // Force re-render of the ScrollView
    setScrollViewKey(prev => prev + 1);
  };

  const getOrganizedRecords = () => {
    // Group records by specialty (only uploaded records)
    const recordsBySpecialty: Record<string, typeof records> = {};

    records.forEach(record => {
      if (!recordsBySpecialty[record.specialty]) {
        recordsBySpecialty[record.specialty] = [];
      }
      recordsBySpecialty[record.specialty].push(record);
    });

    // Sort each specialty's records by appointment date (newest first)
    Object.keys(recordsBySpecialty).forEach(specialty => {
      recordsBySpecialty[specialty].sort((a, b) => {
        const dateA = new Date(a.appointmentDate || a.uploadDate).getTime();
        const dateB = new Date(b.appointmentDate || b.uploadDate).getTime();
        return dateB - dateA; // Newest first
      });
    });

    // Return as sorted array (A-Z by specialty)
    return Object.keys(recordsBySpecialty)
      .sort()
      .map(specialty => ({
        specialty,
        records: recordsBySpecialty[specialty],
      }));
  };

  const defaultSpecialties = [
    'Cardiology',
    'Dermatology',
    'Orthopedics',
    'Neurology',
    'OBGYN',
    'Psychiatry',
    'Ophthalmology',
    'ENT',
    'Gastroenterology',
    'Pulmonology',
    'Rheumatology',
    'Endocrinology',
    'Urology',
    'Oncology',
    'Primary Care',
    'Lab',
    'Imaging',
    'Dentistry',
    'Other',
  ];

  const specialties = getUniqueSpecialties().length > 0 ? getUniqueSpecialties() : defaultSpecialties;

  const toggleSpecialty = (specialty: string) => {
    setSelectedSpecialties(prev =>
      prev.includes(specialty)
        ? prev.filter(s => s !== specialty)
        : [...prev, specialty]
    );
  };

  const recordsToDisplay = selectedSpecialties.length === 0
    ? []
    : records.filter(record => selectedSpecialties.includes(record.specialty));

  const handleTakePhoto = async () => {
    if (!ImagePicker) {
      Alert.alert('Error', 'Camera not available');
      return;
    }

    try {
      // Request camera permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setPhotoUri(uri);
        setPhotoMediaType(getMediaTypeFromUri(uri, result.assets[0].type));
        setUploadMode('photo');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to access camera: ' + String(error));
    }
  };

  const handlePickPhoto = async () => {
    if (!ImagePicker) {
      Alert.alert('Error', 'Photo library not available');
      return;
    }

    try {
      // Request photo library permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Photo library permission is required to select photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setPhotoUri(uri);
        setPhotoMediaType(getMediaTypeFromUri(uri, result.assets[0].type));
        setUploadMode('photo');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to access photo library: ' + String(error));
    }
  };

  const handleUploadPhoto = async () => {
    if (!uploadingSpecialty || !photoUri) {
      Alert.alert('Error', 'Please select a photo');
      return;
    }

    setIsUploading(true);
    try {
      const recordId = uuidv4();

      // Convert HEIC images to JPEG if needed
      let imageUri = photoUri;
      const needsConversion =
        photoMediaType.includes('heic') ||
        photoMediaType.includes('heif');

      if (needsConversion) {
        console.log(`🔄 Converting image (type: ${photoMediaType}) from ${photoUri} to JPEG...`);
        imageUri = await convertHeicToJpeg(photoUri);
        console.log(`✓ Conversion complete. New URI: ${imageUri}`);
      } else {
        console.log(`📷 Using image as-is (type: ${photoMediaType})`);
      }

      // Convert photo to base64 for analysis
      console.log(`📊 Reading image as base64 from: ${imageUri}`);
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log(`✓ Base64 read successful. Length: ${base64.length} characters`);

      // Analyze the photo using Claude vision
      console.log(`🤖 Sending to Claude API (image/jpeg format)...`);
      const parsedRecord = await claudeService.parseRecordFromImage(base64, recordId, 'image/jpeg');
      console.log(`✓ Claude analysis complete`);

      await addRecord({
        id: recordId,
        uploadDate: new Date().toISOString(),
        appointmentDate: parsedRecord.uploadDate || new Date().toISOString(),
        imageUri: photoUri,
        originalText: parsedRecord.originalText,
        specialty: uploadingSpecialty,
        provider: parsedRecord.provider || 'Unknown',
        summary: parsedRecord.summary || 'Medical record',
        reasonForVisit: parsedRecord.reasonForVisit,
        findings: parsedRecord.findings,
        nextSteps: parsedRecord.nextSteps,
        extractedData: parsedRecord.extractedData || {},
        processed: true,
        isTeamMember: true,
      });

      setUploadingSpecialty(null);
      setPhotoUri(null);
      setUploadMode('method');
      Alert.alert('Success', 'Record added from photo analysis!');
    } catch (error) {
      Alert.alert('Error', 'Failed to process photo: ' + String(error));
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadRecord = async () => {
    if (!uploadingSpecialty || !doctorName.trim() || !appointmentDate.trim() || !appointmentSummary.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsUploading(true);
    try {
      const recordId = uuidv4();

      // Convert date string to ISO format for sorting
      const months: Record<string, string> = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
        'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
      };
      let dateISO = new Date().toISOString();
      if (appointmentDate) {
        const parts = appointmentDate.match(/(\w+)\s+(\d+),\s+(\d+)/);
        if (parts) {
          const monthNum = months[parts[1]] || '01';
          const dayNum = String(parseInt(parts[2])).padStart(2, '0');
          const year = parts[3];
          dateISO = `${year}-${monthNum}-${dayNum}T00:00:00.000Z`;
        }
      }

      await addRecord({
        id: recordId,
        uploadDate: new Date().toISOString(),
        appointmentDate: dateISO,
        originalText: appointmentSummary,
        specialty: uploadingSpecialty,
        provider: doctorName,
        summary: appointmentSummary,
        reasonForVisit: appointmentSummary,
        extractedData: {
          doctorName: doctorName,
          appointmentDate: appointmentDate,
          visitSummary: appointmentSummary,
        },
        processed: true,
        isTeamMember: true,
      });

      setUploadingSpecialty(null);
      setRecordText('');
      setDoctorName('');
      setAppointmentDate('');
      setAppointmentSummary('');
      setUploadMode('method');
      Alert.alert('Success', 'Appointment saved!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save appointment: ' + String(error));
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <>
    <ScrollView style={styles.container}>
      <View style={styles.topBar}>
        <View />
        <Text style={styles.appName}>EasyMedical AI</Text>
      </View>
      <View style={styles.header}>
        <Text style={styles.title}>My Health Records</Text>
        <Text style={styles.subtitle}>{specialties.length} specialties available</Text>
      </View>

      {/* My Records Section */}
      <View style={styles.myRecordsSection}>
        <Text style={styles.sectionTitle}>My Records</Text>
        {records.length > 0 ? (
          getOrganizedRecords().map(({ specialty, records: specialtyRecords }) => (
            <View key={specialty} style={styles.specialtyGroup}>
              <Text style={styles.specialtyGroupTitle}>
                {getSpecialtyEmoji(specialty)} {specialty}
              </Text>
              <View style={styles.recordsCardList}>
                {specialtyRecords.map(record => (
                  <TouchableOpacity
                    key={record.id}
                    style={styles.myRecordsCard}
                    onPress={() => onRecordSelected?.(record)}
                  >
                    <View style={styles.recordCardHeader}>
                      <Text style={styles.recordCardDate}>
                        {new Date(record.appointmentDate || record.uploadDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                    <Text style={styles.recordCardReason}>
                      {record.reasonForVisit || record.summary || 'No description'}
                    </Text>
                    <Text style={styles.recordCardProvider}>{record.provider}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyRecordsText}>No records yet. Upload your first record to get started.</Text>
        )}
      </View>

      {/* Upload Records Section */}
      <View style={styles.uploadRecordsSection}>
        <Text style={styles.uploadRecordsTitle}>Upload Records</Text>
      </View>

      {/* Specialties for Upload - Always show all */}
      <View style={styles.uploadSpecialtiesContainer}>
        {[...defaultSpecialties].sort().map(specialty => (
          <TouchableOpacity
            key={`upload-${specialty}`}
            style={styles.uploadSpecialtyButton}
            onPress={() => setUploadingSpecialty(specialty)}
          >
            <Text style={styles.uploadSpecialtyButtonText}>
              {getSpecialtyEmoji(specialty)} {specialty}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick Upload Actions */}
      <View style={styles.quickUploadSection}>
        <TouchableOpacity
          style={styles.quickUploadButton}
          onPress={() => setUploadingSpecialty('Lab')}
        >
          <Text style={styles.quickUploadButtonText}>🔬 Upload Labs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickUploadButton}
          onPress={() => setUploadingSpecialty('Imaging')}
        >
          <Text style={styles.quickUploadButtonText}>📷 Upload Imaging</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.spacing} />
    </ScrollView>

      {/* Upload Modal */}
      <Modal visible={uploadingSpecialty !== null} animationType="slide" onRequestClose={() => {
        setUploadingSpecialty(null);
        setRecordText('');
        setPhotoUri(null);
        setUploadMode('method');
      }}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Upload {uploadingSpecialty} Record</Text>
            <TouchableOpacity onPress={() => {
              setUploadingSpecialty(null);
              setRecordText('');
              setPhotoUri(null);
              setUploadMode('method');
            }}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            key={scrollViewKey}
            style={styles.modalContent}
            scrollEnabled={true}
            showsVerticalScrollIndicator={true}
          >
            {uploadMode === 'method' && (
              <>
                <Text style={styles.label}>How would you like to upload?</Text>
                <Text style={styles.sublabel}>Choose a method to add your medical record</Text>

                <TouchableOpacity style={styles.methodButton} onPress={handleTakePhoto}>
                  <Text style={styles.methodButtonIcon}>📷</Text>
                  <View style={styles.methodButtonContent}>
                    <Text style={styles.methodButtonText}>Take Photo</Text>
                    <Text style={styles.methodButtonDesc}>Use camera to photograph document</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.methodButton} onPress={handlePickPhoto}>
                  <Text style={styles.methodButtonIcon}>🖼️</Text>
                  <View style={styles.methodButtonContent}>
                    <Text style={styles.methodButtonText}>Choose Photo</Text>
                    <Text style={styles.methodButtonDesc}>Select from photo library</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.methodButton} onPress={() => setUploadMode('text')}>
                  <Text style={styles.methodButtonIcon}>✍️</Text>
                  <View style={styles.methodButtonContent}>
                    <Text style={styles.methodButtonText}>Type Details</Text>
                    <Text style={styles.methodButtonDesc}>Manually enter record information</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}

            {uploadMode === 'text' && (
              <>
                <Text style={styles.label}>Appointment Details</Text>
                <Text style={styles.sublabel}>Enter information about your visit</Text>

                <Text style={styles.fieldLabel}>Doctor's Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Dr. Sarah Johnson"
                  placeholderTextColor="#999"
                  value={doctorName}
                  onChangeText={setDoctorName}
                  editable={!isUploading}
                />

                <Text style={styles.fieldLabel}>Date of Appointment</Text>

                {/* Inline Date Picker */}
                <View style={styles.inlineDatePickerContainer}>
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

                <Text style={styles.fieldLabel}>Summary of Visit</Text>
                <TextInput
                  style={[styles.input, { minHeight: 120 }]}
                  placeholder="Describe what happened during the visit..."
                  placeholderTextColor="#999"
                  value={appointmentSummary}
                  onChangeText={setAppointmentSummary}
                  multiline
                  editable={!isUploading}
                />

                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => {
                    setUploadMode('method');
                    setDoctorName('');
                    setAppointmentDate('');
                    setAppointmentSummary('');
                  }}
                >
                  <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addButton, isUploading && styles.buttonDisabled]}
                  onPress={handleUploadRecord}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.addButtonText}>Save Appointment</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {uploadMode === 'photo' && photoUri && (
              <>
                <Text style={styles.label}>Preview Your Document</Text>
                <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="contain" />
                <Text style={styles.sublabel}>Claude will analyze this image to extract medical information</Text>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => {
                    setUploadMode('method');
                    setPhotoUri(null);
                  }}
                >
                  <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addButton, isUploading && styles.buttonDisabled]}
                  onPress={handleUploadPhoto}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.addButtonText}>Add to My Team</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Appointment Detail Modal */}
      <Modal
        visible={showAppointmentDetail && selectedAppointment !== null}
        animationType="slide"
        onRequestClose={() => setShowAppointmentDetail(false)}
      >
        <View style={styles.appointmentDetailContainer}>
          <View style={styles.appointmentDetailHeader}>
            <TouchableOpacity onPress={() => setShowAppointmentDetail(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.appointmentDetailTitle}>Appointment</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={styles.appointmentDetailContent}>
            {selectedAppointment && (
              <>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryText}>
                    {selectedAppointment.description}
                  </Text>
                  <Text style={styles.summaryMeta}>
                    with {selectedAppointment.provider}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Date & Time</Text>
                  <Text style={styles.detailValue}>
                    {selectedAppointment.date} at {selectedAppointment.time}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Doctor</Text>
                  <Text style={styles.detailValue}>{selectedAppointment.provider}</Text>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Doctor's All Appointments Modal */}
      <Modal
        visible={showDoctorAppointments && selectedDoctor !== null}
        animationType="slide"
        onRequestClose={() => setShowDoctorAppointments(false)}
      >
        <View style={styles.appointmentDetailContainer}>
          <View style={styles.appointmentDetailHeader}>
            <TouchableOpacity onPress={() => setShowDoctorAppointments(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.appointmentDetailTitle}>{selectedDoctor}</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={styles.appointmentDetailContent}>
            {selectedDoctor && (
              <>
                <Text style={styles.appointmentListTitle}>All Appointments</Text>

                {/* Example appointments with this doctor */}
                <TouchableOpacity
                  style={styles.appointmentListItem}
                  onPress={() => {
                    setShowDoctorAppointments(false);
                    setSelectedAppointment({
                      id: '1',
                      date: 'Aug 15, 2025',
                      time: '10:00 AM',
                      provider: selectedDoctor,
                      description: 'Annual Physical Exam',
                    });
                    setShowAppointmentDetail(true);
                  }}
                >
                  <View>
                    <Text style={styles.appointmentItemDate}>Aug 15, 2025 • 10:00 AM</Text>
                    <Text style={styles.appointmentItemTitle}>Annual Physical Exam</Text>
                    <Text style={styles.appointmentItemSummary}>
                      Comprehensive physical examination. Blood pressure normal, heart rate steady. All vitals within normal range.
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.appointmentListItem}
                  onPress={() => {
                    setShowDoctorAppointments(false);
                    setSelectedAppointment({
                      id: '2',
                      date: 'Jul 10, 2025',
                      time: '2:30 PM',
                      provider: selectedDoctor,
                      description: 'Follow-up Checkup',
                    });
                    setShowAppointmentDetail(true);
                  }}
                >
                  <View>
                    <Text style={styles.appointmentItemDate}>Jul 10, 2025 • 2:30 PM</Text>
                    <Text style={styles.appointmentItemTitle}>Follow-up Checkup</Text>
                    <Text style={styles.appointmentItemSummary}>
                      Follow-up on previous concerns. Patient reports improvement. Continue current medication plan.
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.appointmentListItem}
                  onPress={() => {
                    setShowDoctorAppointments(false);
                    setSelectedAppointment({
                      id: '3',
                      date: 'May 20, 2025',
                      time: '11:15 AM',
                      provider: selectedDoctor,
                      description: 'Initial Consultation',
                    });
                    setShowAppointmentDetail(true);
                  }}
                >
                  <View>
                    <Text style={styles.appointmentItemDate}>May 20, 2025 • 11:15 AM</Text>
                    <Text style={styles.appointmentItemTitle}>Initial Consultation</Text>
                    <Text style={styles.appointmentItemSummary}>
                      Patient intake and history review. Ordered lab work and imaging studies for further evaluation.
                    </Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      <Modal visible={showDatePicker} animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.dateModalHeader}>
            <Text style={styles.dateModalTitle}>Select Date</Text>
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
    </>
  );
}

function getSpecialtyEmoji(specialty: string): string {
  const map: Record<string, string> = {
    cardiology: '❤️',
    orthopedics: '🦴',
    dermatology: '🩹',
    neurology: '🧠',
    obgyn: '👶',
    ophthalmology: '👁️',
    oncology: '🏥',
    lab: '🔬',
    imaging: '📷',
    pharmacy: '💊',
    'primary care': '👨‍⚕️',
    dentistry: '🦷',
    psychiatry: '💭',
    urology: '🔴',
  };

  const key = specialty.toLowerCase();
  return map[key] || '📋';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingTop: 20,
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
  quickUploadSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 10,
  },
  quickUploadButton: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  quickUploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  uploadRecordsSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  uploadRecordsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  uploadSpecialtiesContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 8,
  },
  uploadSpecialtyButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#E8E8E8',
  },
  uploadSpecialtyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  otherSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  otherSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  filterHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  filterHeaderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  specialtiesFilterContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    marginBottom: 16,
    gap: 8,
  },
  specialtiesScroll: {
    flexGrow: 0,
  },
  specialtyButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E8E8E8',
    marginRight: 8,
  },
  specialtyButtonSelected: {
    backgroundColor: '#000',
  },
  specialtyButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  specialtyButtonTextSelected: {
    color: '#FFF',
  },
  specialtyButtonVertical: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#E8E8E8',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  specialtyButtonVerticalSelected: {
    backgroundColor: '#000',
  },
  specialtyButtonVerticalText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  specialtyButtonVerticalTextSelected: {
    color: '#FFF',
  },
  recordsContainer: {
    paddingHorizontal: 20,
  },
  recordsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  recordsList: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  recordItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  recordContent: {
    flex: 1,
    marginRight: 12,
  },
  recordProvider: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  recordSummary: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
    lineHeight: 18,
  },
  recordDate: {
    fontSize: 12,
    color: '#999',
  },
  recordArrow: {
    fontSize: 18,
    color: '#CCC',
  },
  selectPrompt: {
    marginTop: 40,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  selectPromptText: {
    fontSize: 14,
    color: '#999',
  },
  teamSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  teamSpecialtyGroup: {
    marginBottom: 12,
  },
  teamSpecialtyName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  teamRecordItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  teamRecordContent: {
    flex: 1,
    marginRight: 12,
  },
  teamRecordProvider: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  teamRecordMeta: {
    fontSize: 12,
    color: '#999',
  },
  teamEmptyText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  emptyState: {
    marginTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
  },
  spacing: {
    height: 100,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    paddingTop: 50,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  closeButton: {
    fontSize: 24,
    color: '#007AFF',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  sublabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#CCC',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  methodButton: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  methodButtonIcon: {
    fontSize: 32,
  },
  methodButtonContent: {
    flex: 1,
  },
  methodButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  methodButtonDesc: {
    fontSize: 13,
    color: '#666',
  },
  backButton: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  photoPreview: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    marginVertical: 16,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  appointmentDetailContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    paddingTop: 50,
  },
  appointmentDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  appointmentDetailTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  closeButton: {
    fontSize: 20,
    color: '#999',
    fontWeight: '600',
  },
  appointmentDetailContent: {
    flex: 1,
    padding: 20,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000',
  },
  summaryBox: {
    backgroundColor: '#F8F9FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 8,
  },
  summaryMeta: {
    fontSize: 12,
    color: '#999',
  },
  addRecordButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginVertical: 20,
  },
  addRecordButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  recordsCardsContainer: {
    gap: 12,
  },
  recordCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  recordSpecialty: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  recordDoctor: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8,
  },
  recordDate: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
  doctorsList: {
    gap: 12,
  },
  doctorItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  doctorItemLast: {
    borderBottomWidth: 0,
  },
  appointmentListTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 16,
  },
  appointmentListItem: {
    backgroundColor: '#F8F9FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  appointmentItemDate: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
    marginBottom: 4,
  },
  appointmentItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  appointmentItemSummary: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  inlineDatePickerContainer: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  datePickerButton: {
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#007AFF',
    padding: 14,
    marginBottom: 20,
  },
  datePickerButtonValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    paddingTop: 50,
  },
  dateModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dateModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
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
  myRecordsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 16,
  },
  specialtyGroup: {
    marginBottom: 20,
  },
  specialtyGroupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recordsCardList: {
    gap: 10,
  },
  myRecordsCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  recordCardHeader: {
    marginBottom: 8,
  },
  recordCardDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  recordCardReason: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    marginBottom: 6,
    lineHeight: 20,
  },
  recordCardProvider: {
    fontSize: 12,
    color: '#999',
  },
  emptyRecordsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 24,
  },
});
