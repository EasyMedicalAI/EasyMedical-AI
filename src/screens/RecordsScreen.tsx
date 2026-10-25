import React, { useState, useEffect, useRef, useMemo } from 'react';
import DateWheel from '@/components/DateWheel';
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
  Linking,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useRecords } from '@/context/RecordsContext';
import { useRouter } from 'expo-router';
import { claudeService, convertHeicToJpeg } from '@/services/claudeService';
import { cameraService } from '@/services/cameraService';
import { ehrService, Appointment } from '@/services/ehrService';
import { MedicalRecord } from '@/types/medical';
import MetricDetailScreen from '@/screens/MetricDetailScreen';
import RecordSummary from '@/components/RecordSummary';
import EpicBadge from '@/components/EpicBadge';
import { toMedicalRecord, ExtractedRecord } from '@/services/recordFormat';
import { typicalRangeFor } from '@/services/labReferenceRanges';
import LabTrendChart from '@/components/LabTrendChart';
import { explanationFor } from '@/services/labExplanations';
import LabAskBox from '@/components/LabAskBox';
import { ScreenHeader, Section, ListCard, ListRow, Divider, DetailPage } from '@/components/ScreenKit';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { applyLogEntries, currentMedicationNames, LogEntry } from '@/services/quickLog';
import EntryReview from '@/components/EntryReview';
import LabRangeList from '@/components/LabRangeList';

