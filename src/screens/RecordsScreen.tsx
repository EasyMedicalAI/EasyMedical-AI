import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useRecords } from '@/context/RecordsContext';
import { useRouter } from 'expo-router';
import { claudeService, convertHeicToJpeg } from '@/services/claudeService';
import { cameraService } from '@/services/cameraService';
import { epicService, Appointment } from '@/services/epicService';
import { MedicalRecord } from '@/types/medical';
import MetricDetailScreen from '@/screens/MetricDetailScreen';

// Simple UUID generator that works in React Native (no crypto dependency)
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

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
  const {
    records,
    loading,
    getUniqueSpecialties,
    addRecord,
    updateRecord,
    deleteRecord,
    getLatestMetrics,
    calculateTrend,
    getMetricHistory,
  } = useRecords();
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
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [showRecordDetail, setShowRecordDetail] = useState(false);
  const [isEditingRecord, setIsEditingRecord] = useState(false);
  const [editedProvider, setEditedProvider] = useState('');
  const [editedDate, setEditedDate] = useState('');
  const [editedReason, setEditedReason] = useState('');
  const [editedSummary, setEditedSummary] = useState('');
  const [editedFindings, setEditedFindings] = useState('');
  const [editedNextSteps, setEditedNextSteps] = useState('');
  const [editRecordMonth, setEditRecordMonth] = useState(0);
  const [editRecordDay, setEditRecordDay] = useState(1);
  const [editRecordYear, setEditRecordYear] = useState(new Date().getFullYear());
  const [selectedMetricName, setSelectedMetricName] = useState<string | null>(null);
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
  const monthScrollRef = useRef(null);
  const dayScrollRef = useRef(null);
  const yearScrollRef = useRef(null);

  // Scroll pickers to today's date when form opens
  useEffect(() => {
    if (uploadMode === 'text') {
      setTimeout(() => {
        const itemHeight = 32; // pickerOption height with padding (8+8+16)
        monthScrollRef.current?.scrollTo({ y: selectedMonth * itemHeight, animated: false });
        dayScrollRef.current?.scrollTo({ y: (selectedDay - 1) * itemHeight, animated: false });
        yearScrollRef.current?.scrollTo({ y: (selectedYear - 1900) * itemHeight, animated: false });
      }, 0);
    }
  }, [uploadMode, selectedMonth, selectedDay, selectedYear]);

  // Initialize date picker with selected record's date when entering edit mode
  useEffect(() => {
    if (isEditingRecord && selectedRecord) {
      const recordDate = new Date(selectedRecord.appointmentDate || selectedRecord.uploadDate);
      setEditRecordMonth(recordDate.getMonth());
      setEditRecordDay(recordDate.getDate());
      setEditRecordYear(recordDate.getFullYear());
    }
  }, [isEditingRecord, selectedRecord]);

  const handleDatePickerDone = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedDate = `${months[selectedMonth]} ${selectedDay}, ${selectedYear}`;
    setAppointmentDate(formattedDate);
    setShowDatePicker(false);
    // Force re-render of the ScrollView
    setScrollViewKey(prev => prev + 1);
  };

  const getOrganizedRecords = () => {
    // Group records by specialty (only uploaded records, excluding Lab records which go to My Labs)
    const recordsBySpecialty: Record<string, typeof records> = {};

    records.forEach(record => {
      // Skip lab records - they're shown in My Labs section instead
      if (record.specialty?.toLowerCase().includes('lab') || record.specialty === 'Lab') {
        return;
      }

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

  // Extract lab values from records
  const getLabValues = () => {
    const labMap = new Map<string, { value: string; date: string; history: Array<{ value: string; date: string }> }>();

    // Metadata fields to exclude
    const metadataFields = new Set([
      'patient name', 'patient id', 'dob', 'age', 'sex', 'specimen id', 'specimen',
      'ordering physician', 'physician', 'account number', 'performing lab', 'lab',
      'date collected', 'date received', 'date reported', 'fasting status', 'field',
      'unit', 'reference range', 'reference interval', 'comments', 'notes', 'previous result',
      'current result', 'flag', 'test', 'result', 'value', 'units'
    ]);

    records.forEach(record => {
      if (record.specialty?.toLowerCase().includes('lab') || record.specialty === 'Lab') {
        if (record.summary) {
          console.log(`📋 Processing lab record with ${record.summary.split('\n').length} lines`);
          console.log(`📄 Full summary length: ${record.summary.length} characters`);
          const lines = record.summary.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = line.trim();

            // Try multiple parsing patterns
            let labName = '';
            let labValue = '';

            // Pattern 1: Markdown table | Name | Value |
            if (cleanLine.startsWith('|') && cleanLine.endsWith('|') && !cleanLine.includes('---')) {
              const cells = cleanLine.split('|').map(c => c.trim()).filter(c => c && !c.includes('---'));
              if (cells.length >= 2) {
                labName = cells[0];
                labValue = cells[1];
              }
            }
            // Pattern 2: "Name: Value" format
            else if (cleanLine.includes(':') && !cleanLine.startsWith('#') && !cleanLine.startsWith('-')) {
              const match = cleanLine.match(/^([^:]+):\s*(.+)$/);
              if (match) {
                labName = match[1].trim();
                labValue = match[2].trim();
              }
            }

            // Process if we found a name and value
            if (labName && labValue) {
              // Extract just the numeric/result part from values like "98 mg/dL" or "High"
              const valueMatch = labValue.match(/^([0-9.]+|High|Low|Normal|Abnormal|Positive|Negative|[A-Za-z\s]+)/);
              const cleanValue = valueMatch ? valueMatch[1].trim() : labValue;

              // Check if this is metadata by checking exact match or first word
              const lowerName = labName.toLowerCase();
              const isMetadata = metadataFields.has(lowerName) ||
                                metadataFields.has(lowerName.split(/[\/\s-]+/)[0]); // Check first word/part

              // Only include real lab values
              // Exclude header row indicators and metadata
              if (!isMetadata &&
                  labName &&
                  labName !== 'Test' &&
                  labName !== 'Field' &&
                  cleanValue &&
                  cleanValue !== 'Value' &&
                  cleanValue !== 'Result' &&
                  !labName.match(/^[0-9]+$/) &&
                  labName.length > 2 &&
                  labName.length < 60 &&
                  cleanValue.length < 100) {

                if (!labMap.has(labName)) {
                  labMap.set(labName, {
                    value: cleanValue,
                    date: record.uploadDate,
                    history: [{ value: cleanValue, date: record.uploadDate }],
                  });
                  console.log(`✅ Found lab: ${labName} = ${cleanValue}`);
                } else {
                  const existing = labMap.get(labName)!;
                  existing.history.push({ value: cleanValue, date: record.uploadDate });
                  if (new Date(record.uploadDate) > new Date(existing.date)) {
                    existing.value = cleanValue;
                    existing.date = record.uploadDate;
                  }
                }
              }
            }
          }
        }
      }
    });

    const result = Array.from(labMap.entries()).map(([name, data]) => ({
      name,
      ...data,
    }));

    console.log(`🧬 Found ${result.length} unique lab values`);
    return result;
  };

  const labValues = getLabValues();
  const [selectedLabName, setSelectedLabName] = useState<string | null>(null);

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
      const recordId = generateUUID();

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

      // Determine record type (lab vs other based on specialty)
      const isLab = uploadingSpecialty?.toLowerCase().includes('lab') ||
                   uploadingSpecialty?.toLowerCase().includes('pathology');
      const recordType = isLab ? 'lab' : 'other';

      // Analyze using backend endpoint (supports multiple images and different record types)
      console.log(`🤖 Sending to backend for analysis (recordType: ${recordType})...`);
      const analysisResult = await cameraService.analyzeHealthRecord(imageUri, recordType);

      if (!analysisResult.success) {
        throw new Error(analysisResult.error || 'Failed to analyze record');
      }

      // Parse response based on record type
      let summary = 'Medical record';
      let title = uploadingSpecialty || 'Record';

      if (!isLab && analysisResult.data?.analysis) {
        // For non-lab records, extract title and summary from Claude's formatted response
        const analysis = analysisResult.data.analysis;
        const titleMatch = analysis.match(/TITLE:\s*(.+?)(?:\n|$)/i);
        const summaryMatch = analysis.match(/SUMMARY:\s*(.+?)(?:KEY POINTS|$)/is);

        if (titleMatch) {
          title = titleMatch[1].trim();
        }
        if (summaryMatch) {
          summary = summaryMatch[1].trim();
        }
      } else if (isLab && analysisResult.data?.analysis) {
        // For labs, use analysis as summary
        summary = analysisResult.data.analysis;
      }

      await addRecord({
        id: recordId,
        uploadDate: new Date().toISOString(),
        appointmentDate: new Date().toISOString(),
        imageUri: photoUri,
        originalText: analysisResult.data?.analysis || '',
        specialty: uploadingSpecialty,
        provider: 'Unknown',
        summary: summary,
        reasonForVisit: !isLab ? summary : undefined,
        findings: analysisResult.data?.analysis,
        nextSteps: undefined,
        extractedData: { recordType, analysis: analysisResult.data?.analysis },
        processed: true,
        isTeamMember: true,
      });

      setUploadingSpecialty(null);
      setPhotoUri(null);
      setUploadMode('method');
      Alert.alert('Success', 'Record added from photo analysis!');
    } catch (error) {
      // Get detailed error information
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorDetails = error instanceof Error && error.stack ? error.stack : '';

      console.error('❌ Photo upload error:', errorMessage);
      console.error('Stack trace:', errorDetails);

      // Show comprehensive error to user
      const displayMessage = `Failed to process photo:\n\n${errorMessage}\n\nCheck console for full details.`;
      Alert.alert('Photo Processing Error', displayMessage, [
        {
          text: 'OK',
          onPress: () => {
            // Reset upload state
            setPhotoUri(null);
            setUploadMode('method');
          },
        },
      ]);
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
      const recordId = generateUUID();

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

  // Compute metrics cards for display
  const metricCards = useMemo(() => {
    const latestMetrics = getLatestMetrics();
    if (latestMetrics.size === 0) return [];

    return Array.from(latestMetrics.values()).map(metric => ({
      metric,
      trend: calculateTrend(metric.name),
    }));
  }, [loading, records]);

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
                    onPress={() => {
                      setSelectedRecord(record);
                      setShowRecordDetail(true);
                    }}
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
                    <Text style={styles.recordCardProvider}>{record.provider}</Text>
                    <Text style={styles.recordCardReason}>
                      {record.reasonForVisit || record.summary || 'No description'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyRecordsText}>No records yet. Upload your first record to get started.</Text>
        )}
      </View>

      {/* Health Metrics Section */}
      {metricCards.length > 0 && (
        <View style={styles.metricsSection}>
          <Text style={styles.sectionTitle}>📊 Health Metrics</Text>
          <Text style={styles.metricsSubtitle}>Your latest lab values and trends</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.metricsCardsContainer}
          >
            {metricCards.map(({ metric, trend }) => {
              const trendIcon = {
                'up': '📈',
                'down': '📉',
                'stable': '→',
                'insufficient': '—',
              }[trend];

              const statusColor = {
                'normal': '#34C759',
                'abnormal': '#FF3B30',
                'unknown': '#999',
              }[metric.status];

              return (
                <TouchableOpacity
                  key={metric.id}
                  style={[styles.metricCard, { borderLeftColor: statusColor }]}
                  onPress={() => setSelectedMetricName(metric.name)}
                >
                  <View style={styles.metricCardHeader}>
                    <Text style={styles.metricCardName}>{metric.name}</Text>
                    <Text style={styles.metricCardTrendIcon}>{trendIcon}</Text>
                  </View>
                  <View style={styles.metricCardValue}>
                    <Text style={styles.metricCardValueText}>{metric.value}</Text>
                    <Text style={styles.metricCardUnit}>{metric.unit}</Text>
                  </View>
                  <Text style={[styles.metricCardStatus, { color: statusColor }]}>
                    {metric.status.charAt(0).toUpperCase() + metric.status.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* My Labs Section */}
      {labValues.length > 0 && (
        <View style={styles.myLabsSection}>
          <Text style={styles.sectionTitle}>🧬 My Labs</Text>
          <View style={styles.labsGrid}>
            {labValues.map(lab => (
              <TouchableOpacity
                key={lab.name}
                style={styles.labCard}
                onPress={() => setSelectedLabName(lab.name)}
              >
                <Text style={styles.labName}>{lab.name}</Text>
                <Text style={styles.labValue}>{lab.value}</Text>
                <Text style={styles.labDate}>
                  {new Date(lab.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
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

                <TouchableOpacity
                  style={styles.methodButton}
                  onPress={() => {
                    setUploadMode('text');
                    // Reset date to today
                    setSelectedMonth(new Date().getMonth());
                    setSelectedDay(new Date().getDate());
                    setSelectedYear(new Date().getFullYear());
                  }}
                >
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
                      <ScrollView ref={monthScrollRef} style={styles.scrollPicker} showsVerticalScrollIndicator={false}>
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
                      <ScrollView ref={dayScrollRef} style={styles.scrollPicker} showsVerticalScrollIndicator={false}>
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
                      <ScrollView ref={yearScrollRef} style={styles.scrollPicker} showsVerticalScrollIndicator={false}>
                        {Array.from({ length: new Date().getFullYear() - 1900 + 10 }, (_, i) => 1900 + i).map((year) => (
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
        </KeyboardAvoidingView>
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

      {/* Record Detail Modal */}
      <Modal visible={showRecordDetail && selectedRecord !== null} animationType="slide" onRequestClose={() => { setShowRecordDetail(false); setIsEditingRecord(false); }}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowRecordDetail(false); setIsEditingRecord(false); }}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{isEditingRecord ? 'Edit Record' : 'Record Details'}</Text>
            <TouchableOpacity onPress={() => {
              if (isEditingRecord) {
                setEditedReason('');
                setEditedSummary('');
                setEditedFindings('');
                setEditedNextSteps('');
              }
              setIsEditingRecord(!isEditingRecord);
            }}>
              <Text style={styles.closeButton}>{isEditingRecord ? '✕' : '✎'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedRecord && (
              <>
                <View style={{ marginBottom: 20 }}>
                  <Text style={styles.label}>Date</Text>
                  {isEditingRecord ? (
                    <View style={styles.inlineDatePickerContainer}>
                      <View style={styles.pickerRow}>
                        {/* Month Picker */}
                        <View style={styles.pickerColumn}>
                          <Text style={styles.pickerLabel}>Month</Text>
                          <ScrollView style={styles.scrollPicker} showsVerticalScrollIndicator={false}>
                            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, idx) => (
                              <TouchableOpacity
                                key={idx}
                                style={[styles.pickerOption, editRecordMonth === idx && styles.pickerOptionSelected]}
                                onPress={() => setEditRecordMonth(idx)}
                              >
                                <Text style={[styles.pickerOptionText, editRecordMonth === idx && styles.pickerOptionTextSelected]}>
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
                                style={[styles.pickerOption, editRecordDay === day && styles.pickerOptionSelected]}
                                onPress={() => setEditRecordDay(day)}
                              >
                                <Text style={[styles.pickerOptionText, editRecordDay === day && styles.pickerOptionTextSelected]}>
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
                            {Array.from({ length: new Date().getFullYear() - 1900 + 10 }, (_, i) => 1900 + i).map((year) => (
                              <TouchableOpacity
                                key={year}
                                style={[styles.pickerOption, editRecordYear === year && styles.pickerOptionSelected]}
                                onPress={() => setEditRecordYear(year)}
                              >
                                <Text style={[styles.pickerOptionText, editRecordYear === year && styles.pickerOptionTextSelected]}>
                                  {year}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.infoValue}>
                      {new Date(selectedRecord.appointmentDate || selectedRecord.uploadDate).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </Text>
                  )}
                </View>

                <View style={{ marginBottom: 20 }}>
                  <Text style={styles.label}>Doctor / Provider</Text>
                  {isEditingRecord ? (
                    <TextInput
                      style={styles.input}
                      value={editedProvider || selectedRecord.provider || ''}
                      onChangeText={setEditedProvider}
                      placeholder="Enter doctor name"
                      placeholderTextColor="#999"
                    />
                  ) : (
                    <Text style={[styles.infoValue, { fontWeight: '600' }]}>{selectedRecord.provider}</Text>
                  )}
                </View>

                <View style={{ marginBottom: 20 }}>
                  <Text style={styles.label}>Specialty</Text>
                  <Text style={styles.infoValue}>{selectedRecord.specialty}</Text>
                </View>

                <View style={{ marginBottom: 20 }}>
                  <Text style={styles.label}>Reason for Visit</Text>
                  {isEditingRecord ? (
                    <TextInput
                      style={styles.input}
                      value={editedReason || selectedRecord.reasonForVisit || ''}
                      onChangeText={setEditedReason}
                      placeholder="Enter reason for visit"
                      placeholderTextColor="#999"
                    />
                  ) : (
                    <Text style={styles.infoValue}>{selectedRecord.reasonForVisit || 'N/A'}</Text>
                  )}
                </View>

                {selectedRecord.summary && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={styles.label}>
                      {selectedRecord.specialty?.toLowerCase().includes('lab') ? '🔬 Lab Results' : 'Summary'}
                    </Text>
                    {isEditingRecord ? (
                      <TextInput
                        style={[styles.input, { minHeight: 100 }]}
                        value={editedSummary || selectedRecord.summary || ''}
                        onChangeText={setEditedSummary}
                        placeholder="Enter summary"
                        placeholderTextColor="#999"
                        multiline
                      />
                    ) : (
                      <ScrollView
                        nestedScrollEnabled={true}
                        style={{
                          maxHeight: 300,
                          backgroundColor: selectedRecord.specialty?.toLowerCase().includes('lab') ? '#F5F9FF' : '#FAFAFA',
                          borderRadius: 8,
                          padding: 12,
                          borderLeftWidth: 3,
                          borderLeftColor: selectedRecord.specialty?.toLowerCase().includes('lab') ? '#007AFF' : '#DDD',
                        }}
                      >
                        <Text
                          style={[
                            styles.infoValue,
                            {
                              lineHeight: 22,
                              color: '#333',
                              fontFamily: selectedRecord.specialty?.toLowerCase().includes('lab') ? 'monospace' : 'System',
                            },
                          ]}
                        >
                          {selectedRecord.summary}
                        </Text>
                      </ScrollView>
                    )}
                  </View>
                )}

                {selectedRecord.findings && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={styles.label}>Findings</Text>
                    {isEditingRecord ? (
                      <TextInput
                        style={[styles.input, { minHeight: 100 }]}
                        value={editedFindings || selectedRecord.findings || ''}
                        onChangeText={setEditedFindings}
                        placeholder="Enter findings"
                        placeholderTextColor="#999"
                        multiline
                      />
                    ) : (
                      <Text style={styles.infoValue}>{selectedRecord.findings}</Text>
                    )}
                  </View>
                )}

                {selectedRecord.nextSteps && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={styles.label}>Next Steps</Text>
                    {isEditingRecord ? (
                      <TextInput
                        style={[styles.input, { minHeight: 100 }]}
                        value={editedNextSteps || selectedRecord.nextSteps || ''}
                        onChangeText={setEditedNextSteps}
                        placeholder="Enter next steps"
                        placeholderTextColor="#999"
                        multiline
                      />
                    ) : (
                      <Text style={styles.infoValue}>{selectedRecord.nextSteps}</Text>
                    )}
                  </View>
                )}

                {selectedRecord.imageUri && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={styles.label}>Record Image</Text>
                    <Image
                      source={{ uri: selectedRecord.imageUri }}
                      style={{ width: '100%', height: 300, borderRadius: 8, marginTop: 8 }}
                    />
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {isEditingRecord ? (
            <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingBottom: 20 }}>
              <TouchableOpacity
                style={[styles.backButton, { flex: 1 }]}
                onPress={() => {
                  setIsEditingRecord(false);
                  setEditedProvider('');
                  setEditedDate('');
                  setEditedReason('');
                  setEditedSummary('');
                  setEditedFindings('');
                  setEditedNextSteps('');
                  setEditRecordMonth(0);
                  setEditRecordDay(1);
                  setEditRecordYear(new Date().getFullYear());
                }}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, { flex: 1 }]}
                onPress={async () => {
                  const formattedDate = new Date(editRecordYear, editRecordMonth, editRecordDay).toISOString();
                  const updatedRecord = {
                    ...selectedRecord,
                    provider: editedProvider || selectedRecord.provider,
                    appointmentDate: formattedDate,
                    reasonForVisit: editedReason || selectedRecord.reasonForVisit,
                    summary: editedSummary || selectedRecord.summary,
                    findings: editedFindings || selectedRecord.findings,
                    nextSteps: editedNextSteps || selectedRecord.nextSteps,
                  };

                  try {
                    await updateRecord(updatedRecord);
                    setSelectedRecord(updatedRecord);
                    setIsEditingRecord(false);
                    setEditedProvider('');
                    setEditedDate('');
                    setEditedReason('');
                    setEditedSummary('');
                    setEditedFindings('');
                    setEditedNextSteps('');
                    Alert.alert('Success', 'Record updated successfully');
                  } catch (error) {
                    Alert.alert('Error', 'Failed to update record');
                  }
                }}
              >
                <Text style={styles.buttonTextWhite}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingBottom: 20 }}>
              <TouchableOpacity style={[styles.backButton, { flex: 1 }]} onPress={() => setShowRecordDetail(false)}>
                <Text style={styles.buttonText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, { flex: 1 }]}
                onPress={() => setIsEditingRecord(true)}
              >
                <Text style={styles.buttonTextWhite}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteButton, { flex: 1 }]}
                onPress={() => {
                  Alert.alert(
                    'Delete Record',
                    'Are you sure you want to delete this record? This action cannot be undone.',
                    [
                      { text: 'Cancel', onPress: () => {}, style: 'cancel' },
                      {
                        text: 'Delete',
                        onPress: async () => {
                          try {
                            await deleteRecord(selectedRecord.id);
                            setShowRecordDetail(false);
                            Alert.alert('Success', 'Record deleted successfully');
                          } catch (error) {
                            Alert.alert('Error', 'Failed to delete record');
                          }
                        },
                        style: 'destructive',
                      },
                    ]
                  );
                }}
              >
                <Text style={styles.buttonTextWhite}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* Lab History Modal */}
      <Modal visible={selectedLabName !== null} animationType="slide" onRequestClose={() => setSelectedLabName(null)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedLabName(null)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {selectedLabName ? `${selectedLabName} History` : 'Lab History'}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          {selectedLabName && (
            <ScrollView style={styles.labHistoryScrollView}>
              <View style={styles.labHistoryContent}>
                {labValues
                  .find(lab => lab.name === selectedLabName)
                  ?.history.sort(
                    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                  )
                  .map((entry, index) => (
                    <View key={index} style={styles.labHistoryItem}>
                      <Text style={styles.labHistoryValue}>{entry.value}</Text>
                      <Text style={styles.labHistoryDate}>
                        {new Date(entry.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </Text>
                    </View>
                  ))}
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Metric Detail Overlay */}
      {selectedMetricName && (
        <View style={styles.metricDetailOverlay}>
          <MetricDetailScreen
            metricName={selectedMetricName}
            onBack={() => setSelectedMetricName(null)}
          />
        </View>
      )}
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
  myLabsSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 24,
  },
  labsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  labCard: {
    flex: 1,
    minWidth: 140,
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: '#007AFF',
    alignItems: 'center',
  },
  labName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0051BA',
    textAlign: 'center',
    marginBottom: 8,
  },
  labValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 6,
  },
  labDate: {
    fontSize: 11,
    color: '#666',
  },
  labHistoryScrollView: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  labHistoryContent: {
    gap: 12,
  },
  labHistoryItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  labHistoryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 6,
  },
  labHistoryDate: {
    fontSize: 12,
    color: '#666',
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
    padding: 8,
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
    marginBottom: 8,
    gap: 8,
    marginTop: 0,
  },
  pickerColumn: {
    flex: 1,
    minHeight: 140,
    maxHeight: 140,
  },
  pickerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 6,
    paddingHorizontal: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scrollPicker: {
    height: 120,
    backgroundColor: 'transparent',
  },
  pickerOption: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerOptionSelected: {
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    marginHorizontal: 4,
  },
  pickerOptionText: {
    fontSize: 12,
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
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  datePickerDoneButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  myRecordsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
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
  recordCardProvider: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  recordCardReason: {
    fontSize: 12,
    fontWeight: '400',
    color: '#666',
    lineHeight: 18,
  },
  emptyRecordsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 24,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  buttonTextWhite: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  metricsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  metricsSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  metricsCardsContainer: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  metricCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    marginRight: 12,
    minWidth: 150,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  metricCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  metricCardName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  metricCardTrendIcon: {
    fontSize: 16,
    marginLeft: 4,
  },
  metricCardValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  metricCardValueText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  metricCardUnit: {
    fontSize: 11,
    color: '#666',
    marginLeft: 2,
  },
  metricCardStatus: {
    fontSize: 11,
    fontWeight: '600',
  },
  metricDetailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FAFAFA',
    zIndex: 1000,
  },
});