let DocumentPicker: any = null;
try {
  DocumentPicker = require('expo-document-picker');
} catch {
  DocumentPicker = null;
}

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
    userData,
    loading,
    getUniqueSpecialties,
    addRecord,
    updateRecord,
    deleteRecord,
    getLatestMetrics,
    calculateTrend,
    getMetricHistory,
    patchUserData,
  } = useRecords();
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [uploadingSpecialty, setUploadingSpecialty] = useState<string | null>(null);
  const [specialtyText, setSpecialtyText] = useState('');
  const [recordText, setRecordText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [summaryReview, setSummaryReview] = useState<{ record: MedicalRecord; entries: LogEntry[] } | null>(null);
  const [uploadMode, setUploadMode] = useState<'method' | 'text' | 'photo' | 'photo-review' | 'add-photo-method' | 'pdf-review'>('method');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoMediaType, setPhotoMediaType] = useState<string>('image/jpeg');
  const [selectedPhotos, setSelectedPhotos] = useState<Array<{ uri: string; mediaType: string }>>([]);
  const [doctorName, setDoctorName] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentSummary, setAppointmentSummary] = useState('');
  const [epicAppointments, setEpicAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showAppointmentDetail, setShowAppointmentDetail] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [showDoctorAppointments, setShowDoctorAppointments] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [showRecordDetail, setShowRecordDetail] = useState(false);
  const [isEditingRecord, setIsEditingRecord] = useState(false);
  const [editedProvider, setEditedProvider] = useState('');
  const [editedSpecialty, setEditedSpecialty] = useState('');
  const [editedDate, setEditedDate] = useState('');
  const [editedReason, setEditedReason] = useState('');
  const [editedSummary, setEditedSummary] = useState('');
  const [editedFindings, setEditedFindings] = useState('');
  const [editedNextSteps, setEditedNextSteps] = useState('');
  const [editRecordDate, setEditRecordDate] = useState<Date>(() => new Date());
  const [selectedMetricName, setSelectedMetricName] = useState<string | null>(null);
  const [appointmentPick, setAppointmentPick] = useState<Date>(() => new Date());
  const router = useRouter();

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      const appointments = await ehrService.getAppointments();
      setEpicAppointments(appointments);
    } catch (error) {
      console.error('Failed to load appointments:', error);
    }
  };

  const [scrollViewKey, setScrollViewKey] = useState(0);

  // Initialize date picker with selected record's date when entering edit mode
  useEffect(() => {
    if (isEditingRecord && selectedRecord) {
      const recordDate = new Date(selectedRecord.appointmentDate || selectedRecord.uploadDate);
      setEditRecordDate(new Date(recordDate.getFullYear(), recordDate.getMonth(), recordDate.getDate(), 12));
    }
  }, [isEditingRecord, selectedRecord]);

  // "Oct 18, 2026", the form the appointment date is saved in
  const appointmentDayText = (date: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
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
    const labMap = new Map<string, { value: string; range?: string; date: string; history: Array<{ value: string; date: string }> }>();

    // Metadata fields to exclude
    const metadataFields = new Set([
      'patient name', 'patient id', 'dob', 'age', 'sex', 'specimen id', 'specimen',
      'ordering physician', 'physician', 'account number', 'performing lab', 'lab',
      'date collected', 'date received', 'date reported', 'fasting status', 'field',
      'unit', 'reference range', 'reference interval', 'comments', 'notes', 'previous result',
      'current result', 'flag', 'test', 'result', 'value', 'units',
      // Narrative sections of a report, never test results
      'note', 'notes', 'summary', 'impression', 'interpretation', 'conclusion', 'comment',
      'recommendation', 'recommendations', 'reason', 'diagnosis', 'findings', 'history',
      'report', 'assessment', 'plan', 'instructions'
    ]);

    records.forEach(record => {
      if (record.specialty?.toLowerCase().includes('lab') || record.specialty === 'Lab') {
        // Structured records carry their own lab table, with reference ranges
        const structuredLabs = record.extractedData?.structured?.labResults;
        if (Array.isArray(structuredLabs)) {
          const labDate = record.appointmentDate || record.uploadDate;
          structuredLabs.forEach((lab: any) => {
            const labValue = [lab.value, lab.unit].filter(Boolean).join(' ');
            const existing = labMap.get(lab.name);
            if (!existing) {
              labMap.set(lab.name, { value: labValue, range: lab.referenceRange || undefined, date: labDate, history: [{ value: labValue, date: labDate }] });
            } else {
              existing.history.push({ value: labValue, date: labDate });
              if (new Date(labDate) > new Date(existing.date)) {
                existing.value = labValue;
                existing.date = labDate;
                existing.range = lab.referenceRange || existing.range;
              }
            }
          });
          return;
        }
        // First, check for extracted test results (from Epic or other structured sources)
        if (record.extractedData?.testResults && typeof record.extractedData.testResults === 'object') {
          const testDate = record.uploadDate;
          console.log(`📊 Found structured testResults from ${record.provider}`);

          Object.entries(record.extractedData.testResults).forEach(([testName, testValue]) => {
            if (testName && testValue) {
              const cleanValue = String(testValue).trim();
              console.log(`✅ Found lab from testResults: ${testName} = ${cleanValue}`);

              // Epic sends the normal range alongside each result
              const testRange = record.extractedData?.testRanges?.[testName] || undefined;
              if (!labMap.has(testName)) {
                labMap.set(testName, {
                  value: cleanValue,
                  range: testRange,
                  date: testDate,
                  history: [{ value: cleanValue, date: testDate }],
                });
              } else {
                const existing = labMap.get(testName)!;
                existing.history.push({ value: cleanValue, date: testDate });
                if (new Date(testDate) > new Date(existing.date)) {
                  existing.value = cleanValue;
                  existing.date = testDate;
                  existing.range = testRange || existing.range;
                }
              }
            }
          });
        }

        // Also parse the summary field for text-based lab results (manual uploads, etc.)
        if (record.summary) {
          console.log(`📋 Processing lab record with ${record.summary.split('\n').length} lines`);
          console.log(`📄 Full summary length: ${record.summary.length} characters`);
          const lines = record.summary.split('\n');

          // Extract test date from the lab document
          let testDate = record.uploadDate; // fallback to upload date
          for (const line of lines) {
            // Try various date patterns found in lab results
            let match = line.match(/Date\s+Collected:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
            if (match) {
              const [month, day, year] = match[1].split('/');
              testDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`;
              console.log(`📅 Extracted Date Collected: ${match[1]} → ${testDate}`);
              break;
            }

            match = line.match(/Test\s+Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
            if (match) {
              const [month, day, year] = match[1].split('/');
              testDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`;
              console.log(`📅 Extracted Test Date: ${match[1]} → ${testDate}`);
              break;
            }
          }

          // Build a map of lab names to their reference ranges
          const rangeMap = new Map<string, string>();
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = line.trim();

            // Look for reference range patterns
            // Pattern: "Reference Range: 70-100 mg/dL" or similar
            let rangeMatch = cleanLine.match(/reference\s+(?:range|interval):\s*(.+?)(?:\s*$|;\s*|,\s*)/i);
            if (rangeMatch) {
              const rangeValue = rangeMatch[1].trim();
              // Try to find the lab name from previous lines or same line
              if (i > 0) {
                const prevLine = lines[i - 1].trim();
                const prevMatch = prevLine.match(/^([A-Za-z\s]+?):/);
                if (prevMatch) {
                  const labName = prevMatch[1].trim();
                  rangeMap.set(labName.toLowerCase(), rangeValue);
                  console.log(`  📊 Found range for "${labName}": ${rangeValue}`);
                }
              }
            }
          }

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
                console.log(`  📍 Found table row: "${labName}" = "${labValue}"`);
              }
            }
            // Pattern 2: "Name: Value" format
            else if (cleanLine.includes(':') && !cleanLine.startsWith('#') && !cleanLine.startsWith('-')) {
              const match = cleanLine.match(/^([^:]+):\s*(.+)$/);
              if (match) {
                labName = match[1].trim();
                labValue = match[2].trim();
                console.log(`  📍 Found colon format: "${labName}" = "${labValue}"`);
              }
            }

            // Process if we found a name and value
            if (labName && labValue) {
              // Extract reference range from format "Value (Range)" or "Value"
              let labRange = '';
              let rangeMatch = labValue.match(/\(([^)]+)\)\s*$/);
              if (rangeMatch) {
                labRange = rangeMatch[1].trim();
                // Remove the range from the value for further parsing
                labValue = labValue.replace(/\s*\([^)]+\)\s*$/, '').trim();
              }

              // Extract just the numeric/result part from values like "98 mg/dL" or "High"
              const valueMatch = labValue.match(/^([0-9.]+|High|Low|Normal|Abnormal|Positive|Negative|[A-Za-z\s]+)/);
              const cleanValue = valueMatch ? valueMatch[1].trim() : labValue;

              // Store the range for this test
              if (labRange && labName) {
                rangeMap.set(labName.toLowerCase(), labRange);
              }

              // Check if this is metadata by checking exact match or first word
              const lowerName = labName.toLowerCase();
              // Real test names are short and values are short. Sentences are narrative text, not results.
              const isMetadata = metadataFields.has(lowerName) ||
                                metadataFields.has(lowerName.split(/[\/\s-]+/)[0]) || // Check first word/part
                                labName.split(/\s+/).length > 4 ||
                                cleanValue.length > 40;

              // Only include real lab values
              // Exclude header row indicators and metadata
              const reasons = [];
              if (isMetadata) reasons.push('metadata');
              if (labName === 'Test' || labName === 'Field') reasons.push('header');
              if (cleanValue === 'Value' || cleanValue === 'Result') reasons.push('header-value');
              if (labName.match(/^[0-9]+$/)) reasons.push('numeric-name');
              if (labName.length <= 2) reasons.push('name-too-short');
              if (labName.length >= 60) reasons.push('name-too-long');
              if (cleanValue.length >= 100) reasons.push('value-too-long');

              if (reasons.length > 0) {
                console.log(`    ❌ Rejected: ${labName} = ${cleanValue} [${reasons.join(', ')}]`);
              }

              // Special case: accept index | test name format (e.g., "1" = "Glucose")
              // This happens when Claude extracts test names from the table
              const isTestNameFormat = labName.match(/^[0-9]+$/) &&
                                      cleanValue.length > 2 &&
                                      cleanValue.length < 60 &&
                                      !metadataFields.has(cleanValue.toLowerCase());

              if (!isMetadata &&
                  labName &&
                  labName !== 'Test' &&
                  labName !== 'Field' &&
                  cleanValue &&
                  cleanValue !== 'Value' &&
                  cleanValue !== 'Result' &&
                  ((!labName.match(/^[0-9]+$/) &&
                    labName.length > 2 &&
                    labName.length < 60 &&
                    cleanValue.length < 100) ||
                   isTestNameFormat)) {

                if (!labMap.has(labName)) {
                  const range = rangeMap.get(labName.toLowerCase());
                  labMap.set(labName, {
                    value: cleanValue,
                    range: range,
                    date: testDate,
                    history: [{ value: cleanValue, date: testDate }],
                  });
                  console.log(`✅ Found lab: ${labName} = ${cleanValue}${range ? ` (Range: ${range})` : ''}`);
                } else {
                  const existing = labMap.get(labName)!;
                  existing.history.push({ value: cleanValue, date: testDate });
                  if (new Date(testDate) > new Date(existing.date)) {
                    existing.value = cleanValue;
                    existing.date = testDate;
                  }
                  // Add range if we found it
                  if (!existing.range) {
                    const range = rangeMap.get(labName.toLowerCase());
                    if (range) {
                      existing.range = range;
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    // Report or Epic range first; a typical adult range only when neither gives one
    const result = Array.from(labMap.entries()).map(([name, data]) => ({
      name,
      ...data,
      range: data.range || typicalRangeFor(name, userData),
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
        const mediaType = getMediaTypeFromUri(uri, result.assets[0].type);
        setPhotoUri(uri);
        setPhotoMediaType(mediaType);
        setSelectedPhotos([{ uri, mediaType }]);
        setUploadMode('photo-review');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to access camera: ' + String(error));
    }
  };

  const handleTakeCameraPhotoForAdding = async () => {
    if (!ImagePicker) {
      Alert.alert('Error', 'Camera not available');
      return;
    }

    try {
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
        const mediaType = getMediaTypeFromUri(uri, result.assets[0].type);
        // Add to existing photos
        setSelectedPhotos([...selectedPhotos, { uri, mediaType }]);
        // Go back to photo review
        setUploadMode('photo-review');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo: ' + String(error));
    }
  };

  const handleAddPhotoFromLibrary = async () => {
    if (!ImagePicker) {
      Alert.alert('Error', 'Photo library not available');
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Photo library permission is required');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        const mediaType = getMediaTypeFromUri(uri, result.assets[0].type);
        // Add to existing photos
        setSelectedPhotos([...selectedPhotos, { uri, mediaType }]);
        // Go back to photo review
        setUploadMode('photo-review');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add photo: ' + String(error));
    }
  };

  // Asks a yes/no question and resolves with the answer
  const askYesNo = (title: string, message: string, yesText: string) =>
    new Promise<boolean>((resolve) => {
      Alert.alert(title, message, [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: yesText, onPress: () => resolve(true) },
      ], { cancelable: true, onDismiss: () => resolve(false) });
    });

  // A record from the same day with the same provider
  const findSimilarRecord = (candidate: MedicalRecord) => {
    const dayOf = (r: MedicalRecord) => new Date(r.appointmentDate || r.uploadDate).toDateString();
    const provider = (candidate.provider || '').trim().toLowerCase();
    if (!provider) return undefined;
    return records.find(
      (r) => dayOf(r) === dayOf(candidate) && (r.provider || '').trim().toLowerCase() === provider
    );
  };

  const handlePickPdf = async () => {
    if (!DocumentPicker) {
      Alert.alert('Choosing PDFs needs an app update', 'This version of the app cannot open PDF files yet. Photos still work.');
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      await handleUploadPdf(result.assets[0].uri);
    } catch (error) {
      Alert.alert('Could not open that file', String(error));
    }
  };

  const handleUploadPdf = async (uri: string) => {
    if (uploadingSpecialty === null) return;
    setIsUploading(true);
    try {
      const analysis = await cameraService.analyzePdfs([uri]);
      if (!analysis.success) throw new Error(analysis.error || 'Failed to read the PDF');
      const extracted = analysis.data as ExtractedRecord;

      const record = toMedicalRecord(extracted, {
        id: generateUUID(),
        uploadDate: new Date().toISOString(),
        imageUris: [],
        chosenSpecialty: undefined,
      });

      const similar = findSimilarRecord(record);
      if (similar) {
        const addAnyway = await askYesNo(
          'Already have this visit?',
          `You already have a record from ${record.provider} on this date. Add this PDF too?`,
          'Add anyway'
        );
        if (!addAnyway) return;
      }

      // Medications and diagnoses from the visit that aren't on the profile yet, for review
      const visitDate = /^\d{4}-\d{2}-\d{2}$/.test(extracted.date || '')
        ? extracted.date
        : new Date().toISOString().slice(0, 10);
      const knownMeds = currentMedicationNames(userData).map((name) => name.trim().toLowerCase());
      const medEntries: LogEntry[] = (extracted.medications || [])
        .filter((med) => med?.name && !knownMeds.includes(med.name.trim().toLowerCase()))
        .map(
          (med) =>
            ({
              type: 'start_medication',
              date: visitDate,
              medication_name: med.name,
              dose: med.dose || undefined,
              instructions: med.instructions || undefined,
              medication_kind: 'prescription',
            }) as LogEntry
        );
      const knownConditions = (userData.conditions || []).map((name) => name.trim().toLowerCase());
      const conditionEntries: LogEntry[] = (extracted.diagnoses || [])
        .filter((name) => name && !knownConditions.includes(name.trim().toLowerCase()))
        .map((name) => ({ type: 'add_condition', condition_name: name }) as LogEntry);
      const entries = [...medEntries, ...conditionEntries];

      // Nothing to check: save the visit now. Otherwise show the review first, and nothing is saved until Save.
      if (entries.length === 0) {
        await addRecord(record);
        resetUpload();
        Alert.alert('Success', 'PDF added to your records.');
        return;
      }
      setSummaryReview({ record, entries });
      setUploadMode('pdf-review');
    } catch (error) {
      Alert.alert('Could not read that PDF', error instanceof Error ? error.message : String(error));
    } finally {
      setIsUploading(false);
    }
  };

  const resetUpload = () => {
    setSummaryReview(null);
    setUploadingSpecialty(null);
    setPhotoUri(null);
    setSelectedPhotos([]);
    setUploadMode('method');
  };

  // Saves the visit and the entries the person kept in the review
  const saveSummaryReview = async (toSave: LogEntry[]) => {
    if (!summaryReview) return;
    setIsUploading(true);
    try {
      await addRecord(summaryReview.record);
      if (toSave.length > 0) {
        const next = applyLogEntries(userData, toSave);
        const changed = Object.fromEntries(
          Object.entries(next).filter(([key, value]) => (userData as any)[key] !== value)
        );
        await patchUserData(changed);
      }
      resetUpload();
      Alert.alert('Saved', 'The visit was added to your records.');
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : String(error));
    } finally {
      setIsUploading(false);
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
        const mediaType = getMediaTypeFromUri(uri, result.assets[0].type);
        setPhotoUri(uri);
        setPhotoMediaType(mediaType);
        setSelectedPhotos([{ uri, mediaType }]);
        setUploadMode('photo-review');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to access photo library: ' + String(error));
    }
  };

  const handleUploadPhoto = async () => {
    if (uploadingSpecialty === null || selectedPhotos.length === 0) {
      Alert.alert('Error', 'Please select a photo');
      return;
    }

    setIsUploading(true);
    try {
      const recordId = generateUUID();

      // Process all selected photos
      const processedUris: string[] = [];

      for (const photo of selectedPhotos) {
        let imageUri = photo.uri;
        const needsConversion =
          photo.mediaType.includes('heic') ||
          photo.mediaType.includes('heif');

        if (needsConversion) {
          console.log(`🔄 Converting image (type: ${photo.mediaType}) from ${photo.uri} to JPEG...`);
          imageUri = await convertHeicToJpeg(photo.uri);
          console.log(`✓ Conversion complete. New URI: ${imageUri}`);
        } else {
          console.log(`📷 Using image as-is (type: ${photo.mediaType})`);
        }

        processedUris.push(imageUri);
      }

      // Convert first photo to base64 for analysis
      console.log(`📊 Reading image as base64 from: ${processedUris[0]}`);
      const base64 = await FileSystem.readAsStringAsync(processedUris[0], {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log(`✓ Base64 read successful. Length: ${base64.length} characters`);

      // The AI works out the type of document from its contents, so every upload is sent the same way
      const recordType = 'other';

      // Every document (all pages together) goes through the same structured extraction
      console.log(`🤖 Sending ${processedUris.length} page(s) for extraction (recordType: ${recordType})...`);
      const analysisResult = await cameraService.analyzeHealthRecord(processedUris, recordType);

      if (!analysisResult.success) {
        throw new Error(analysisResult.error || 'Failed to analyze record');
      }

      await addRecord(
        toMedicalRecord(analysisResult.data as ExtractedRecord, {
          id: recordId,
          uploadDate: new Date().toISOString(),
          imageUris: processedUris,
          chosenSpecialty: undefined,
        })
      );

      setUploadingSpecialty(null);
      setPhotoUri(null);
      setSelectedPhotos([]);
      setUploadMode('method');
      Alert.alert('Success', `Record${selectedPhotos.length > 1 ? 's' : ''} added from photo analysis!`);
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
    if (uploadingSpecialty === null || !doctorName.trim() || !appointmentDate.trim() || !appointmentSummary.trim()) {
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
        specialty: specialtyText.trim() || 'Other',
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
      <ScreenHeader title="Records" action={{ label: 'Upload a record', onPress: () => setUploadingSpecialty('') }} />
      <Text style={styles.headerSubtitle}>{specialties.length} specialties available</Text>

      {/* My Records Section */}
      <View style={styles.myRecordsSection}>
        <Text style={styles.sectionTitle}>My records</Text>
        {records.length > 0 ? (
          getOrganizedRecords().map(({ specialty, records: specialtyRecords }) => (
            <View key={specialty} style={styles.specialtyGroup}>
              <Text style={styles.specialtyGroupTitle}>{specialty}</Text>
              <ListCard>
                {specialtyRecords.map((record, index) => (
                  <React.Fragment key={record.id}>
                    {index > 0 && <Divider />}
                    <ListRow
                      icon={getSpecialtyIcon(specialty)}
                      label={record.provider || 'Record'}
                      badge={record.source ? <EpicBadge /> : undefined}
                      hint={record.reasonForVisit || record.summary || 'No description'}
                      value={new Date(record.appointmentDate || record.uploadDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                      onPress={() => {
                        setSelectedRecord(record);
                        setShowRecordDetail(true);
                      }}
                    />
                  </React.Fragment>
                ))}
              </ListCard>
            </View>
          ))
        ) : (
          <Text style={styles.emptyRecordsText}>No records yet. Upload your first record to get started.</Text>
        )}
      </View>

      {/* Health Metrics Section */}
      {metricCards.length > 0 && (
        <View style={styles.metricsSection}>
          <Text style={styles.sectionTitle}>Health metrics</Text>
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
      {records.some(r => r.specialty?.toLowerCase().includes('lab')) && (
        <View style={styles.myLabsSection}>
          <Text style={styles.sectionTitle}>My labs</Text>
          {labValues.length > 0 ? (
          <LabRangeList labs={labValues} onSelect={(name) => setSelectedLabName(name)} />
          ) : (
            <View style={{ padding: 16, backgroundColor: '#FFF8DC', borderRadius: 8, marginTop: 8 }}>
              <Text style={{ fontSize: 12, color: '#666', fontStyle: 'italic' }}>
                Lab records uploaded but parsing in progress... Check back in a moment.
              </Text>
              <Text style={{ fontSize: 11, color: '#999', marginTop: 8 }}>
                Records found: {records.filter(r => r.specialty?.toLowerCase().includes('lab')).length}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* One upload button: the app works out the type of visit or lab from the document */}
      <Section title="Upload">
        <ListCard>
          <ListRow
            icon="upload-outline"
            label="Upload a record"
            hint="A photo, a PDF, or typed details. The type of visit or lab is worked out for you."
            onPress={() => setUploadingSpecialty('')}
          />
        </ListCard>
      </Section>

      <View style={styles.spacing} />
    </ScrollView>

      {/* Upload Modal */}
      <Modal visible={uploadingSpecialty !== null} animationType="slide" onRequestClose={() => {
        setUploadingSpecialty(null);
        setRecordText('');
        setPhotoUri(null);
        setSelectedPhotos([]);
        setUploadMode('method');
      }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Upload a record</Text>
            <TouchableOpacity onPress={() => {
              setUploadingSpecialty(null);
              setRecordText('');
              setPhotoUri(null);
              setSelectedPhotos([]);
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
            {uploadMode === 'pdf-review' && summaryReview && (
              <>
                <Text style={styles.label}>Check this visit</Text>
                <Text style={styles.sublabel}>
                  {summaryReview.record.provider || 'Visit'} · Tap an entry to change it. Nothing is saved until you tap Save.
                </Text>
                <EntryReview
                  entries={summaryReview.entries}
                  active={currentMedicationNames(userData)}
                  saving={isUploading}
                  saveLabel="Save visit"
                  onSave={saveSummaryReview}
                  onCancel={resetUpload}
                />
              </>
            )}
            {uploadMode === 'method' && (
              <>
                <Text style={styles.label}>How would you like to upload?</Text>
                <Text style={styles.sublabel}>Choose a method to add your medical record</Text>
                <Text style={styles.consentText}>Documents are read by an AI service to fill in your record. They are sent to our server and to Anthropic to be read, and stored on this phone. Nothing is saved until you confirm.</Text>

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
                <TouchableOpacity style={styles.methodButton} onPress={handlePickPdf}>
                  <MaterialCommunityIcons name="file-pdf-box" size={24} color="#333" style={styles.methodButtonIcon} />
                  <View style={styles.methodButtonContent}>
                    <Text style={styles.methodButtonText}>Choose PDF</Text>
                    <Text style={styles.methodButtonDesc}>An after-visit summary or other PDF</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.methodButton}
                  onPress={() => {
                    setUploadMode('text');
                    const today = new Date();
                    setAppointmentPick(today);
                    setAppointmentDate(appointmentDayText(today));
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

                <Text style={styles.fieldLabel}>Specialty (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Cardiology"
                  placeholderTextColor="#999"
                  value={specialtyText}
                  onChangeText={setSpecialtyText}
                  editable={!isUploading}
                />
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
                <DateWheel
                  value={appointmentPick}
                  onChange={(picked) => {
                    setAppointmentPick(picked);
                    setAppointmentDate(appointmentDayText(picked));
                  }}
                />

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

            {uploadMode === 'add-photo-method' && (
              <>
                <Text style={styles.label}>Add Another Photo</Text>
                <Text style={styles.sublabel}>How would you like to add another photo?</Text>

                <TouchableOpacity style={styles.methodButton} onPress={handleTakeCameraPhotoForAdding}>
                  <Text style={styles.methodButtonIcon}>📷</Text>
                  <View style={styles.methodButtonContent}>
                    <Text style={styles.methodButtonText}>Take Photo</Text>
                    <Text style={styles.methodButtonDesc}>Use camera to photograph document</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.methodButton} onPress={handleAddPhotoFromLibrary}>
                  <Text style={styles.methodButtonIcon}>🖼️</Text>
                  <View style={styles.methodButtonContent}>
                    <Text style={styles.methodButtonText}>Choose Photo</Text>
                    <Text style={styles.methodButtonDesc}>Select from photo library</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setUploadMode('photo-review')}
                >
                  <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
              </>
            )}

            {uploadMode === 'photo-review' && selectedPhotos.length > 0 && (
              <>
                <Text style={styles.label}>Review Photos ({selectedPhotos.length})</Text>
                <View style={styles.photoGrid}>
                  {selectedPhotos.map((photo, index) => (
                    <View key={index} style={styles.photoGridItem}>
                      <Image source={{ uri: photo.uri }} style={styles.photoGridImage} resizeMode="contain" />
                      <Text style={styles.photoGridIndex}>Photo {index + 1}</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.sublabel}>Claude will analyze these images to extract medical information</Text>

                <View style={styles.photoReviewButtons}>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => setUploadMode('add-photo-method')}
                  >
                    <Text style={styles.secondaryButtonText}>+ Add Another Photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.addButton, isUploading && styles.buttonDisabled]}
                    onPress={handleUploadPhoto}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.addButtonText}>Analyze and save</Text>
                    )}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => {
                    setUploadMode('method');
                    setPhotoUri(null);
                    setSelectedPhotos([]);
                  }}
                >
                  <Text style={styles.backButtonText}>← Back</Text>
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

      {/* Record Detail Modal */}
      <Modal visible={showRecordDetail && selectedRecord !== null} animationType="slide" onRequestClose={() => { setShowRecordDetail(false); setIsEditingRecord(false); }}>
        <View style={styles.modalContainer}>
          <View style={styles.detailHeaderRow}>
            <TouchableOpacity onPress={() => {
              if (isEditingRecord) {
                setEditedReason('');
                setEditedSummary('');
                setEditedFindings('');
                setEditedNextSteps('');
              }
              setIsEditingRecord(!isEditingRecord);
            }}>
              <Text style={styles.detailAction}>{isEditingRecord ? 'Cancel' : 'Edit'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowRecordDetail(false); setIsEditingRecord(false); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.detailClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.detailPageTitle}>{isEditingRecord ? 'Edit record' : 'Record details'}</Text>

          <ScrollView style={styles.modalContent}>
            {selectedRecord && !isEditingRecord && <RecordSummary record={selectedRecord} />}
            {selectedRecord && isEditingRecord && (
              <>
                <View style={{ marginBottom: 20 }}>
                  <Text style={styles.label}>Date</Text>
                  {isEditingRecord ? (
                    <DateWheel value={editRecordDate} onChange={setEditRecordDate} />
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
                  <Text style={styles.label}>Specialty</Text>
                  {isEditingRecord ? (
                    <TextInput
                      style={styles.input}
                      value={editedSpecialty || selectedRecord.specialty || ''}
                      onChangeText={setEditedSpecialty}
                      placeholder="e.g., Cardiology"
                      placeholderTextColor="#999"
                    />
                  ) : (
                    <Text style={[styles.infoValue, { fontWeight: '600' }]}>{selectedRecord.specialty}</Text>
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
                  setEditedSpecialty('');
                  setEditedDate('');
                  setEditedReason('');
                  setEditedSummary('');
                  setEditedFindings('');
                  setEditedNextSteps('');
                  setEditRecordDate(new Date());
                }}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, { flex: 1 }]}
                onPress={async () => {
                  const formattedDate = new Date(editRecordDate.getFullYear(), editRecordDate.getMonth(), editRecordDate.getDate()).toISOString();
                  const updatedRecord = {
                    ...selectedRecord,
                    provider: editedProvider || selectedRecord.provider,
                    specialty: editedSpecialty.trim() || selectedRecord.specialty,
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
                    setEditedSpecialty('');
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

      {/* Lab History Modal: the same layout as the record details */}
      <DetailPage visible={selectedLabName !== null} title={selectedLabName ?? undefined} onClose={() => setSelectedLabName(null)}>
        {selectedLabName && (() => {
          const lab = labValues.find(lab => lab.name === selectedLabName);
          if (!lab) return null;

          const sortedHistory = [...lab.history].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );

          // Calculate trend
          let trend = '→';
          let trendLabel = 'Stable';
          if (sortedHistory.length >= 2) {
            const current = parseFloat(sortedHistory[0].value);
            const previous = parseFloat(sortedHistory[1].value);
            if (!isNaN(current) && !isNaN(previous)) {
              if (current > previous) {
                trend = '↑';
                trendLabel = 'Trending up';
              } else if (current < previous) {
                trend = '↓';
                trendLabel = 'Trending down';
              }
            }
          }

          const explanation = explanationFor(lab.name);

          return (
            <View style={styles.labPageContent}>
              <Section title="Current value">
                <ListCard>
                  <View style={styles.labPageCurrent}>
                    <Text style={styles.labPageValue}>{lab.value}</Text>
                    <Text style={styles.labPageArrow}>{trend}</Text>
                  </View>
                  <Text style={styles.labPageTrendText}>{trendLabel}</Text>
                  {lab.range && (
                    <>
                      <Divider />
                      <ListRow icon="arrow-expand-vertical" label="Normal range" value={lab.range} />
                    </>
                  )}
                </ListCard>
              </Section>

              <Section title="Trend">
                <ListCard>
                  <View style={styles.labPageChart}>
                    <LabTrendChart history={[...sortedHistory].reverse()} range={lab.range} />
                  </View>
                </ListCard>
              </Section>

              <Section title="What this means">
                <ListCard>
                  {explanation ? (
                    <>
                      <Text style={styles.labPageText}>{explanation.text}</Text>
                      <Divider />
                      <ListRow
                        icon="open-in-new"
                        label={`Source: ${explanation.sourceName}`}
                        onPress={() => Linking.openURL(explanation.sourceUrl)}
                      />
                    </>
                  ) : (
                    <Text style={styles.labPageText}>No explanation is available for this test yet.</Text>
                  )}
                </ListCard>
              </Section>

              {/* Ask the chatbot about this result */}
              <LabAskBox
                labName={lab.name}
                context={`My ${lab.name} result is ${lab.value}${lab.range ? ` (normal range: ${lab.range})` : ''}.`}
              />

              <Section title="History">
                <ListCard>
                  {sortedHistory.map((entry, index) => (
                    <React.Fragment key={index}>
                      {index > 0 && <Divider />}
                      <ListRow
                        icon="calendar-outline"
                        label={entry.value}
                        hint={new Date(entry.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                        value={index === 0 ? 'Latest' : undefined}
                      />
                    </React.Fragment>
                  ))}
                </ListCard>
              </Section>
            </View>
          );
        })()}
      </DetailPage>

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

// Line icon for each specialty, matching the Home screen's icons
function getSpecialtyIcon(specialty: string): React.ComponentProps<typeof MaterialCommunityIcons>['name'] {
  const map: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
    cardiology: 'heart-pulse',
    orthopedics: 'bone',
    dermatology: 'bandage',
    neurology: 'brain',
    obgyn: 'baby-face-outline',
    ophthalmology: 'eye-outline',
    oncology: 'hospital-building',
    lab: 'flask-outline',
    imaging: 'radiology-box-outline',
    pharmacy: 'pill',
    'primary care': 'stethoscope',
    dentistry: 'tooth-outline',
    psychiatry: 'head-cog-outline',
  };
  return map[specialty.toLowerCase()] ?? 'file-document-outline';
}

const styles = StyleSheet.create({
  labPageContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  labPageCurrent: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  labPageValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
  },
  labPageArrow: {
    fontSize: 22,
    color: '#666',
  },
  labPageTrendText: {
    fontSize: 13,
    color: '#666',
    paddingBottom: 14,
  },
  labPageChart: {
    paddingVertical: 12,
  },
  labPageText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#222',
    paddingVertical: 14,
  },
  labExplainBox: {
    backgroundColor: '#F7F9FC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  labExplainTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  labExplainText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#333',
  },
  labExplainSource: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
    marginTop: 10,
  },
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
  headerSubtitle: {
    fontSize: 13,
    color: '#666',
    paddingHorizontal: 20,
    marginBottom: 12,
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
  labRange: {
    fontSize: 10,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  labDetailCurrentSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#E8F4FF',
    borderRadius: 12,
    marginBottom: 20,
  },
  labDetailCurrentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 8,
  },
  labDetailCurrentValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#007AFF',
  },
  labDetailTrend: {
    fontSize: 32,
    marginLeft: 8,
  },
  labDetailTrendLabel: {
    fontSize: 14,
    color: '#0051BA',
    fontWeight: '500',
  },
  labDetailRangeInline: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 81, 186, 0.2)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labDetailRangeLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  labDetailRangeValue: {
    fontSize: 12,
    color: '#0051BA',
    fontWeight: '600',
  },
  labDetailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  labDetailRangeSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    marginBottom: 20,
  },
  labDetailRange: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  labDetailHistorySection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  labHistoryItemLeft: {
    flex: 1,
  },
  labHistoryLatest: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    backgroundColor: '#E8F4FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
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
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
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
  detailHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  detailAction: {
    fontSize: 17,
    color: '#007AFF',
  },
  detailClose: {
    fontSize: 26,
    color: '#007AFF',
    fontWeight: '600',
  },
  detailPageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
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
  consentText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 17,
    marginBottom: 12,
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
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginVertical: 16,
    justifyContent: 'space-between',
  },
  photoGridItem: {
    width: '48%',
    alignItems: 'center',
  },
  photoGridImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  photoGridIndex: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
  },
  photoReviewButtons: {
    gap: 12,
    marginVertical: 16,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  secondaryButton: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
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
    marginBottom: 8,
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
