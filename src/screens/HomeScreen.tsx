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
  Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useRecords } from '@/context/RecordsContext';
import { useRouter } from 'expo-router';
import WearableVitals from '@/components/WearableVitals';
import LifestyleCard from '@/components/LifestyleCard';
import { claudeService, convertHeicToJpeg } from '@/services/claudeService';
import { ehrService, Medication, Appointment, Observation, Allergy, Condition, EpicOverride } from '@/services/ehrService';
import LabTrendChart from '@/components/LabTrendChart';
import QuickLogBox from '@/components/QuickLogBox';
import MedicationCalendar from '@/components/MedicationCalendar';
import { nextDoseLabel, parseTime, formatTime } from '@/services/doseSchedule';
import { Section, ListCard, ListRow, Divider, DetailPage } from '@/components/ScreenKit';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { rowIconSize } from '@/components/rowIcons';
import { applyLogEntries, LogEntry } from '@/services/quickLog';

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

// A detail page that opens from a row. Sections bring their own headers, so the title is optional.
function DetailModal({
  visible,
  title,
  onClose,
  onDismiss,
  action,
  children,
}: {
  visible: boolean;
  title?: string;
  onClose: () => void;
  onDismiss?: () => void;
  action?: { label: string; onPress: () => void };
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onDismiss={onDismiss}>
      <View style={styles.detailModal}>
        <View style={styles.detailHeader}>
          {action ? (
            <TouchableOpacity onPress={action.onPress}>
              <Text style={styles.detailAction}>{action.label}</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.detailClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.detailContent}>
          {title ? <Text style={styles.detailTitle}>{title}</Text> : null}
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// One tappable row in the vitals group: icon, label, value, and a chevron. Edit appears only in edit mode.
function VitalRow({
  icon,
  label,
  value,
  hint,
  iconColor = '#666',
  onPress,
}: {
  icon: IconName;
  iconColor?: string;
  label: string;
  value: string;
  hint?: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.vitalRow}>
      <TouchableOpacity style={styles.vitalTouch} onPress={onPress}>
        <MaterialCommunityIcons name={icon} size={rowIconSize(icon)} color={iconColor} style={styles.rowIcon} />
        <View style={styles.vitalContent}>
          <Text style={styles.vitalLabel}>{label}</Text>
          {hint ? <Text style={styles.vitalHint}>{hint}</Text> : null}
        </View>
        <Text style={styles.vitalValue}>{value}</Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color="#C7C7CC" style={styles.rowChevron} />
      </TouchableOpacity>
    </View>
  );
}

export default function HomeScreen() {
  const { records, userData, loading, getAbnormalResults, patchUserData } = useRecords();
  const router = useRouter();
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editData, setEditData] = useState(userData);
  // Keep the editing copy in step with saved data, so a later save never writes back older readings
  useEffect(() => {
    setEditData(userData);
  }, [userData]);
  const [medicationPhoto, setMedicationPhoto] = useState<string | null>(null);
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [appointmentDateTime, setAppointmentDateTime] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  // Initialize with today's date
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth()); // Today's month (0-indexed)
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate()); // Today's day
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear()); // Today's year
  const [selectedHour, setSelectedHour] = useState(2);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState('PM');
  const [selectedFeet, setSelectedFeet] = useState(5);
  const [selectedInches, setSelectedInches] = useState(10);
  const [selectedWeight, setSelectedWeight] = useState(180);
  const [selectedSystolic, setSelectedSystolic] = useState(120);
  const [selectedDiastolic, setSelectedDiastolic] = useState(80);
  const [appointmentDoctorName, setAppointmentDoctorName] = useState('');
  const [appointmentSpecialty, setAppointmentSpecialty] = useState('');
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [insuranceMemberId, setInsuranceMemberId] = useState('');
  const [insuranceGroupNumber, setInsuranceGroupNumber] = useState('');
  const [editingInsuranceId, setEditingInsuranceId] = useState<number | null>(null);
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [editingEmergencyContactId, setEditingEmergencyContactId] = useState<number | null>(null);
  const [pharmacyName, setPharmacyName] = useState('');
  const [pharmacyAddress, setPharmacyAddress] = useState('');
  const [pharmacyPhone, setPharmacyPhone] = useState('');
  const [screeningType, setScreeningType] = useState('');
  const [screeningDate, setScreeningDate] = useState('');
  const [screeningNotes, setScreeningNotes] = useState('');
  const [editingScreeningId, setEditingScreeningId] = useState<number | null>(null);
  const [selectedBirthdayMonth, setSelectedBirthdayMonth] = useState(0);
  const [selectedBirthdayDay, setSelectedBirthdayDay] = useState(1);
  const [selectedBirthdayYear, setSelectedBirthdayYear] = useState(1990);
  const [selectedGender, setSelectedGender] = useState('Other');
  const [customGender, setCustomGender] = useState('');
  const [editingHistoryType, setEditingHistoryType] = useState<'surgical' | 'family' | 'conditions' | 'hospitalization' | null>(null);
  const [surgeryDate, setSurgeryDate] = useState('');
  const [surgeryName, setSurgeryName] = useState('');
  const [familyMember, setFamilyMember] = useState('');
  const [familyMemberCustomMode, setFamilyMemberCustomMode] = useState(false);
  const [familyCondition, setFamilyCondition] = useState('');
  const [conditionName, setConditionName] = useState('');
  const [hospitalizationDate, setHospitalizationDate] = useState('');
  const [hospitalizationReason, setHospitalizationReason] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showHistoryDatePicker, setShowHistoryDatePicker] = useState(false);
  const [historyDateMonth, setHistoryDateMonth] = useState(0);
  const [historyDateDay, setHistoryDateDay] = useState(1);
  const [historyDateYear, setHistoryDateYear] = useState(new Date().getFullYear());
  const [addingPrescriptionMed, setAddingPrescriptionMed] = useState(false);
  const [newPrescriptionMed, setNewPrescriptionMed] = useState('');
  const [editingMed, setEditingMed] = useState<{ kind: 'prescription' | 'otc'; index: number } | null>(null);
  const [pendingMedEdit, setPendingMedEdit] = useState<{ kind: 'prescription' | 'otc'; index: number } | null>(null);
  const [medEditName, setMedEditName] = useState('');
  const [medEditDose, setMedEditDose] = useState('');
  const [medsTab, setMedsTab] = useState<'list' | 'calendar'>('list');
  const [medEditTimes, setMedEditTimes] = useState<string[]>([]);
  const [medEditTimeText, setMedEditTimeText] = useState('');
  const [medEditFrequency, setMedEditFrequency] = useState('');
  const [addingOtcMed, setAddingOtcMed] = useState(false);
  const [newOtcMed, setNewOtcMed] = useState('');
  const [addingCondition, setAddingCondition] = useState(false);
  const [newCondition, setNewCondition] = useState('');
  const [editingConditionIdx, setEditingConditionIdx] = useState<number | null>(null);
  const [editingConditionValue, setEditingConditionValue] = useState('');
  const [addingAllergy, setAddingAllergy] = useState(false);
  const [newAllergy, setNewAllergy] = useState('');
  const [editingAllergyIdx, setEditingAllergyIdx] = useState<number | null>(null);
  const [editingAllergyValue, setEditingAllergyValue] = useState('');
  const [addingVaccine, setAddingVaccine] = useState(false);
  const [newVaccine, setNewVaccine] = useState('');
  const [editingVaccineIdx, setEditingVaccineIdx] = useState<number | null>(null);
  const [editingVaccineValue, setEditingVaccineValue] = useState('');
  const [newVaccineName, setNewVaccineName] = useState('');
  const [newVaccineDate, setNewVaccineDate] = useState('');
  const [newVaccineNextDue, setNewVaccineNextDue] = useState('');
  const [editingVaccineId, setEditingVaccineId] = useState<number | null>(null);
  const [showVaccineModal, setShowVaccineModal] = useState(false);
  const [selectedRecommendedVaccine, setSelectedRecommendedVaccine] = useState<string>('');
  const [medicationInputMode, setMedicationInputMode] = useState<'method' | 'text' | 'photo' | null>(null);
  const [medicationType, setMedicationType] = useState<'prescription' | 'otc' | null>(null);
  const [medicationInputText, setMedicationInputText] = useState('');
  const [medicationPhotoUri, setMedicationPhotoUri] = useState<string | null>(null);
  const [medicationPhotoMediaType, setMedicationPhotoMediaType] = useState<string>('image/jpeg');
  const [analyzingMedication, setAnalyzingMedication] = useState(false);
  const [cameraModalType, setCameraModalType] = useState<'medication' | 'document' | 'record' | null>(null);
  const [medicationPhotos, setMedicationPhotos] = useState<string[]>([]);
  const [documentPhotos, setDocumentPhotos] = useState<string[]>([]);
  const [recordPhotos, setRecordPhotos] = useState<string[]>([]);

  // Epic FHIR data
  const [epicMedications, setEpicMedications] = useState<Medication[]>([]);
  const [epicAppointments, setEpicAppointments] = useState<Appointment[]>([]);
  const [epicObservations, setEpicObservations] = useState<Observation[]>([]);
  const [epicAllergies, setEpicAllergies] = useState<Allergy[]>([]);
  const [epicConditions, setEpicConditions] = useState<Condition[]>([]);
  const [openPage, setOpenPage] = useState<string | null>(null);
  const [pendingMedicationAdd, setPendingMedicationAdd] = useState<'prescription' | 'otc' | null>(null);
  const [epicLoading, setEpicLoading] = useState(false);
  const [epicOverrides, setEpicOverrides] = useState<Record<string, EpicOverride>>({});
  const [addingReading, setAddingReading] = useState<'weight' | 'bp' | null>(null);
  const [newWeight, setNewWeight] = useState('');
  const [newSystolic, setNewSystolic] = useState('');
  const [newDiastolic, setNewDiastolic] = useState('');
  const [vitalDetail, setVitalDetail] = useState<'weight' | 'bp' | null>(null);
  const [newReadingDate, setNewReadingDate] = useState('');
  // Each time the add form opens, start from today
  useEffect(() => {
    if (addingReading) setNewReadingDate(todayInput());
  }, [addingReading]);

  const [editingEpic, setEditingEpic] = useState<{ key: string; primary: string; secondary: string; primaryLabel: string; secondaryLabel: string } | null>(null);

  useEffect(() => {
    initializeEpic();
  }, []);

  const initializeEpic = async () => {
    try {
      // Initialize Epic service with stored access token
      await ehrService.load();
      // Try to load Epic data if connected
      const connected = await ehrService.hasAnyConnection();
      if (connected) {
        await loadEpicData();
      }
    } catch (error) {
      console.error('Error initializing Epic:', error);
    }
  };

  const loadEpicData = async () => {
    setEpicLoading(true);
    try {
      const [meds, appts, allergies, conditions] = await Promise.all([
        ehrService.getMedications(),
        ehrService.getAppointments(),
        ehrService.getAllergies(),
        ehrService.getConditions(),
      ]);
      setEpicMedications(meds);
      setEpicAppointments(appts);
      setEpicAllergies(allergies);
      setEpicConditions(conditions);
      setEpicOverrides(await ehrService.getOverrides());
    } catch (error) {
      console.error('Failed to load Epic data:', error);
    } finally {
      setEpicLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Edits to Epic items on this screen. Epic's data is never changed; the edit is shown in its place.
  const epicText = (key: string, original: string, field: 'primary' | 'secondary') =>
    epicOverrides[key]?.[field] || original;

  const openEpicEdit = (key: string, kind: 'medication' | 'allergy' | 'appointment' | 'condition', primary: string, secondary: string) => {
    const labels = {
      medication: ['Medication name', 'Dosage'],
      allergy: ['Allergy', 'Reaction'],
      condition: ['Condition', 'Status'],
      appointment: ['Visit description', 'Doctor'],
    }[kind];
    setEditingEpic({ key, primary, secondary, primaryLabel: labels[0], secondaryLabel: labels[1] });
  };

  const saveEpicEdit = async () => {
    if (!editingEpic) return;
    const overrides = await ehrService.saveOverride(editingEpic.key, {
      primary: editingEpic.primary.trim(),
      secondary: editingEpic.secondary.trim(),
    });
    setEpicOverrides(overrides);
    setEditingEpic(null);
  };

  const restoreEpicEdit = async () => {
    if (!editingEpic) return;
    setEpicOverrides(await ehrService.clearOverride(editingEpic.key));
    setEditingEpic(null);
  };

  // Each new reading is saved with today's date and added to the history
  const saveNewReading = async () => {
    const chosen = parseReadingDate(newReadingDate);
    if (!chosen) {
      Alert.alert('Check the date', 'Please use MM/DD/YYYY, for example 10/14/2026. The date cannot be in the future.');
      return;
    }
    // Today keeps the current time; any other day is stored at midday so it doesn't shift
    const isToday = chosen.toDateString() === new Date().toDateString();
    const now = (isToday ? new Date() : chosen).toISOString();
    if (addingReading === 'weight') {
      const value = Number(newWeight);
      if (!newWeight.trim() || isNaN(value)) {
        Alert.alert('Enter a weight', 'Please enter a number, for example 182.');
        return;
      }
      await patchUserData({
        weight: `${value} lbs`,
        weightHistory: [...(userData.weightHistory || []), { date: now, value }],
      });
    } else if (addingReading === 'bp') {
      const systolic = Number(newSystolic);
      const diastolic = Number(newDiastolic);
      if (!newSystolic.trim() || !newDiastolic.trim() || isNaN(systolic) || isNaN(diastolic)) {
        Alert.alert('Enter both numbers', 'Please enter the top (systolic) and bottom (diastolic) numbers.');
        return;
      }
      await patchUserData({
        vitals: { ...userData.vitals, bloodPressure: `${systolic}/${diastolic} mmHg` },
        bloodPressureHistory: [...(userData.bloodPressureHistory || []), { date: now, systolic, diastolic }],
      });
    }
    setAddingReading(null);
  };

  // Oldest first, so the last item is the most recent reading
  const sortedByDate = <T extends { date: string }>(list: T[] = []) =>
    [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Short note comparing the latest reading with the one before it
  const trendHint = (values: number[], unit: string) => {
    if (values.length < 2) return '';
    const diff = Math.round((values[values.length - 1] - values[values.length - 2]) * 10) / 10;
    if (diff === 0) return 'No change since the last reading';
    return `${diff > 0 ? '↑' : '↓'} ${Math.abs(diff)} ${unit} since the last reading`;
  };

  const formatReadingDate = (iso: string) =>
    new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  const weightSorted = sortedByDate(userData.weightHistory);
  const bpSorted = sortedByDate(userData.bloodPressureHistory);
  // The reading whose date is closest to today, so the row always shows the measurement nearest the present
  const closestToToday = <T extends { date: string }>(items: T[]): T | undefined => {
    const now = Date.now();
    let best: T | undefined;
    let bestGap = Infinity;
    for (const item of items) {
      const gap = Math.abs(new Date(item.date).getTime() - now);
      if (!isNaN(gap) && gap < bestGap) {
        best = item;
        bestGap = gap;
      }
    }
    return best;
  };
  const weightNow = closestToToday(weightSorted);
  const bloodPressureNow = closestToToday(bpSorted);
  const weightHint = trendHint(weightSorted.map((r) => r.value), 'lbs');
  const bpHint = trendHint(bpSorted.map((r) => r.systolic), 'mmHg (top number)');

  // Newest first in the list, keeping each reading's original index for deleting
  const weightList = weightSorted.map((r) => ({ ...r, index: (userData.weightHistory || []).indexOf(r) })).reverse();
  const bpList = bpSorted.map((r) => ({ ...r, index: (userData.bloodPressureHistory || []).indexOf(r) })).reverse();

  const deleteWeightReading = (index: number) => {
    Alert.alert('Delete reading', 'Remove this weight reading?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const remaining = (userData.weightHistory || []).filter((_, i) => i !== index);
          const latest = sortedByDate(remaining).slice(-1)[0];
          await patchUserData({ weightHistory: remaining, weight: latest ? `${latest.value} lbs` : userData.weight });
        },
      },
    ]);
  };

  const deleteBpReading = (index: number) => {
    Alert.alert('Delete reading', 'Remove this blood pressure reading?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const remaining = (userData.bloodPressureHistory || []).filter((_, i) => i !== index);
          const latest = sortedByDate(remaining).slice(-1)[0];
          await patchUserData({
            bloodPressureHistory: remaining,
            vitals: latest
              ? { ...userData.vitals, bloodPressure: `${latest.systolic}/${latest.diastolic} mmHg` }
              : userData.vitals,
          });
        },
      },
    ]);
  };

  // Dates on the add form are typed as MM/DD/YYYY and default to today
  const todayInput = () => {
    const d = new Date();
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  };

  // Returns the typed date at midday, or null if it isn't a real date or is in the future
  const parseReadingDate = (text: string): Date | null => {
    const match = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    const month = parseInt(match[1], 10);
    const day = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    const date = new Date(year, month - 1, day, 12, 0, 0);
    if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    if (date.getTime() > Date.now() + 24 * 60 * 60 * 1000) return null;
    return date;
  };

  const todayLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const abnormalResults = getAbnormalResults();

  const calculateAge = (birthday: string): number => {
    if (!birthday) return 0;
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const parts = birthday.split(' ');
    const monthStr = parts[0];
    const dayStr = parseInt(parts[1]);
    const yearStr = parseInt(parts[2]);
    const monthIdx = months.indexOf(monthStr);

    const birthDate = new Date(yearStr, monthIdx, dayStr);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dayStr)) {
      age--;
    }

    return age;
  };

  const parseAppointmentDate = (dateTimeStr: string): Date => {
    // Parse format like "August 15, 2024 • 2:00 PM"
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const parts = dateTimeStr.split(' • ');
    const datePart = parts[0];
    const timePart = parts[1] || '';

    const dateParts = datePart.split(' ');
    const monthStr = dateParts[0];
    const dayStr = parseInt(dateParts[1].replace(',', ''));
    const yearStr = parseInt(dateParts[2]);
    const monthIdx = months.indexOf(monthStr);

    const timeParts = timePart.split(':');
    let hour = parseInt(timeParts[0]) || 0;
    const minute = parseInt(timeParts[1]) || 0;
    const period = timePart.includes('PM') ? 'PM' : 'AM';

    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;

    return new Date(yearStr, monthIdx, dayStr, hour, minute);
  };

  const getRecommendedScreenings = (): string[] => {
    const age = calculateAge(userData.birthday || '');
    const gender = userData.gender?.toLowerCase() || '';
    const recommendations: string[] = [];

    // Universal screenings
    recommendations.push('Blood Pressure Check');
    recommendations.push('Cholesterol Screening');

    // Age 18-39
    if (age >= 18 && age < 40) {
      recommendations.push('Diabetes Screening (if risk factors)');
    }

    // Age 40-49
    if (age >= 40 && age < 50) {
      recommendations.push('Blood Glucose/Diabetes Screening');
      recommendations.push('Cardiovascular Risk Assessment');
    }

    // Age 50+
    if (age >= 50) {
      recommendations.push('Colorectal Cancer Screening');
      recommendations.push('Diabetes Screening');
    }

    // Cervical cancer screening (women 21-65)
    if (gender.includes('female') || gender.includes('woman')) {
      if (age >= 21 && age <= 65) {
        recommendations.push('Cervical Cancer Screening (Pap Smear)');
      }
      // Breast cancer screening (women 40+)
      if (age >= 40) {
        recommendations.push('Breast Cancer Screening (Mammogram)');
      }
      // Bone density screening (women 65+)
      if (age >= 65) {
        recommendations.push('Bone Density Screening (DEXA)');
      }
    }

    // Prostate cancer screening (men 50-70, shared decision)
    if (gender.includes('male') || gender.includes('man')) {
      if (age >= 50 && age <= 70) {
        recommendations.push('Prostate Cancer Screening (PSA)');
      }
    }

    // Abdominal aortic aneurysm (men 65-75 with smoking history)
    if ((gender.includes('male') || gender.includes('man')) && age >= 65 && age <= 75) {
      recommendations.push('Abdominal Aortic Aneurysm (AAA) Screening');
    }

    // Osteoporosis screening (women 65+, men 70+)
    if (gender.includes('female') && age >= 65) {
      recommendations.push('Osteoporosis Screening');
    }
    if (gender.includes('male') && age >= 70) {
      recommendations.push('Osteoporosis Screening');
    }

    // Lung cancer screening (50-80 with smoking history)
    if (age >= 50 && age <= 80) {
      recommendations.push('Lung Cancer Screening (if smoker)');
    }

    return recommendations;
  };

  const getRecommendedVaccines = (): string[] => {
    const age = calculateAge(userData.birthday || '');
    const recommendations: string[] = [];

    // Universal recommendations
    recommendations.push('Influenza (Flu) Vaccine - Annual');
    recommendations.push('COVID-19 Vaccine - Updated');

    // Age 19-59
    if (age >= 19 && age < 60) {
      recommendations.push('Tdap/Td - Every 10 years');
      recommendations.push('Pneumococcal Vaccine (if risk factors)');
    }

    // Age 60+
    if (age >= 60) {
      recommendations.push('Shingles (Shingrix) Vaccine');
      recommendations.push('Pneumococcal Vaccine (PPSV23/PCV20)');
      recommendations.push('Tdap/Td - Every 10 years');
      recommendations.push('RSV Vaccine (age 60+)');
    }

    // Age 50+
    if (age >= 50) {
      recommendations.push('Mpox Vaccine (if indicated)');
    }

    return recommendations;
  };

  const handleSaveEdit = async () => {
    try {
      if (editingSection === 'appointments' && appointmentDateTime && appointmentDoctorName && appointmentSpecialty) {
        let updatedAppointments;

        if (editingAppointmentId) {
          // Update existing appointment
          updatedAppointments = (editData.appointments || []).map(apt =>
            apt.id === editingAppointmentId
              ? { ...apt, dateTime: appointmentDateTime, doctorName: appointmentDoctorName, specialty: appointmentSpecialty }
              : apt
          );
          setEditingAppointmentId(null);
        } else {
          // Add new appointment
          const newAppointment = {
            id: String(Date.now()),
            dateTime: appointmentDateTime,
            doctorName: appointmentDoctorName,
            specialty: appointmentSpecialty,
          };
          updatedAppointments = [...(editData.appointments || []), newAppointment];
        }

        await patchUserData({ appointments: updatedAppointments });
        setAppointmentDateTime('');
        setAppointmentDoctorName('');
        setAppointmentSpecialty('');
      } else if (editingSection === 'insurance' && insuranceProvider) {
        let updatedInsurances;

        if (editingInsuranceId !== null) {
          // Update existing insurance
          updatedInsurances = (editData.insurances || []).map((insurance, idx) =>
            idx === editingInsuranceId
              ? { provider: insuranceProvider, memberId: insuranceMemberId, groupNumber: insuranceGroupNumber }
              : insurance
          );
          setEditingInsuranceId(null);
        } else {
          // Add new insurance
          const newInsurance = {
            provider: insuranceProvider,
            memberId: insuranceMemberId,
            groupNumber: insuranceGroupNumber,
          };
          updatedInsurances = [...(editData.insurances || []), newInsurance];
        }

        await patchUserData({ insurances: updatedInsurances });
        setInsuranceProvider('');
        setInsuranceMemberId('');
        setInsuranceGroupNumber('');
      } else if (editingSection === 'emergency' && emergencyContactName && emergencyContactPhone) {
        let updatedContacts;

        if (editingEmergencyContactId !== null) {
          // Update existing contact
          updatedContacts = (editData.emergencyContacts || []).map((contact, idx) =>
            idx === editingEmergencyContactId
              ? { name: emergencyContactName, relationship: emergencyContactRelationship, phone: emergencyContactPhone }
              : contact
          );
          setEditingEmergencyContactId(null);
        } else {
          // Add new contact
          const newContact = {
            name: emergencyContactName,
            relationship: emergencyContactRelationship,
            phone: emergencyContactPhone,
          };
          updatedContacts = [...(editData.emergencyContacts || []), newContact];
        }

        await patchUserData({ emergencyContacts: updatedContacts });
        setEmergencyContactName('');
        setEmergencyContactRelationship('');
        setEmergencyContactPhone('');
      } else if (editingSection === 'pharmacy' && pharmacyName && pharmacyPhone) {
        await patchUserData({
          pharmacy: {
            name: pharmacyName,
            address: pharmacyAddress,
            phone: pharmacyPhone,
          },
        });
        setPharmacyName('');
        setPharmacyAddress('');
        setPharmacyPhone('');
      } else if (editingSection === 'screenings' && screeningType && screeningDate) {
        let updatedScreenings;

        if (editingScreeningId !== null) {
          updatedScreenings = (editData.screenings || []).map((screening, idx) =>
            idx === editingScreeningId
              ? { type: screeningType, date: screeningDate, notes: screeningNotes }
              : screening
          );
          setEditingScreeningId(null);
        } else {
          const newScreening = {
            type: screeningType,
            date: screeningDate,
            notes: screeningNotes,
          };
          updatedScreenings = [...(editData.screenings || []), newScreening];
        }

        await patchUserData({ screenings: updatedScreenings });
        setScreeningType('');
        setScreeningDate('');
        setScreeningNotes('');
      } else if (editingHistoryType === 'surgical' && surgeryName) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const formattedDate = `${months[historyDateMonth]} ${historyDateYear}`;
        let surgicalHistory = editData.surgicalHistory || [];
        if (editingIndex !== null) {
          surgicalHistory[editingIndex] = { surgeryName, date: formattedDate };
        } else {
          surgicalHistory.push({ surgeryName, date: formattedDate });
        }
        await patchUserData({ surgicalHistory });
        setSurgeryName('');
        setSurgeryDate('');
      } else if (editingHistoryType === 'family' && familyMember && familyCondition) {
        let familyHistory = editData.familyHistory || [];
        if (editingIndex !== null) {
          familyHistory[editingIndex] = { familyMember, condition: familyCondition };
        } else {
          familyHistory.push({ familyMember, condition: familyCondition });
        }
        await patchUserData({ familyHistory });
        setFamilyMember('');
        setFamilyCondition('');
      } else if (editingHistoryType === 'conditions' && conditionName) {
        let pastConditions = editData.pastConditions || [];
        if (editingIndex !== null) {
          pastConditions[editingIndex] = conditionName;
        } else {
          pastConditions.push(conditionName);
        }
        await patchUserData({ pastConditions });
        setConditionName('');
      } else if (editingHistoryType === 'hospitalization' && hospitalizationReason) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const formattedDate = `${months[historyDateMonth]} ${historyDateYear}`;
        let hospitalizations = editData.hospitalizations || [];
        if (editingIndex !== null) {
          hospitalizations[editingIndex] = { reason: hospitalizationReason, date: formattedDate };
        } else {
          hospitalizations.push({ reason: hospitalizationReason, date: formattedDate });
        }
        await patchUserData({ hospitalizations });
        setHospitalizationReason('');
        setHospitalizationDate('');
      } else {
        // Save only what differs from the current profile, so nothing else is written back
        const changes = Object.fromEntries(
          Object.entries(editData).filter(([key, value]) => (userData as any)[key] !== value)
        );
        await patchUserData(changes);
      }
      setEditingSection(null);
      setEditingHistoryType(null);
      setFamilyMemberCustomMode(false);
      Alert.alert('Success', 'Changes saved');
    } catch (error) {
      Alert.alert('Error', 'Failed to save changes');
    }
  };

  const handleCancel = () => {
    setEditData(userData);
    setEditingSection(null);
    setEditingHistoryType(null);
    setShowHistoryDatePicker(false);
    setFamilyMemberCustomMode(false);
    setMedicationPhoto(null);
    setEditingAppointmentId(null);
    setAppointmentDateTime('');
    setAppointmentDoctorName('');
    setAppointmentSpecialty('');
    setInsuranceProvider('');
    setInsuranceMemberId('');
    setInsuranceGroupNumber('');
    setEmergencyContactName('');
    setEmergencyContactRelationship('');
    setEmergencyContactPhone('');
    setEditingEmergencyContactId(null);
  };


  const handleMedicationPhotoCapture = async () => {
    try {
      const ImagePickerModule = require('expo-image-picker');

      // Request camera permission
      const { status } = await ImagePickerModule.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required to take photos');
        return;
      }

      const result = await ImagePickerModule.launchCameraAsync({
        mediaTypes: ImagePickerModule.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setMedicationPhotoUri(uri);
        setMedicationPhotoMediaType(getMediaTypeFromUri(uri, result.assets[0].type));
        setMedicationInputMode('photo');
      }
    } catch (error) {
      Alert.alert('Camera Not Available', 'Camera is not available in your current environment. Use "Type Details" instead to add medications manually.');
    }
  };

  const handleMedicationPhotoLibrary = async () => {
    try {
      const ImagePickerModule = require('expo-image-picker');

      // Request photo library permission
      const { status } = await ImagePickerModule.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Photo library permission is required to select photos');
        return;
      }

      const result = await ImagePickerModule.launchImageLibraryAsync({
        mediaTypes: ImagePickerModule.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setMedicationPhotoUri(uri);
        setMedicationPhotoMediaType(getMediaTypeFromUri(uri, result.assets[0].type));
        setMedicationInputMode('photo');
      }
    } catch (error) {
      Alert.alert('Photo Library Not Available', 'Photo library is not available in your current environment. Use "Type Details" instead to add medications manually.');
    }
  };

  const handleMedicationPhotoSubmit = async () => {
    if (!medicationPhotoUri || !medicationType) {
      Alert.alert('Error', 'Please select a photo');
      return;
    }

    setAnalyzingMedication(true);
    try {
      // Convert HEIC images to JPEG if needed
      let imageUri = medicationPhotoUri;
      const needsConversion =
        medicationPhotoMediaType.includes('heic') ||
        medicationPhotoMediaType.includes('heif');

      if (needsConversion) {
        console.log(`🔄 Converting image (type: ${medicationPhotoMediaType}) from ${medicationPhotoUri} to JPEG...`);
        imageUri = await convertHeicToJpeg(medicationPhotoUri);
        console.log(`✓ Conversion complete. New URI: ${imageUri}`);
      } else {
        console.log(`📷 Using image as-is (type: ${medicationPhotoMediaType})`);
      }

      // Convert photo to base64 for analysis
      console.log(`📊 Reading image as base64 from: ${imageUri}`);
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log(`✓ Base64 read successful. Length: ${base64.length} characters`);

      // Analyze the medication bottle using Claude vision
      console.log(`🤖 Sending to Claude API (image/jpeg format)...`);
      const analysis = await claudeService.parseRecordFromImage(base64, 'temp-id', 'image/jpeg');
      console.log(`✓ Claude analysis complete`);

      // Extract medication details from analysis
      let medicationEntry = `Medication from bottle photo`;

      if (analysis.medicationDetails) {
        const { name, dosage, frequency } = analysis.medicationDetails;
        medicationEntry = `${name} ${dosage} - ${frequency}`;
        console.log('Medication details extracted:', { name, dosage, frequency, medicationEntry });
      } else if (analysis.reasonForVisit) {
        medicationEntry = analysis.reasonForVisit;
        console.log('Using reasonForVisit:', medicationEntry);
      }
      console.log('Final medication entry:', medicationEntry);

      // Ask for confirmation before adding
      Alert.alert(
        'Confirm Medication',
        `Add this ${medicationType} medication?\n\n${medicationEntry}`,
        [
          {
            text: 'Cancel',
            onPress: () => {
              setAnalyzingMedication(false);
            },
            style: 'cancel',
          },
          {
            text: 'Confirm',
            onPress: async () => {
              try {
                if (medicationType === 'prescription') {
                  const updatedData = {
                    ...editData,
                    prescriptionMedications: [...(editData.prescriptionMedications || []), medicationEntry]
                  };
                  setEditData(updatedData);
                  await patchUserData({ prescriptionMedications: updatedData.prescriptionMedications });
                } else {
                  const updatedData = {
                    ...editData,
                    otcMedications: [...(editData.otcMedications || []), medicationEntry]
                  };
                  setEditData(updatedData);
                  await patchUserData({ otcMedications: updatedData.otcMedications });
                }

                setMedicationInputMode(null);
                setMedicationType(null);
                setMedicationPhotoUri(null);
                Alert.alert('Success', 'Medication added successfully!');
              } catch (error) {
                Alert.alert('Error', 'Failed to add medication: ' + String(error));
              } finally {
                setAnalyzingMedication(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to analyze medication photo: ' + String(error));
      setAnalyzingMedication(false);
    }
  };

  const handleMedicationTextSubmit = async () => {
    if (!medicationInputText.trim() || !medicationType) {
      Alert.alert('Error', 'Please enter a medication name');
      return;
    }

    try {
      if (medicationType === 'prescription') {
        const updatedData = {
          ...editData,
          prescriptionMedications: [...(editData.prescriptionMedications || []), medicationInputText.trim()]
        };
        setEditData(updatedData);
        await patchUserData({ prescriptionMedications: updatedData.prescriptionMedications });
      } else {
        const updatedData = {
          ...editData,
          otcMedications: [...(editData.otcMedications || []), medicationInputText.trim()]
        };
        setEditData(updatedData);
        await patchUserData({ otcMedications: updatedData.otcMedications });
      }

      setMedicationInputMode(null);
      setMedicationType(null);
      setMedicationInputText('');
      Alert.alert('Success', 'Medication added');
    } catch (error) {
      Alert.alert('Error', 'Failed to add medication');
    }
  };

  const handleDelete = async () => {
    try {
      if (editingSection === 'appointments' && editingAppointmentId) {
        const updatedAppointments = (editData.appointments || []).filter(apt => apt.id !== editingAppointmentId);
        await patchUserData({ appointments: updatedAppointments });
        Alert.alert('Success', 'Appointment deleted');
        setEditingSection(null);
        setEditingAppointmentId(null);
      } else if (editingSection === 'emergency' && editingEmergencyContactId !== null) {
        const updatedContacts = (editData.emergencyContacts || []).filter((_, idx) => idx !== editingEmergencyContactId);
        await patchUserData({ emergencyContacts: updatedContacts });
        Alert.alert('Success', 'Emergency contact deleted');
        setEditingSection(null);
        setEditingEmergencyContactId(null);
      } else if (editingSection === 'insurance' && editingInsuranceId !== null) {
        const updatedInsurances = (editData.insurances || []).filter((_, idx) => idx !== editingInsuranceId);
        await patchUserData({ insurances: updatedInsurances });
        Alert.alert('Success', 'Insurance deleted');
        setEditingSection(null);
        setEditingInsuranceId(null);
      } else if (editingHistoryType && editingIndex !== null) {
        if (editingHistoryType === 'surgical') {
          const updated = (editData.surgicalHistory || []).filter((_, i) => i !== editingIndex);
          await patchUserData({ surgicalHistory: updated });
        } else if (editingHistoryType === 'family') {
          const updated = (editData.familyHistory || []).filter((_, i) => i !== editingIndex);
          await patchUserData({ familyHistory: updated });
        } else if (editingHistoryType === 'conditions') {
          const updated = (editData.pastConditions || []).filter((_, i) => i !== editingIndex);
          await patchUserData({ pastConditions: updated });
        } else if (editingHistoryType === 'hospitalization') {
          const updated = (editData.hospitalizations || []).filter((_, i) => i !== editingIndex);
          await patchUserData({ hospitalizations: updated });
        }
        Alert.alert('Success', 'Entry deleted');
        setEditingHistoryType(null);
        setEditingIndex(null);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to delete');
    }
  };

  const handleDateTimePickerDone = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedDateTime = `${months[selectedMonth]} ${selectedDay}, ${selectedYear} • ${selectedHour}:${String(selectedMinute).padStart(2, '0')} ${selectedPeriod}`;
    setAppointmentDateTime(formattedDateTime);
    setShowDatePicker(false);
    setEditingSection('appointments');
  };

  const handleOpenDatePicker = () => {
    setEditingSection(null);
    setShowDatePicker(true);
  };

  const handleCaptureMedicationPhoto = async () => {
    // Mock implementation - in production, integrate with expo-image-picker
    setAnalyzingPhoto(true);
    setTimeout(() => {
      analyzeMedicationPhoto('mock-base64-data');
    }, 1500);
  };

  const analyzeMedicationPhoto = async (base64: string) => {
    setAnalyzingPhoto(true);
    try {
      // Mock Claude vision analysis - replace with real API call
      const mockMedications = [
        'Metformin 500mg - Take twice daily',
        'Lisinopril 10mg - Take once daily',
      ];

      setEditData({
        ...editData,
        prescriptionMedications: [...(editData.prescriptionMedications || []), ...mockMedications],
      });

      Alert.alert('Success', 'Medication information extracted from photo!');
      setMedicationPhoto(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to analyze photo. Try again.');
    } finally {
      setAnalyzingPhoto(false);
    }
  };

  const handlePhotoSaved = (photoId: string, analysis: string, type: 'medication' | 'document' | 'record') => {
    // Add photo ID to appropriate list
    switch (type) {
      case 'medication':
        setMedicationPhotos([...medicationPhotos, photoId]);
        // Optionally parse and add the medication data
        if (analysis) {
          try {
            const jsonMatch = analysis.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const data = JSON.parse(jsonMatch[0]);
              const medString = `${data.name}${data.dosage ? ' ' + data.dosage : ''}`;
              setEditData({
                ...editData,
                prescriptionMedications: [...(editData.prescriptionMedications || []), medString],
              });
            }
          } catch (e) {
            console.log('Could not parse medication data');
          }
        }
        break;
      case 'document':
        setDocumentPhotos([...documentPhotos, photoId]);
        break;
      case 'record':
        setRecordPhotos([...recordPhotos, photoId]);
        break;
    }
    setCameraModalType(null);
    Alert.alert('Success', 'Photo saved and analyzed successfully!');
  };

  // Values shown on the Health, Care, and Profile rows
  const closeDetail = () => setOpenPage(null);
  // Dose and how often, from the active entry for a medication
  const medicationDetail = (name: string) => {
    const active = (userData.medicationHistory || []).find((m) => m.name === name && !m.endDate);
    return active ? [active.dose, active.frequency, nextDoseLabel(userData, name)].filter(Boolean).join(' · ') : '';
  };
  const medListKey = (kind: 'prescription' | 'otc') => (kind === 'prescription' ? 'prescriptionMedications' : 'otcMedications');
  const addMedEditTime = () => {
    const time = parseTime(medEditTimeText);
    if (!time) {
      Alert.alert('Check the time', 'Enter a time such as 8:00 AM.');
      return;
    }
    setMedEditTimes((current) => (current.includes(time) ? current : [...current, time].sort()));
    setMedEditTimeText('');
  };
  const openMedEdit = (kind: 'prescription' | 'otc', index: number) => {
    const name = ((userData as any)[medListKey(kind)] || [])[index] ?? '';
    const active = (userData.medicationHistory || []).find((m) => m.name === name && !m.endDate);
    setMedEditName(name);
    setMedEditDose(active?.dose || '');
    setMedEditFrequency(active?.frequency || '');
    setMedEditTimes([...(active?.reminderTimes || [])].sort());
    setMedEditTimeText('');
    setEditingMed({ kind, index });
  };
  const saveMedEdit = async () => {
    if (!editingMed) return;
    const newName = medEditName.trim();
    if (!newName) {
      Alert.alert('Add a name', 'Enter the medication name.');
      return;
    }
    const key = medListKey(editingMed.kind);
    const list = [...((userData as any)[key] || [])];
    const oldName = list[editingMed.index];
    list[editingMed.index] = newName;
    const history = [...(userData.medicationHistory || [])];
    const details = {
      dose: medEditDose.trim() || undefined,
      frequency: medEditFrequency.trim() || undefined,
      reminderTimes: medEditTimes.length > 0 ? medEditTimes : undefined,
    };
    const activeIdx = history.findIndex((m) => m.name === oldName && !m.endDate);
    if (activeIdx >= 0) history[activeIdx] = { ...history[activeIdx], name: newName, ...details };
    else if (details.dose || details.frequency || details.reminderTimes) history.push({ name: newName, ...details });
    const patch: any = { medicationHistory: history };
    patch[key] = list;
    await patchUserData(patch);
    setEditingMed(null);
  };
  const markMedStopped = async () => {
    if (!editingMed) return;
    const key = medListKey(editingMed.kind);
    const list = [...((userData as any)[key] || [])];
    const name = list[editingMed.index];
    list.splice(editingMed.index, 1);
    const history = [...(userData.medicationHistory || [])];
    const endDate = new Date().toISOString();
    const activeIdx = history.findIndex((m) => m.name === name && !m.endDate);
    if (activeIdx >= 0) history[activeIdx] = { ...history[activeIdx], endDate };
    else history.push({ name, endDate });
    const patch: any = { medicationHistory: history };
    patch[key] = list;
    await patchUserData(patch);
    setEditingMed(null);
  };
  const deleteMed = () => {
    if (!editingMed) return;
    const key = medListKey(editingMed.kind);
    Alert.alert('Delete medication', 'Remove this medication and its details from your list?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const list = [...((userData as any)[key] || [])];
          const name = list[editingMed.index];
          list.splice(editingMed.index, 1);
          const history = (userData.medicationHistory || []).filter((m) => !(m.name === name && !m.endDate));
          const patch: any = { medicationHistory: history };
          patch[key] = list;
          await patchUserData(patch);
          setEditingMed(null);
        },
      },
    ]);
  };
  // These pages have no Edit toggle, so their edit and remove controls are always shown
  const showHealthControls = true;
  // The medications page has no Edit toggle, so its edit and remove controls are always shown
  const showMedicationControls = true;
  const pastMedications = (userData.medicationHistory || [])
    .filter((m) => !!m.endDate || m.source === 'epic')
    .sort((a, b) => (b.endDate || '').localeCompare(a.endDate || ''));
  const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const isPastCondition = (c: { status?: string }) => !!c.status && !/^active$/i.test(c.status.trim());
  const currentEpicConditions = epicConditions.filter((c) => !isPastCondition(c));
  const pastEpicConditions = epicConditions.filter((c) => isPastCondition(c));
  const onsetText = (value: string) => {
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : shortDate(value);
  };
  const medicationCount =
    new Set([...(userData.prescriptionMedications || []), ...epicMedications.map((m) => m.name)]).size +
    (userData.otcMedications || []).length;
  const allergyNames = [...new Set([...(userData.allergies || []), ...epicAllergies.map((a) => a.allergen)])];
  const allergyValue = allergyNames.length === 1 ? allergyNames[0] : String(allergyNames.length);
  const conditionCount = new Set([...(userData.conditions || []), ...epicConditions.map((c) => c.name)]).size;
  const historyCount =
    (userData.surgicalHistory || []).length +
    (userData.familyHistory || []).length +
    (userData.pastConditions || []).length +
    (userData.hospitalizations || []).length;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const upcoming = [
    ...(userData.appointments || []).map((a) => (a.dateTime || '').split('•')[0].trim()),
    ...epicAppointments.map((a) => a.date),
  ]
    .map((text) => new Date(text))
    .filter((d) => !isNaN(d.getTime()) && d.getTime() >= todayStart.getTime())
    .sort((a, b) => a.getTime() - b.getTime());
  const appointmentValue = upcoming.length
    ? upcoming[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'None scheduled';
  const vaccinesValue = String(getRecommendedVaccines().length) + ' recommended';
  const screeningsValue = String(getRecommendedScreenings().length) + ' recommended';
  const insuranceValue = (userData.insurances || []).length ? String((userData.insurances || []).length) + ' plans' : 'None';
  const pharmacyValue = userData.pharmacy ? 'On file' : 'Not set';
  const emergencyValue = String((userData.emergencyContacts || []).length);

  const openBirthdayEdit = () => {
    setEditData(userData);
    if (userData.birthday) {
      const parts = userData.birthday.split(' ');
      const monthStr = parts[0];
      const dayStr = parseInt(parts[1]);
      const yearStr = parseInt(parts[2]);
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthIdx = months.indexOf(monthStr);
      setSelectedBirthdayMonth(monthIdx >= 0 ? monthIdx : 0);
      setSelectedBirthdayDay(dayStr || 1);
      setSelectedBirthdayYear(yearStr || 1990);
    }
    setEditingSection('birthday');
  };

  const openGenderEdit = () => {
    setEditData(userData);
    const currentGender = userData.gender || 'Other';
    if (['Male', 'Female', 'Other'].includes(currentGender)) {
      setSelectedGender(currentGender);
      setCustomGender('');
    } else {
      setSelectedGender('Other');
      setCustomGender(currentGender);
    }
    setEditingSection('gender');
  };

  const openSimpleEdit = (section: string) => {
    setEditData(userData);
    setEditingSection(section);
  };

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View />
          <Text style={styles.appName}>EasyMedical AI</Text>
        </View>

        {/* Your Health Snapshot Title */}
        <View style={styles.snapshotHeader}>
          <Text style={styles.snapshotTitle}>Home</Text>
        </View>

        {/* Quick log: type or dictate a reading or medication change, then confirm */}
        <QuickLogBox
          userData={userData}
          onSave={async (entries: LogEntry[]) => {
            const updated = applyLogEntries(userData, entries);
            const changed = Object.fromEntries(
              Object.entries(updated).filter(([key, value]) => (userData as any)[key] !== value)
            );
            await patchUserData(changed);
          }}
        />

        {/* VITALS & METRICS Section */}
        <View style={styles.section}>
          <View style={styles.cardTitleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Vitals</Text>
            </View>
          </View>

          <View style={styles.listCard}>
            {/* Birthday */}
            <VitalRow
              icon="gift-outline"
              label="Birthday"
              value={userData.birthday ? `${userData.birthday} (${calculateAge(userData.birthday)})` : '—'}
              onPress={openBirthdayEdit}
            />

            <View style={styles.divider} />

            {/* Gender */}
            <VitalRow
              icon="account-outline"
              label="Gender"
              value={userData.gender || '—'}
              onPress={openGenderEdit}
            />

            <View style={styles.divider} />

            {/* Height */}
            <VitalRow
              icon="human-male-height"
              label="Height"
              value={userData.height?.includes("'") ? userData.height : (userData.height ? `${userData.height.replace(/\s/g, "'")}"` : '0\'0"')}
              onPress={() => openSimpleEdit('height')}
            />

            <View style={styles.divider} />

            {/* Weight */}
            <VitalRow
              icon="scale-bathroom"
              label="Weight"
              value={weightNow ? `${weightNow.value} lbs` : userData.weight?.includes('lbs') ? userData.weight : `${userData.weight} lbs`}
              hint={weightHint || undefined}
              onPress={() => setVitalDetail('weight')}
            />

            <View style={styles.divider} />

            {/* Blood Pressure */}
            <VitalRow
              icon="heart-pulse"
              label="Blood pressure"
              value={bloodPressureNow ? `${bloodPressureNow.systolic}/${bloodPressureNow.diastolic} mmHg` : userData.vitals?.bloodPressure || '—'}
              hint={bpHint || undefined}
              onPress={() => setVitalDetail('bp')}
            />

            <View style={styles.divider} />

            {/* Blood Type */}
            <VitalRow
              icon="water-outline"
              label="Blood type"
              value={userData.bloodType || '—'}
              onPress={() => openSimpleEdit('bloodType')}
            />

            <View style={styles.divider} />

            <WearableVitals />
          </View>
        </View>


        {/* LIFESTYLE: sleep, exercise, food */}
        <LifestyleCard />

        {/* HEALTH: summary rows, each opens its detail page */}
        <View style={styles.section}>
          <View style={styles.cardTitleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Health</Text>
            </View>
          </View>
          <View style={styles.listCard}>
            <VitalRow icon="pill" label="Medications" value={String(medicationCount)} onPress={() => setOpenPage('meds')} />
            <View style={styles.divider} />
            <VitalRow icon="alert-outline" iconColor="#FF9500" label="Allergies" value={allergyValue} onPress={() => setOpenPage('allergies')} />
            <View style={styles.divider} />
            <VitalRow icon="stethoscope" label="Conditions" value={String(conditionCount)} onPress={() => setOpenPage('conditions')} />
            <View style={styles.divider} />
            <VitalRow icon="book-open-page-variant-outline" label="Medical history" value={String(historyCount)} onPress={() => setOpenPage('history')} />
          </View>
        </View>

        {/* CARE */}
        <View style={styles.section}>
          <View style={styles.cardTitleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Care</Text>
            </View>
          </View>
          <View style={styles.listCard}>
            <VitalRow icon="calendar-outline" label="Appointments" value={appointmentValue} onPress={() => setOpenPage('appointments')} />
            <View style={styles.divider} />
            <VitalRow icon="needle" label="Vaccines" value={vaccinesValue} onPress={() => setOpenPage('vaccines')} />
            <View style={styles.divider} />
            <VitalRow icon="clipboard-pulse-outline" label="Screenings" value={screeningsValue} onPress={() => setOpenPage('screenings')} />
          </View>
        </View>

        {/* PROFILE */}
        <View style={styles.section}>
          <View style={styles.cardTitleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Profile</Text>
            </View>
          </View>
          <View style={styles.listCard}>
            <VitalRow icon="card-account-details-outline" label="Insurance" value={insuranceValue} onPress={() => setOpenPage('insurance')} />
            <View style={styles.divider} />
            <VitalRow icon="storefront-outline" label="Pharmacy" value={pharmacyValue} onPress={() => setOpenPage('pharmacy')} />
            <View style={styles.divider} />
            <VitalRow icon="phone-alert-outline" label="Emergency contacts" value={emergencyValue} onPress={() => setOpenPage('emergency')} />
          </View>
        </View>

        <View style={styles.spacing} />
      </ScrollView>

      {/* Detail pages for the Health, Care, and Profile rows */}
      <DetailModal
        visible={openPage === 'meds'}
        title="Medications"
        onClose={closeDetail}
        onDismiss={() => {
          if (pendingMedicationAdd) {
            setMedicationType(pendingMedicationAdd);
            setMedicationInputMode('method');
            setPendingMedicationAdd(null);
          }
          if (pendingMedEdit) {
            openMedEdit(pendingMedEdit.kind, pendingMedEdit.index);
            setPendingMedEdit(null);
          }
        }}
      >
        <View style={styles.medsTabs}>
          <TouchableOpacity style={[styles.medsTab, medsTab === 'list' && styles.medsTabActive]} onPress={() => setMedsTab('list')}>
            <Text style={[styles.medsTabText, medsTab === 'list' && styles.medsTabTextActive]}>List</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.medsTab, medsTab === 'calendar' && styles.medsTabActive]} onPress={() => setMedsTab('calendar')}>
            <Text style={[styles.medsTabText, medsTab === 'calendar' && styles.medsTabTextActive]}>Calendar</Text>
          </TouchableOpacity>
        </View>
        {medsTab === 'list' && (
          <>
        <View style={styles.section}>
          <View style={styles.card}>
            {/* Prescription Medications */}
            <View style={[styles.healthSection, styles.lastHealthSection]}>
              <View style={styles.healthSectionHeader}>
                <Text style={styles.healthSectionTitle}>Current prescription medications</Text>
              </View>
              {(userData.prescriptionMedications && userData.prescriptionMedications.length > 0) || epicMedications.length > 0 ? (
                <>
                  {/* Manual medications */}
                  {userData.prescriptionMedications && userData.prescriptionMedications.map((med, idx) => new Set(epicMedications.map((m) => m.name.trim().toLowerCase())).has(med.trim().toLowerCase()) ? null : (
                    <View key={`manual-${idx}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.medRowName}>{med}</Text>
                        {medicationDetail(med) ? <Text style={styles.medRowDetail}>{medicationDetail(med)}</Text> : null}
                      </View>
                      {showMedicationControls ? (
                        <TouchableOpacity onPress={() => {
                          setPendingMedEdit({ kind: 'prescription', index: idx });
                          setOpenPage(null);
                        }}>
                          <Text style={styles.editLink}>Edit</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ))}
                  {/* Epic medications */}
                  {epicMedications.map((med, index) => {
                    const key = `medication:${med.id}`;
                    const name = epicText(key, String(med.name ?? ''), 'primary');
                    const dosage = epicText(key, String(med.dosage ?? ''), 'secondary');
                    return (
                      <View key={`epic-med-${index}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.medRowName}>{name}</Text>
                          {dosage ? <Text style={styles.medRowDetail}>{dosage}</Text> : null}
                        </View>
                        {showMedicationControls && (
                          <TouchableOpacity onPress={() => openEpicEdit(key, 'medication', name, dosage)}>
                            <Text style={styles.editLink}>Edit</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </>
              ) : (
                <Text style={styles.emptyText}>No prescription medications added</Text>
              )}

              <TouchableOpacity style={styles.addButton} onPress={() => {
                setPendingMedicationAdd('prescription');
                setOpenPage(null);
              }}>
                <Text style={styles.addButtonText}>+ Add prescription</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
        <View style={styles.section}>
          <View style={styles.card}>
            {/* OTC Medications and Supplements */}
            <View style={[styles.healthSection, styles.lastHealthSection]}>
              <View style={styles.healthSectionHeader}>
                <Text style={styles.healthSectionTitle}>Current OTC medications & supplements</Text>
              </View>
              {(userData.otcMedications && userData.otcMedications.length > 0) ? (
                userData.otcMedications.map((med, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.medRowName}>{med}</Text>
                        {medicationDetail(med) ? <Text style={styles.medRowDetail}>{medicationDetail(med)}</Text> : null}
                      </View>
                      {showMedicationControls ? (
                        <TouchableOpacity onPress={() => {
                          setPendingMedEdit({ kind: 'otc', index: idx });
                          setOpenPage(null);
                        }}>
                          <Text style={styles.editLink}>Edit</Text>
                        </TouchableOpacity>
                      ) : null}
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No OTC medications added</Text>
              )}

              <TouchableOpacity style={styles.addButton} onPress={() => {
                setPendingMedicationAdd('otc');
                setOpenPage(null);
              }}>
                <Text style={styles.addButtonText}>+ Add supplement or OTC medication</Text>
              </TouchableOpacity>
            </View>


          </View>
        </View>
        <View style={styles.section}>
          <View style={styles.card}>
            {/* Past medications */}
            <View style={[styles.healthSection, styles.lastHealthSection]}>
              <View style={styles.healthSectionHeader}>
                <Text style={styles.healthSectionTitle}>Past medications</Text>
              </View>
              {pastMedications.length > 0 ? (
                pastMedications.map((med, idx) => (
                  <View key={`past-${idx}`} style={{ marginVertical: 4 }}>
                    <Text style={styles.healthItem}>{[med.name, med.dose].filter(Boolean).join(' · ')}</Text>
                    <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                      {[med.startDate && `Started ${shortDate(med.startDate)}`, med.endDate && `Stopped ${shortDate(med.endDate)}`, !med.endDate && med.source === 'epic' && 'From Epic'].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No past medications</Text>
              )}
            </View>
          </View>
        </View>
          </>
        )}
        {medsTab === 'calendar' && (
          <View style={styles.section}>
            <View style={styles.card}>
              <MedicationCalendar userData={userData} onChangeDoseLog={(log) => patchUserData({ doseLog: log })} />
            </View>
          </View>
        )}
      </DetailModal>

      <DetailModal visible={openPage === 'conditions'} title="Conditions" onClose={closeDetail}>
        <View style={styles.section}>
          <View style={styles.card}>
            {/* Conditions */}
            <View style={styles.healthSection}>
              <View style={styles.healthSectionHeader}>
                <Text style={styles.healthSectionTitle}>Conditions</Text>
              </View>
              {(userData.conditions && userData.conditions.length > 0) || epicConditions.length > 0 ? (
                <>
                {userData.conditions.map((condition, idx) => new Set(epicConditions.map((c) => c.name.trim().toLowerCase())).has(condition.trim().toLowerCase()) ? null : (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 }}>
                    {editingConditionIdx === idx ? (
                      <TextInput
                        style={[styles.input, { flex: 1, height: 36 }]}
                        value={editingConditionValue}
                        onChangeText={setEditingConditionValue}
                      />
                    ) : (
                      <Text style={[styles.healthItem, { flex: 1 }]}>• {condition}</Text>
                    )}
                    {editingConditionIdx === idx ? (
                      <>
                        <TouchableOpacity
                          onPress={async () => {
                            const updated = [...(userData.conditions || [])];
                            updated[idx] = editingConditionValue;
                            const updatedData = { ...editData, conditions: updated };
                            setEditData(updatedData);
                            await patchUserData({ conditions: updatedData.conditions });
                            setEditingConditionIdx(null);
                          }}
                        >
                          <Text style={styles.editLink}>✓</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setEditingConditionIdx(null)}>
                          <Text style={styles.editLink}>✕</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={async () => {
                            const updated = (userData.conditions || []).filter((_, i) => i !== idx);
                            const updatedData = { ...editData, conditions: updated };
                            setEditData(updatedData);
                            await patchUserData({ conditions: updatedData.conditions });
                            setEditingConditionIdx(null);
                          }}
                        >
                          <Text style={[styles.editLink, { color: '#FF3B30' }]}>🗑️</Text>
                        </TouchableOpacity>
                      </>
                    ) : showHealthControls ? (
                      <TouchableOpacity onPress={() => {
                        setEditingConditionIdx(idx);
                        setEditingConditionValue(condition);
                      }}>
                        <Text style={styles.editLink}>Edit</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
                {currentEpicConditions.map((cond, index) => {
                  const key = `condition:${cond.id}`;
                  const name = epicText(key, cond.name, 'primary');
                  const detail = epicText(key, cond.status ? `Status: ${cond.status}` : '', 'secondary');
                  return (
                    <View key={`epic-cond-${index}`} style={{ marginVertical: 4 }}>
                      <Text style={styles.healthItem}>• <Text style={{ fontWeight: '600' }}>{name}</Text></Text>
                      {detail ? (
                        <Text style={[styles.healthItem, { fontSize: 12, marginLeft: 12, opacity: 0.7 }]}>{detail}</Text>
                      ) : null}
{showHealthControls && (
                      <TouchableOpacity onPress={() => openEpicEdit(key, 'condition', name, detail)}>
                        <Text style={styles.epicEditLink}>Edit</Text>
                      </TouchableOpacity>
                        )}
                    </View>
                  );
                })}
                </>
              ) : (
                <Text style={styles.emptyText}>No conditions added</Text>
              )}
              <TouchableOpacity style={styles.addButton} onPress={() => setAddingCondition(!addingCondition)}>
                <Text style={styles.addButtonText}>+ Add condition</Text>
              </TouchableOpacity>
              {addingCondition && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
                  <TextInput
                    style={[styles.input, { flex: 1, height: 40 }]}
                    placeholder="Enter condition"
                    placeholderTextColor="#999"
                    value={newCondition}
                    onChangeText={setNewCondition}
                  />
                  <TouchableOpacity
                    style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#007AFF', borderRadius: 6 }}
                    onPress={async () => {
                      if (newCondition.trim()) {
                        const updatedData = {
                          ...editData,
                          conditions: [...(editData.conditions || []), newCondition.trim()]
                        };
                        setEditData(updatedData);
                        await patchUserData({ conditions: updatedData.conditions });
                        setNewCondition('');
                        setAddingCondition(false);
                      }
                    }}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '600' }}>Add</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

          </View>
        </View>
        <View style={styles.section}>
          <View style={styles.card}>
            <View style={[styles.healthSection, styles.lastHealthSection]}>
              <View style={styles.healthSectionHeader}>
                <Text style={styles.healthSectionTitle}>Past conditions</Text>
              </View>
              {pastEpicConditions.length > 0 ? (
                pastEpicConditions.map((cond) => (
                  <View key={`past-condition-${cond.id}`} style={{ marginVertical: 4 }}>
                    <Text style={styles.medRowName}>{cond.name}</Text>
                    <Text style={styles.medRowDetail}>
                      {[cond.status && `Status: ${cond.status}`, cond.onsetDate && `Started ${onsetText(cond.onsetDate)}`].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No past conditions</Text>
              )}
            </View>
          </View>
        </View>
      </DetailModal>

      <DetailModal visible={openPage === 'allergies'} title="Allergies" onClose={closeDetail}>
        <View style={styles.section}>
          <View style={styles.card}>
            {/* Allergies */}
            <View style={styles.healthSection}>
              <View style={styles.healthSectionHeader}>
                <Text style={styles.healthSectionTitle}>Allergies</Text>
              </View>
              {(userData.allergies && userData.allergies.length > 0) || epicAllergies.length > 0 ? (
                <>
                  {/* Manual allergies */}
                  {userData.allergies && userData.allergies.map((allergy, idx) => new Set(epicAllergies.map((a) => a.allergen.trim().toLowerCase())).has(allergy.trim().toLowerCase()) ? null : (
                    <View key={`manual-${idx}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 }}>
                      {editingAllergyIdx === idx ? (
                        <TextInput
                          style={[styles.input, { flex: 1, height: 36 }]}
                          value={editingAllergyValue}
                          onChangeText={setEditingAllergyValue}
                        />
                      ) : (
                        <Text style={[styles.healthItem, { flex: 1 }]}>• {allergy}</Text>
                      )}
                      {editingAllergyIdx === idx ? (
                        <>
                          <TouchableOpacity
                            onPress={async () => {
                              const updated = [...(userData.allergies || [])];
                              updated[idx] = editingAllergyValue;
                              const updatedData = { ...editData, allergies: updated };
                              setEditData(updatedData);
                              await patchUserData({ allergies: updatedData.allergies });
                              setEditingAllergyIdx(null);
                            }}
                          >
                            <Text style={styles.editLink}>✓</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setEditingAllergyIdx(null)}>
                            <Text style={styles.editLink}>✕</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={async () => {
                              const updated = (userData.allergies || []).filter((_, i) => i !== idx);
                              const updatedData = { ...editData, allergies: updated };
                              setEditData(updatedData);
                              await patchUserData({ allergies: updatedData.allergies });
                              setEditingAllergyIdx(null);
                            }}
                          >
                            <Text style={[styles.editLink, { color: '#FF3B30' }]}>🗑️</Text>
                          </TouchableOpacity>
                        </>
                      ) : showHealthControls ? (
                        <TouchableOpacity onPress={() => {
                          setEditingAllergyIdx(idx);
                          setEditingAllergyValue(allergy);
                        }}>
                          <Text style={styles.editLink}>Edit</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ))}
                  {/* Epic allergies */}
                  {epicAllergies.map((allergy) => {
                    const key = `allergy:${allergy.id}`;
                    const allergen = epicText(key, allergy.allergen, 'primary');
                    const reaction = epicText(key, allergy.reaction, 'secondary');
                    return (
                      <View key={allergy.id} style={{ marginVertical: 4 }}>
                        <Text style={styles.healthItem}>• <Text style={{ fontWeight: '600' }}>{allergen}</Text></Text>
                        <Text style={[styles.healthItem, { fontSize: 12, marginLeft: 12, opacity: 0.7 }]}>
                          Reaction: {reaction}
                        </Text>
{showHealthControls && (
                        <TouchableOpacity onPress={() => openEpicEdit(key, 'allergy', allergen, reaction)}>
                          <Text style={styles.epicEditLink}>Edit</Text>
                        </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </>
              ) : (
                <Text style={styles.emptyText}>No allergies added</Text>
              )}
              <TouchableOpacity style={styles.addButton} onPress={() => setAddingAllergy(!addingAllergy)}>
                <Text style={styles.addButtonText}>+ Add allergy</Text>
              </TouchableOpacity>
              {addingAllergy && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
                  <TextInput
                    style={[styles.input, { flex: 1, height: 40 }]}
                    placeholder="Enter allergy"
                    placeholderTextColor="#999"
                    value={newAllergy}
                    onChangeText={setNewAllergy}
                  />
                  <TouchableOpacity
                    style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#007AFF', borderRadius: 6 }}
                    onPress={async () => {
                      if (newAllergy.trim()) {
                        const updatedData = {
                          ...editData,
                          allergies: [...(editData.allergies || []), newAllergy.trim()]
                        };
                        setEditData(updatedData);
                        await patchUserData({ allergies: updatedData.allergies });
                        setNewAllergy('');
                        setAddingAllergy(false);
                      }
                    }}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '600' }}>Add</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>


          </View>
        </View>
      </DetailModal>

      <DetailModal visible={openPage === 'history'} onClose={closeDetail}>
        {/* HEALTH HISTORY Section */}
        <View style={styles.section}>
          <View style={styles.cardTitleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Health History</Text>
            </View>
          </View>

          <View style={styles.card}>
            {/* Surgical History */}
            <View style={styles.historyCategory}>
              <View style={styles.historyCategoryHeader}>
                <Text style={styles.historyCategoryTitle}>Surgical History</Text>
              </View>
              {userData.surgicalHistory && userData.surgicalHistory.length > 0 ? (
                userData.surgicalHistory.map((surgery, idx) => (
                  <View key={idx} style={styles.historyEntry}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryTitle}>{surgery.surgeryName}</Text>
                      <Text style={styles.entryMeta}>{surgery.date}</Text>
                    </View>
                    {showHealthControls && (
                      <TouchableOpacity onPress={() => {
                        setEditData(userData);
                        setEditingHistoryType('surgical');
                        setEditingIndex(idx);
                        setSurgeryDate(surgery.date);
                        setSurgeryName(surgery.surgeryName);
                      }}>
                        <Text style={styles.editLink}>Edit</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No surgical history added</Text>
              )}
              <TouchableOpacity style={styles.addButton} onPress={() => {
                setEditData(userData);
                setEditingHistoryType('surgical');
                setEditingIndex(null);
                setSurgeryDate('');
                setSurgeryName('');
              }}>
                <Text style={styles.addButtonText}>+ Add surgery</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* Family History */}
            <View style={styles.historyCategory}>
              <View style={styles.historyCategoryHeader}>
                <Text style={styles.historyCategoryTitle}>Family History</Text>
              </View>
              {userData.familyHistory && userData.familyHistory.length > 0 ? (
                Object.entries(
                  userData.familyHistory.reduce((acc, family, idx) => {
                    if (!acc[family.familyMember]) {
                      acc[family.familyMember] = [];
                    }
                    acc[family.familyMember].push({ ...family, idx });
                    return acc;
                  }, {})
                ).map(([member, conditions]) => (
                  <View key={member} style={styles.historyEntry}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryTitle}>{member}</Text>
                      {conditions.map((item, condIdx) => (
                        <View key={item.idx} style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={styles.entryMeta}>{condIdx + 1}. {item.condition}</Text>
                          {showHealthControls && (
                            <TouchableOpacity onPress={() => {
                              setEditData(userData);
                              setEditingHistoryType('family');
                              setEditingIndex(item.idx);
                              setFamilyMember(item.familyMember);
                              setFamilyCondition(item.condition);
                            }}>
                              <Text style={styles.editLink}>Edit</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No family history added</Text>
              )}
              <TouchableOpacity style={styles.addButton} onPress={() => {
                setEditData(userData);
                setEditingHistoryType('family');
                setEditingIndex(null);
                setFamilyMember('');
                setFamilyCondition('');
              }}>
                <Text style={styles.addButtonText}>+ Add family history</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* Past Conditions */}
            <View style={styles.historyCategory}>
              <View style={styles.historyCategoryHeader}>
                <Text style={styles.historyCategoryTitle}>Past Conditions</Text>
              </View>
              {userData.pastConditions && userData.pastConditions.length > 0 ? (
                userData.pastConditions.map((condition, idx) => (
                  <View key={idx} style={styles.historyEntry}>
                    <Text style={styles.entryTitle}>{condition}</Text>
                    {showHealthControls && (
                      <TouchableOpacity onPress={() => {
                        setEditData(userData);
                        setEditingHistoryType('conditions');
                        setEditingIndex(idx);
                        setConditionName(condition);
                      }}>
                        <Text style={styles.editLink}>Edit</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No past conditions added</Text>
              )}
              <TouchableOpacity style={styles.addButton} onPress={() => {
                setEditData(userData);
                setEditingHistoryType('conditions');
                setEditingIndex(null);
                setConditionName('');
              }}>
                <Text style={styles.addButtonText}>+ Add past condition</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* Hospitalizations */}
            <View style={styles.historyCategory}>
              <View style={styles.historyCategoryHeader}>
                <Text style={styles.historyCategoryTitle}>Hospitalizations</Text>
              </View>
              {userData.hospitalizations && userData.hospitalizations.length > 0 ? (
                userData.hospitalizations.map((hospitalization, idx) => (
                  <View key={idx} style={styles.historyEntry}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryTitle}>{hospitalization.reason}</Text>
                      <Text style={styles.entryMeta}>{hospitalization.date}</Text>
                    </View>
                    {showHealthControls && (
                      <TouchableOpacity onPress={() => {
                        setEditData(userData);
                        setEditingHistoryType('hospitalization');
                        setEditingIndex(idx);
                        setHospitalizationDate(hospitalization.date);
                        setHospitalizationReason(hospitalization.reason);
                      }}>
                        <Text style={styles.editLink}>Edit</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No hospitalizations added</Text>
              )}
              <TouchableOpacity style={styles.addButton} onPress={() => {
                setEditData(userData);
                setEditingHistoryType('hospitalization');
                setEditingIndex(null);
                setHospitalizationDate('');
                setHospitalizationReason('');
              }}>
                <Text style={styles.addButtonText}>+ Add hospitalization</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

      </DetailModal>

      <DetailModal visible={openPage === 'appointments'} onClose={closeDetail}>
        <View style={styles.section}>
          {/* Appointments */}
          <View style={styles.cardWrapper}>
            <View style={styles.cardTitleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Upcoming Appointments</Text>
                <Text style={styles.cardMeta}>{(userData.appointments?.length || 0) + epicAppointments.length} total</Text>
              </View>
              {epicAppointments.length > 0 && (
                <TouchableOpacity onPress={loadEpicData}>
                  <Text style={styles.editLink}>Sync</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.card}>
              {(userData.appointments && userData.appointments.length > 0) || epicAppointments.length > 0 ? (
                <>
                  {/* Manual appointments */}
                  {userData.appointments && [...userData.appointments]
                    .sort((a, b) => parseAppointmentDate(a.dateTime).getTime() - parseAppointmentDate(b.dateTime).getTime())
                    .map((apt, idx) => (
                      <View key={apt.id}>
                        <View style={styles.appointmentItemRow}>
                          <View style={styles.appointmentItem}>
                            <Text style={styles.appointmentDate}>{apt.dateTime}</Text>
                            <Text style={styles.appointmentDoctor}>{apt.doctorName}</Text>
                            <Text style={styles.appointmentSpecialty}>{apt.specialty}</Text>
                          </View>
                          <TouchableOpacity onPress={() => {
                            setEditData(userData);
                            setEditingSection('appointments');
                            setEditingAppointmentId(apt.id);
                            setAppointmentDateTime(apt.dateTime);
                            setAppointmentDoctorName(apt.doctorName);
                            setAppointmentSpecialty(apt.specialty);
                          }}>
                            <Text style={styles.editLink}>Edit</Text>
                          </TouchableOpacity>
                        </View>
                        {idx < (userData.appointments?.length || 0) - 1 && <View style={styles.divider} />}
                      </View>
                    ))}
                  {/* Epic appointments */}
                  {epicAppointments.map((apt, idx) => {
                    const key = `appointment:${apt.id}`;
                    const description = epicText(key, apt.description, 'primary');
                    const doctor = epicText(key, apt.provider, 'secondary');
                    return (
                      <View key={apt.id}>
                        <View style={styles.appointmentItemRow}>
                          <View style={styles.appointmentItem}>
                            <Text style={styles.appointmentDate}>{apt.date} at {apt.time}</Text>
                            <Text style={styles.appointmentDoctor}>{doctor}</Text>
                            <Text style={styles.appointmentSpecialty}>{description}</Text>
                            <TouchableOpacity onPress={() => openEpicEdit(key, 'appointment', description, doctor)}>
                              <Text style={styles.epicEditLink}>Edit</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        {idx < epicAppointments.length - 1 && <View style={styles.divider} />}
                      </View>
                    );
                  })}
                </>
              ) : (
                <Text style={styles.emptyText}>No upcoming appointments</Text>
              )}
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  setEditData(userData);
                  setAppointmentDateTime('');
                  setAppointmentDoctorName('');
                  setAppointmentSpecialty('');
                  setEditingAppointmentId(null);
                  setSelectedMonth(7);
                  setSelectedDay(15);
                  setSelectedYear(new Date().getFullYear());
                  setSelectedHour(2);
                  setSelectedMinute(0);
                  setSelectedPeriod('PM');
                  setEditingSection('appointments');
                }}
              >
                <Text style={styles.addButtonText}>+ Add Appointment</Text>
              </TouchableOpacity>
            </View>
          </View>


        </View>
      </DetailModal>

      <DetailModal visible={openPage === 'screenings'} onClose={closeDetail}>
        {/* SCREENINGS Card */}
        <View style={styles.section}>
          <View style={styles.cardWrapper}>
            <View style={styles.cardTitleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Health Screenings</Text>
              </View>
            </View>
            <View style={styles.card}>
            {/* Screening Completed Section */}
            <View style={styles.screeningSection}>
              <View style={styles.screeningSectionHeader}>
                <Text style={styles.screeningSectionTitle}>Screening Completed</Text>
                <TouchableOpacity onPress={() => {
                  setEditData(userData);
                  setEditingSection('screenings');
                  setEditingScreeningId(null);
                  setScreeningType('');
                  setScreeningDate('');
                  setScreeningNotes('');
                }}>
                  <Text style={styles.addButtonSmall}>+ Add</Text>
                </TouchableOpacity>
              </View>

              {userData.screenings && userData.screenings.length > 0 ? (
                <View>
                  {userData.screenings.map((screening, idx) => (
                    <View key={idx}>
                      <TouchableOpacity
                        style={styles.completedScreeningItem}
                        onPress={() => {
                          setEditData(userData);
                          setEditingSection('screenings');
                          setEditingScreeningId(idx);
                          setScreeningType(screening.type);
                          setScreeningDate(screening.date);
                          setScreeningNotes(screening.notes || '');
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.completedScreeningType}>{screening.type}</Text>
                          <Text style={styles.completedScreeningDate}>{screening.date}</Text>
                          {screening.notes && <Text style={styles.completedScreeningNotes}>{screening.notes}</Text>}
                        </View>
                        <Text style={styles.editLink}>Edit</Text>
                      </TouchableOpacity>
                      {idx < userData.screenings.length - 1 && <View style={styles.divider} />}
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyScreeningText}>No screenings added yet</Text>
              )}
            </View>

            <View style={styles.sectionDivider} />

            {/* Recommended Screenings Section */}
            <View style={styles.screeningSection}>
              <Text style={styles.screeningSectionTitle}>Recommended Screenings (USPSTF)</Text>
              <Text style={styles.recommendedSubtitle}>Age-appropriate screenings based on your profile</Text>
              <View style={styles.recommendedList}>
                {getRecommendedScreenings().map((screening, idx) => {
                  const isCompleted = userData.screenings?.some(s =>
                    s.type.toLowerCase().includes(screening.toLowerCase().split('(')[0].trim().toLowerCase())
                  );
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.recommendedItem, isCompleted && styles.completedItem]}
                      onPress={() => {
                        if (!isCompleted) {
                          setEditData(userData);
                          setEditingSection('screenings');
                          setEditingScreeningId(null);
                          setScreeningType(screening);
                          setScreeningDate('');
                          setScreeningNotes('');
                        }
                      }}
                    >
                      <Text style={styles.recommendedCheckbox}>{isCompleted ? '✓' : '○'}</Text>
                      <Text style={[styles.recommendedText, isCompleted && styles.completedText]}>
                        {screening}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </View>
        </View>

      </DetailModal>

      <DetailModal visible={openPage === 'vaccines'} onClose={closeDetail}>
        {/* VACCINES Card */}
        <View style={styles.section}>
          <View style={styles.cardWrapper}>
            <View style={styles.cardTitleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Vaccines</Text>
              </View>
            </View>
            <View style={styles.card}>
            {/* Vaccines Completed Section */}
            <View style={styles.screeningSection}>
              <View style={styles.screeningSectionHeader}>
                <Text style={styles.screeningSectionTitle}>Vaccines Completed</Text>
                <TouchableOpacity onPress={() => {
                  setEditData(userData);
                  setEditingSection('vaccines');
                  setEditingScreeningId(null);
                  setScreeningType('');
                  setScreeningDate('');
                  setScreeningNotes('');
                }}>
                  <Text style={styles.addButtonSmall}>+ Add</Text>
                </TouchableOpacity>
              </View>

              {userData.vaccines && userData.vaccines.length > 0 ? (
                <View>
                  {userData.vaccines.map((vaccine, idx) => (
                    <View key={idx}>
                      <View style={styles.completedScreeningItem}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.completedScreeningType}>{vaccine.name}</Text>
                          <Text style={styles.completedScreeningDate}>{vaccine.date}</Text>
                          {vaccine.nextDue && <Text style={styles.completedScreeningNotes}>Next due: {vaccine.nextDue}</Text>}
                        </View>
                      </View>
                      {idx < userData.vaccines.length - 1 && <View style={styles.divider} />}
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyScreeningText}>No vaccines recorded</Text>
              )}
            </View>

            <View style={styles.sectionDivider} />

            {/* Recommended Vaccines Section */}
            <View style={styles.screeningSection}>
              <Text style={styles.screeningSectionTitle}>Recommended Vaccines</Text>
              <Text style={styles.recommendedSubtitle}>Age-appropriate vaccines for your profile</Text>
              <View style={styles.recommendedList}>
                {getRecommendedVaccines().map((vaccine, idx) => {
                  const isCompleted = userData.vaccines?.some(v =>
                    v.name.toLowerCase().includes(vaccine.toLowerCase().split('(')[0].split('-')[0].trim().toLowerCase())
                  );
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.recommendedItem, isCompleted && styles.completedItem]}
                      onPress={() => {
                        if (!isCompleted) {
                          setSelectedRecommendedVaccine(vaccine);
                          setNewVaccineName(vaccine.split('(')[0].trim());
                          setNewVaccineDate(new Date().toISOString().split('T')[0]);
                          setNewVaccineNextDue('');
                          setShowVaccineModal(true);
                        }
                      }}
                    >
                      <Text style={styles.recommendedCheckbox}>{isCompleted ? '✓' : '○'}</Text>
                      <Text style={[styles.recommendedText, isCompleted && styles.completedText]}>
                        {vaccine}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </View>
        </View>

      </DetailModal>

      <DetailModal visible={openPage === 'insurance'} onClose={closeDetail}>
        <View style={styles.section}>
          {/* Insurance */}
          <View style={styles.cardWrapper}>
            <View style={styles.cardTitleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Insurance</Text>
                <Text style={styles.cardMeta}>{userData.insurances?.length || 0} plans</Text>
              </View>
            </View>
            <View style={styles.card}>
              {userData.insurances && userData.insurances.length > 0 ? (
                userData.insurances.map((insurance, idx) => (
                  <View key={idx}>
                    <View style={styles.infoRowWithEdit}>
                      <View style={styles.infoColumn}>
                        <Text style={styles.infoLabel}>Provider</Text>
                        <Text style={styles.infoValue}>{insurance.provider}</Text>
                      </View>
                      <TouchableOpacity onPress={() => {
                        setEditData(userData);
                        setEditingSection('insurance');
                        setEditingInsuranceId(idx);
                        setInsuranceProvider(insurance.provider);
                        setInsuranceMemberId(insurance.memberId || '');
                        setInsuranceGroupNumber(insurance.groupNumber || '');
                      }}>
                        <Text style={styles.editLink}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Member ID</Text>
                      <Text style={styles.infoValueMono}>{insurance.memberId || '—'}</Text>
                    </View>
                    {insurance.groupNumber && (
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Group Number</Text>
                        <Text style={styles.infoValueMono}>{insurance.groupNumber}</Text>
                      </View>
                    )}
                    {idx < userData.insurances.length - 1 && <View style={styles.divider} />}
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No insurance information added</Text>
              )}
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  setEditData(userData);
                  setEditingSection('insurance');
                  setEditingInsuranceId(null);
                  setInsuranceProvider('');
                  setInsuranceMemberId('');
                  setInsuranceGroupNumber('');
                }}
              >
                <Text style={styles.addButtonText}>+ Add Insurance</Text>
              </TouchableOpacity>
            </View>
          </View>

        </View>
      </DetailModal>

      <DetailModal visible={openPage === 'pharmacy'} onClose={closeDetail}>
        <View style={styles.section}>
          {/* Pharmacy */}
          <View style={styles.cardWrapper}>
            <View style={styles.cardTitleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Pharmacy</Text>
              </View>
            </View>
            <View style={styles.card}>
              {userData.pharmacy ? (
                <>
                  <View style={styles.infoRowWithEdit}>
                    <View style={styles.infoColumn}>
                      <Text style={styles.infoLabel}>Name</Text>
                      <Text style={styles.infoValue}>{userData.pharmacy.name}</Text>
                    </View>
                    <TouchableOpacity onPress={() => {
                      setEditData(userData);
                      setEditingSection('pharmacy');
                      setPharmacyName(userData.pharmacy?.name || '');
                      setPharmacyAddress(userData.pharmacy?.address || '');
                      setPharmacyPhone(userData.pharmacy?.phone || '');
                    }}>
                      <Text style={styles.editLink}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                  {userData.pharmacy.address && (
                    <>
                      <View style={styles.divider} />
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Address</Text>
                        <Text style={styles.infoValue}>{userData.pharmacy.address}</Text>
                      </View>
                    </>
                  )}
                  {userData.pharmacy.phone && (
                    <>
                      <View style={styles.divider} />
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Phone</Text>
                        <Text style={styles.infoValueMono}>{userData.pharmacy.phone}</Text>
                      </View>
                    </>
                  )}
                </>
              ) : (
                <>
                  <View style={styles.infoRowWithEdit}>
                    <View style={styles.infoColumn}>
                      <Text style={styles.infoLabel}>Name</Text>
                      <Text style={styles.infoValue}>—</Text>
                    </View>
                    <TouchableOpacity onPress={() => {
                      setEditData(userData);
                      setEditingSection('pharmacy');
                      setPharmacyName('');
                      setPharmacyAddress('');
                      setPharmacyPhone('');
                    }}>
                      <Text style={styles.editLink}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  setEditData(userData);
                  setEditingSection('pharmacy');
                  setPharmacyName(userData.pharmacy?.name || '');
                  setPharmacyAddress(userData.pharmacy?.address || '');
                  setPharmacyPhone(userData.pharmacy?.phone || '');
                }}
              >
                <Text style={styles.addButtonText}>{userData.pharmacy ? '+ Edit Pharmacy' : '+ Add Pharmacy'}</Text>
              </TouchableOpacity>
            </View>
          </View>

        </View>
      </DetailModal>

      <DetailModal visible={openPage === 'emergency'} onClose={closeDetail}>
        <View style={styles.section}>
          {/* Emergency Contacts */}
          <View style={styles.cardWrapper}>
            <View style={styles.cardTitleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Emergency Contacts</Text>
                <Text style={styles.cardMeta}>{userData.emergencyContacts?.length || 0} contacts</Text>
              </View>
            </View>
            <View style={styles.card}>
              {userData.emergencyContacts && userData.emergencyContacts.length > 0 ? (
                userData.emergencyContacts.map((contact, idx) => (
                  <View key={idx}>
                    <View style={styles.contactRowWithEdit}>
                      <View>
                        <Text style={styles.contactName}>{contact.name}</Text>
                        <Text style={styles.contactRelationship}>{contact.relationship}</Text>
                        <Text style={styles.contactPhoneNumber}>{contact.phone}</Text>
                      </View>
                      <TouchableOpacity onPress={() => {
                        setEditData(userData);
                        setEditingSection('emergency');
                        setEditingEmergencyContactId(idx);
                        setEmergencyContactName(contact.name);
                        setEmergencyContactRelationship(contact.relationship);
                        setEmergencyContactPhone(contact.phone);
                      }}>
                        <Text style={styles.editLink}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                    {idx < userData.emergencyContacts.length - 1 && <View style={styles.divider} />}
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No emergency contacts added</Text>
              )}
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  setEditData(userData);
                  setEditingSection('emergency');
                  setEditingEmergencyContactId(null);
                  setEmergencyContactName('');
                  setEmergencyContactRelationship('');
                  setEmergencyContactPhone('');
                }}
              >
                <Text style={styles.addButtonText}>+ Add Contact</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </DetailModal>

      {/* Edit one medication */}
      <DetailPage visible={editingMed !== null} title="Edit medication" onClose={() => setEditingMed(null)}>
        <Section title="Details">
          <ListCard>
            <View style={styles.medField}>
              <Text style={styles.medFieldLabel}>Name</Text>
              <TextInput style={styles.medFieldInput} value={medEditName} onChangeText={setMedEditName} placeholder="Medication name" placeholderTextColor="#999" />
            </View>
            <Divider />
            <View style={styles.medField}>
              <Text style={styles.medFieldLabel}>Dose</Text>
              <TextInput style={styles.medFieldInput} value={medEditDose} onChangeText={setMedEditDose} placeholder="e.g. 50 mg" placeholderTextColor="#999" />
            </View>
            <Divider />
            <View style={styles.medField}>
              <Text style={styles.medFieldLabel}>How often</Text>
              <TextInput style={styles.medFieldInput} value={medEditFrequency} onChangeText={setMedEditFrequency} placeholder="e.g. twice a day" placeholderTextColor="#999" />
            </View>
          </ListCard>
        </Section>

        <Section title="Reminder times">
          <ListCard>
            <View style={styles.medTimes}>
              {medEditTimes.length === 0 && <Text style={styles.medTimesEmpty}>No reminders yet.</Text>}
              {medEditTimes.map((time) => (
                <TouchableOpacity
                  key={time}
                  style={styles.timeChip}
                  onPress={() => setMedEditTimes((current) => current.filter((t) => t !== time))}
                >
                  <Text style={styles.timeChipText}>{formatTime(time)}  ×</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Divider />
            <View style={styles.timeAddRow}>
              <TextInput
                style={styles.timeInput}
                value={medEditTimeText}
                onChangeText={setMedEditTimeText}
                placeholder="e.g. 8:00 AM"
                placeholderTextColor="#999"
              />
              <TouchableOpacity style={styles.timeAddButton} onPress={addMedEditTime}>
                <Text style={styles.timeAddText}>Add</Text>
              </TouchableOpacity>
            </View>
          </ListCard>
        </Section>

        <View style={styles.medSaveWrap}>
          <TouchableOpacity style={styles.medSaveButton} onPress={saveMedEdit}>
            <Text style={styles.medSaveText}>Save changes</Text>
          </TouchableOpacity>
        </View>

        <Section title="Other actions">
          <ListCard>
            <ListRow icon="pause-circle-outline" label="Stopped taking" hint="Moves it to past medications" onPress={markMedStopped} />
            <Divider />
            <ListRow icon="trash-can-outline" label="Delete medication" danger onPress={deleteMed} />
          </ListCard>
        </Section>
      </DetailPage>

      {/* EDIT MODALS */}
      {/* Blood Type Modal */}
      {/* Birthday Modal */}
      {/* Weight and blood pressure history */}
      <Modal visible={vitalDetail !== null} animationType="slide" onRequestClose={() => setVitalDetail(null)}>
        <View style={styles.modalContainer}>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 60, paddingHorizontal: 20 }}>
            <TouchableOpacity onPress={() => setVitalDetail(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ fontSize: 26, color: '#007AFF', fontWeight: '600' }}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingTop: 16, paddingHorizontal: 20, paddingBottom: 60 }}>
          {vitalDetail === 'weight' && (
            <>
              <Text style={styles.epicEditTitle}>Weight</Text>
              <Text style={styles.detailCurrent}>
                {weightSorted.length > 0 ? `${weightSorted[weightSorted.length - 1].value} lbs` : (userData.weight || 'No weight yet')}
              </Text>
              {weightHint ? <Text style={styles.vitalHint}>{weightHint}</Text> : null}

              {weightSorted.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <LabTrendChart history={weightSorted.map((w) => ({ value: String(w.value), date: w.date }))} />
                </View>
              )}

              <Text style={styles.epicEditLabel}>All readings</Text>
              {weightList.length === 0 && <Text style={styles.emptyText}>No readings saved yet.</Text>}
              {weightList.map((r) => (
                <View key={`w-${r.index}`} style={styles.readingRow}>
                  <View>
                    <Text style={styles.readingValue}>{r.value} lbs</Text>
                    <Text style={styles.readingDate}>{formatReadingDate(r.date)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => deleteWeightReading(r.index)}>
                    <Text style={styles.epicEditLink}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                style={styles.epicEditSave}
                onPress={() => {
                  setVitalDetail(null);
                  setNewWeight('');
                  setAddingReading('weight');
                }}
              >
                <Text style={styles.epicEditSaveText}>+ Add weight</Text>
              </TouchableOpacity>
            </>
          )}

          {vitalDetail === 'bp' && (
            <>
              <Text style={styles.epicEditTitle}>Blood pressure</Text>
              <Text style={styles.detailCurrent}>{userData.vitals?.bloodPressure || 'No reading yet'}</Text>
              {bpHint ? <Text style={styles.vitalHint}>{bpHint}</Text> : null}

              {bpSorted.length > 0 && (
                <>
                  <Text style={styles.vitalChartLabel}>Systolic (top number), mmHg</Text>
                  <LabTrendChart
                    history={bpSorted.map((b) => ({ value: String(b.systolic), date: b.date }))}
                    range="Below 120 mmHg (normal)"
                  />
                  <Text style={styles.vitalChartLabel}>Diastolic (bottom number), mmHg</Text>
                  <LabTrendChart
                    history={bpSorted.map((b) => ({ value: String(b.diastolic), date: b.date }))}
                    range="Below 80 mmHg (normal)"
                  />
                  <Text style={styles.sourceNote}>
                    Normal values from MedlinePlus (National Library of Medicine). Your provider can tell you what your readings mean.
                  </Text>
                </>
              )}

              <Text style={styles.epicEditLabel}>All readings</Text>
              {bpList.length === 0 && <Text style={styles.emptyText}>No readings saved yet.</Text>}
              {bpList.map((r) => (
                <View key={`b-${r.index}`} style={styles.readingRow}>
                  <View>
                    <Text style={styles.readingValue}>{r.systolic}/{r.diastolic} mmHg</Text>
                    <Text style={styles.readingDate}>{formatReadingDate(r.date)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => deleteBpReading(r.index)}>
                    <Text style={styles.epicEditLink}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                style={styles.epicEditSave}
                onPress={() => {
                  setVitalDetail(null);
                  setNewSystolic('');
                  setNewDiastolic('');
                  setAddingReading('bp');
                }}
              >
                <Text style={styles.epicEditSaveText}>+ Add blood pressure</Text>
              </TouchableOpacity>
            </>
          )}

          </ScrollView>
        </View>
      </Modal>

      {/* Add a weight or blood pressure reading */}
      <Modal visible={addingReading !== null} animationType="slide" onRequestClose={() => setAddingReading(null)}>
        <View style={styles.modalContainer}>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 60, paddingHorizontal: 20 }}>
            <TouchableOpacity onPress={() => setAddingReading(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ fontSize: 26, color: '#007AFF', fontWeight: '600' }}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={{ paddingTop: 16, paddingHorizontal: 20 }}>
            <Text style={styles.epicEditTitle}>
              {addingReading === 'weight' ? 'Add a weight' : 'Add a blood pressure'}
            </Text>
            <Text style={styles.epicEditLabel}>Date (MM/DD/YYYY)</Text>
            <TextInput
              style={styles.epicEditInput}
              keyboardType="numbers-and-punctuation"
              placeholder="e.g. 10/14/2026"
              placeholderTextColor="#999"
              value={newReadingDate}
              onChangeText={setNewReadingDate}
            />

            {addingReading === 'weight' ? (
              <>
                <Text style={styles.epicEditLabel}>Weight (lbs)</Text>
                <TextInput
                  style={styles.epicEditInput}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 182"
                  placeholderTextColor="#999"
                  value={newWeight}
                  onChangeText={setNewWeight}
                />
              </>
            ) : (
              <>
                <Text style={styles.epicEditLabel}>Top number (systolic)</Text>
                <TextInput
                  style={styles.epicEditInput}
                  keyboardType="number-pad"
                  placeholder="e.g. 120"
                  placeholderTextColor="#999"
                  value={newSystolic}
                  onChangeText={setNewSystolic}
                />
                <Text style={styles.epicEditLabel}>Bottom number (diastolic)</Text>
                <TextInput
                  style={styles.epicEditInput}
                  keyboardType="number-pad"
                  placeholder="e.g. 80"
                  placeholderTextColor="#999"
                  value={newDiastolic}
                  onChangeText={setNewDiastolic}
                />
              </>
            )}

            <TouchableOpacity style={styles.epicEditSave} onPress={saveNewReading}>
              <Text style={styles.epicEditSaveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit an Epic item shown on this screen */}
      <Modal visible={editingEpic !== null} animationType="slide" onRequestClose={() => setEditingEpic(null)}>
        <View style={styles.modalContainer}>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 60, paddingHorizontal: 20 }}>
            <TouchableOpacity onPress={() => setEditingEpic(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ fontSize: 26, color: '#007AFF', fontWeight: '600' }}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={{ paddingTop: 16, paddingHorizontal: 20 }}>
            <Text style={styles.epicEditTitle}>Edit this item</Text>
            <Text style={styles.epicEditHint}>Only this app changes. Epic's record stays as it is.</Text>

            <Text style={styles.epicEditLabel}>{editingEpic?.primaryLabel}</Text>
            <TextInput
              style={styles.epicEditInput}
              value={editingEpic?.primary ?? ''}
              onChangeText={(text) => setEditingEpic((current) => (current ? { ...current, primary: text } : current))}
            />

            <Text style={styles.epicEditLabel}>{editingEpic?.secondaryLabel}</Text>
            <TextInput
              style={styles.epicEditInput}
              value={editingEpic?.secondary ?? ''}
              onChangeText={(text) => setEditingEpic((current) => (current ? { ...current, secondary: text } : current))}
            />

            <TouchableOpacity style={styles.epicEditSave} onPress={saveEpicEdit}>
              <Text style={styles.epicEditSaveText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 16 }} onPress={restoreEpicEdit}>
              <Text style={styles.epicEditLink}>Restore Epic's version</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={editingSection === 'birthday'} animationType="slide" onRequestClose={handleCancel}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Birthday</Text>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <View style={styles.datePickerContainer}>
              {/* Month Picker */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Month</Text>
                <ScrollView style={styles.picker} scrollEnabled>
                  {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month, idx) => (
                    <TouchableOpacity
                      key={month}
                      style={[styles.pickerOption, selectedBirthdayMonth === idx && styles.pickerOptionSelected]}
                      onPress={() => setSelectedBirthdayMonth(idx)}
                    >
                      <Text style={[styles.pickerOptionText, selectedBirthdayMonth === idx && styles.pickerOptionTextSelected]}>
                        {month}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Day Picker */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Day</Text>
                <ScrollView style={styles.picker} scrollEnabled>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[styles.pickerOption, selectedBirthdayDay === day && styles.pickerOptionSelected]}
                      onPress={() => setSelectedBirthdayDay(day)}
                    >
                      <Text style={[styles.pickerOptionText, selectedBirthdayDay === day && styles.pickerOptionTextSelected]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Year Picker */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Year</Text>
                <ScrollView style={styles.picker} scrollEnabled>
                  {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                    <TouchableOpacity
                      key={year}
                      style={[styles.pickerOption, selectedBirthdayYear === year && styles.pickerOptionSelected]}
                      onPress={() => setSelectedBirthdayYear(year)}
                    >
                      <Text style={[styles.pickerOptionText, selectedBirthdayYear === year && styles.pickerOptionTextSelected]}>
                        {year}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => {
                  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                  const formattedBirthday = `${months[selectedBirthdayMonth]} ${selectedBirthdayDay}, ${selectedBirthdayYear}`;
                  patchUserData({ birthday: formattedBirthday });
                  setEditingSection(null);
                }}
              >
                <Text style={styles.buttonTextWhite}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* History Modal */}
      <Modal visible={editingHistoryType !== null} animationType="slide" onRequestClose={handleCancel}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingHistoryType === 'surgical' && 'Surgical History'}
              {editingHistoryType === 'family' && 'Family History'}
              {editingHistoryType === 'conditions' && 'Past Condition'}
              {editingHistoryType === 'hospitalization' && 'Hospitalization'}
            </Text>
            <TouchableOpacity onPress={() => {
              setEditingHistoryType(null);
              setShowHistoryDatePicker(false);
            }}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            {editingHistoryType === 'surgical' && (
              <>
                <Text style={styles.label}>Surgery Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Appendectomy"
                  placeholderTextColor="#999"
                  value={surgeryName}
                  onChangeText={setSurgeryName}
                />
                <Text style={styles.label}>Date (Month Year)</Text>
                <View style={styles.pickerRow}>
                  <View style={styles.pickerColumn}>
                    <Text style={styles.pickerLabel}>Month</Text>
                    <ScrollView style={styles.scrollPicker} showsVerticalScrollIndicator={false}>
                      {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, idx) => (
                        <TouchableOpacity
                          key={idx}
                          style={[styles.pickerOption, historyDateMonth === idx && styles.pickerOptionSelected]}
                          onPress={() => setHistoryDateMonth(idx)}
                        >
                          <Text style={[styles.pickerOptionText, historyDateMonth === idx && styles.pickerOptionTextSelected]}>
                            {month}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <View style={styles.pickerColumn}>
                    <Text style={styles.pickerLabel}>Year</Text>
                    <ScrollView style={styles.scrollPicker} showsVerticalScrollIndicator={false}>
                      {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                        <TouchableOpacity
                          key={year}
                          style={[styles.pickerOption, historyDateYear === year && styles.pickerOptionSelected]}
                          onPress={() => setHistoryDateYear(year)}
                        >
                          <Text style={[styles.pickerOptionText, historyDateYear === year && styles.pickerOptionTextSelected]}>
                            {year}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              </>
            )}
            {editingHistoryType === 'family' && (
              <>
                <Text style={styles.label}>Family Member</Text>
                <View style={styles.familyMemberContainer}>
                  {['Mother', 'Father', 'Sister', 'Brother', 'Grandmother', 'Grandfather', 'Aunt', 'Uncle'].map((member) => (
                    <TouchableOpacity
                      key={member}
                      style={[
                        styles.familyButton,
                        familyMember === member && styles.familyButtonSelected,
                      ]}
                      onPress={() => {
                        setFamilyMember(member);
                        setFamilyMemberCustomMode(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.familyButtonText,
                          familyMember === member && styles.familyButtonTextSelected,
                        ]}
                      >
                        {member}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[
                      styles.familyButton,
                      familyMemberCustomMode && styles.familyButtonSelected,
                    ]}
                    onPress={() => {
                      setFamilyMember('');
                      setFamilyMemberCustomMode(true);
                    }}
                  >
                    <Text
                      style={[
                        styles.familyButtonText,
                        familyMemberCustomMode && styles.familyButtonTextSelected,
                      ]}
                    >
                      Other
                    </Text>
                  </TouchableOpacity>
                </View>
                {familyMemberCustomMode && (
                  <TextInput
                    style={styles.input}
                    placeholder="Enter family member name"
                    placeholderTextColor="#999"
                    value={familyMember}
                    onChangeText={setFamilyMember}
                  />
                )}
                <Text style={styles.label}>Condition</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Diabetes"
                  placeholderTextColor="#999"
                  value={familyCondition}
                  onChangeText={setFamilyCondition}
                />
              </>
            )}
            {editingHistoryType === 'conditions' && (
              <>
                <Text style={styles.label}>Condition Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Asthma"
                  placeholderTextColor="#999"
                  value={conditionName}
                  onChangeText={setConditionName}
                />
              </>
            )}
            {editingHistoryType === 'hospitalization' && (
              <>
                <Text style={styles.label}>Reason</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Pneumonia treatment"
                  placeholderTextColor="#999"
                  value={hospitalizationReason}
                  onChangeText={setHospitalizationReason}
                />
                <Text style={styles.label}>Date (Month Year)</Text>
                <View style={styles.pickerRow}>
                  <View style={styles.pickerColumn}>
                    <Text style={styles.pickerLabel}>Month</Text>
                    <ScrollView style={styles.scrollPicker} showsVerticalScrollIndicator={false}>
                      {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, idx) => (
                        <TouchableOpacity
                          key={idx}
                          style={[styles.pickerOption, historyDateMonth === idx && styles.pickerOptionSelected]}
                          onPress={() => setHistoryDateMonth(idx)}
                        >
                          <Text style={[styles.pickerOptionText, historyDateMonth === idx && styles.pickerOptionTextSelected]}>
                            {month}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <View style={styles.pickerColumn}>
                    <Text style={styles.pickerLabel}>Year</Text>
                    <ScrollView style={styles.scrollPicker} showsVerticalScrollIndicator={false}>
                      {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                        <TouchableOpacity
                          key={year}
                          style={[styles.pickerOption, historyDateYear === year && styles.pickerOptionSelected]}
                          onPress={() => setHistoryDateYear(year)}
                        >
                          <Text style={[styles.pickerOptionText, historyDateYear === year && styles.pickerOptionTextSelected]}>
                            {year}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              </>
            )}
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveEdit}>
                <Text style={styles.buttonTextWhite}>Save</Text>
              </TouchableOpacity>
            </View>
            {editingIndex !== null && (
              <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>


      {/* Gender Modal */}
      <Modal visible={editingSection === 'gender'} animationType="slide" onRequestClose={handleCancel}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Gender</Text>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <View style={styles.genderGrid}>
              {['Male', 'Female', 'Other'].map((gender) => (
                <TouchableOpacity
                  key={gender}
                  style={[
                    styles.genderButton,
                    selectedGender === gender && styles.genderButtonSelected,
                  ]}
                  onPress={() => setSelectedGender(gender)}
                >
                  <Text
                    style={[
                      styles.genderButtonText,
                      selectedGender === gender && styles.genderButtonTextSelected,
                    ]}
                  >
                    {gender}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {selectedGender === 'Other' && (
              <View style={styles.customGenderContainer}>
                <Text style={styles.customGenderLabel}>Enter your gender:</Text>
                <TextInput
                  style={styles.customGenderInput}
                  placeholder="e.g., Non-binary, Genderqueer"
                  placeholderTextColor="#BBB"
                  value={customGender}
                  onChangeText={setCustomGender}
                  autoFocus
                />
              </View>
            )}
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => {
                  const genderToSave = selectedGender === 'Other' && customGender ? customGender : selectedGender;
                  patchUserData({ gender: genderToSave });
                  setCustomGender('');
                  setEditingSection(null);
                }}
              >
                <Text style={styles.buttonTextWhite}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={editingSection === 'bloodType'} animationType="slide" onRequestClose={handleCancel}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Blood Type</Text>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <View style={styles.bloodTypeGrid}>
              {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.bloodTypeButton,
                    editData.bloodType === type && styles.bloodTypeButtonSelected,
                  ]}
                  onPress={() => setEditData({ ...editData, bloodType: type })}
                >
                  <Text
                    style={[
                      styles.bloodTypeButtonText,
                      editData.bloodType === type && styles.bloodTypeButtonTextSelected,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveEdit}>
                <Text style={styles.buttonTextWhite}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Height Modal */}
      <Modal visible={editingSection === 'height'} animationType="slide" onRequestClose={handleCancel}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Height</Text>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.datePickerContent}>
            <View style={styles.pickerRow}>
              {/* Feet Picker */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Feet</Text>
                <ScrollView style={styles.scrollPicker} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: 4 }, (_, i) => i + 4).map((foot) => (
                    <TouchableOpacity
                      key={foot}
                      style={[styles.pickerOption, selectedFeet === foot && styles.pickerOptionSelected]}
                      onPress={() => setSelectedFeet(foot)}
                    >
                      <Text style={[styles.pickerOptionText, selectedFeet === foot && styles.pickerOptionTextSelected]}>
                        {foot}'
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Inches Picker */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Inches</Text>
                <ScrollView style={styles.scrollPicker} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: 12 }, (_, i) => i).map((inch) => (
                    <TouchableOpacity
                      key={inch}
                      style={[styles.pickerOption, selectedInches === inch && styles.pickerOptionSelected]}
                      onPress={() => setSelectedInches(inch)}
                    >
                      <Text style={[styles.pickerOptionText, selectedInches === inch && styles.pickerOptionTextSelected]}>
                        {inch}"
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <TouchableOpacity
              style={styles.datePickerDoneButton}
              onPress={async () => {
                const updatedData = { ...editData, height: `${selectedFeet}'${selectedInches}"` };
                setEditData(updatedData);
                await patchUserData({ height: updatedData.height });
                setEditingSection(null);
              }}
            >
              <Text style={styles.datePickerDoneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Weight Modal */}
      <Modal visible={editingSection === 'weight'} animationType="slide" onRequestClose={handleCancel}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Weight</Text>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.datePickerContent}>
            <View style={styles.pickerRow}>
              {/* Weight Picker */}
              <View style={[styles.pickerColumn, { flex: 1 }]}>
                <Text style={styles.pickerLabel}>Weight (lbs)</Text>
                <ScrollView style={styles.scrollPicker} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: 601 }, (_, i) => i).map((weight) => (
                    <TouchableOpacity
                      key={weight}
                      style={[styles.pickerOption, selectedWeight === weight && styles.pickerOptionSelected]}
                      onPress={() => setSelectedWeight(weight)}
                    >
                      <Text style={[styles.pickerOptionText, selectedWeight === weight && styles.pickerOptionTextSelected]}>
                        {weight}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <TouchableOpacity
              style={styles.datePickerDoneButton}
              onPress={async () => {
                const weightValue = Number(selectedWeight);
                const updatedData = {
                  weight: `${selectedWeight} lbs`,
                  weightHistory: isNaN(weightValue)
                    ? userData.weightHistory
                    : [...(userData.weightHistory || []), { date: new Date().toISOString(), value: weightValue }],
                };
                await patchUserData(updatedData);
                setEditingSection(null);
              }}
            >
              <Text style={styles.datePickerDoneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Blood Pressure Modal */}
      <Modal visible={editingSection === 'bloodPressure'} animationType="slide" onRequestClose={handleCancel}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Blood Pressure</Text>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.datePickerContent}>
            <View style={styles.pickerRow}>
              {/* Systolic Picker */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Systolic</Text>
                <ScrollView style={styles.scrollPicker} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: 251 }, (_, i) => i).map((systolic) => (
                    <TouchableOpacity
                      key={systolic}
                      style={[styles.pickerOption, selectedSystolic === systolic && styles.pickerOptionSelected]}
                      onPress={() => setSelectedSystolic(systolic)}
                    >
                      <Text style={[styles.pickerOptionText, selectedSystolic === systolic && styles.pickerOptionTextSelected]}>
                        {systolic}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Diastolic Picker */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Diastolic</Text>
                <ScrollView style={styles.scrollPicker} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: 251 }, (_, i) => i).map((diastolic) => (
                    <TouchableOpacity
                      key={diastolic}
                      style={[styles.pickerOption, selectedDiastolic === diastolic && styles.pickerOptionSelected]}
                      onPress={() => setSelectedDiastolic(diastolic)}
                    >
                      <Text style={[styles.pickerOptionText, selectedDiastolic === diastolic && styles.pickerOptionTextSelected]}>
                        {diastolic}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <TouchableOpacity
              style={styles.datePickerDoneButton}
              onPress={async () => {
                const updatedData = {
                  vitals: { ...userData.vitals, bloodPressure: `${selectedSystolic}/${selectedDiastolic} mmHg` },
                  bloodPressureHistory: [
                    ...(userData.bloodPressureHistory || []),
                    { date: new Date().toISOString(), systolic: Number(selectedSystolic), diastolic: Number(selectedDiastolic) },
                  ],
                };
                await patchUserData(updatedData);
                setEditingSection(null);
                Alert.alert('Success', 'Blood pressure saved');
              }}
            >
              <Text style={styles.datePickerDoneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Prescription Medications Modal */}
      <Modal visible={editingSection === 'prescriptionMedications'} animationType="slide" onRequestClose={handleCancel}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Prescription Medications</Text>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {/* Photo Capture Section */}
            <View style={styles.photoCaptureSection}>
              <Text style={styles.label}>Scan Pill Bottle</Text>
              <TouchableOpacity
                style={styles.photoButton}
                onPress={handleCaptureMedicationPhoto}
                disabled={analyzingPhoto}
              >
                {analyzingPhoto ? (
                  <ActivityIndicator size="large" color="#007AFF" />
                ) : (
                  <>
                    <Text style={styles.photoButtonIcon}>📸</Text>
                    <Text style={styles.photoButtonText}>Take Photo of Pill Bottle</Text>
                    <Text style={styles.photoButtonSubtext}>AI will extract medication info</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Manual Entry Section */}
            <View style={styles.manualEntrySection}>
              <Text style={styles.label}>Or Add Manually</Text>
              <TextInput
                style={[styles.input, { minHeight: 120 }]}
                multiline
                value={editData.prescriptionMedications?.join('\n') || ''}
                onChangeText={(text) => setEditData({
                  ...editData,
                  prescriptionMedications: text.split('\n').filter(m => m.trim())
                })}
                placeholder="Medication 1&#10;Medication 2"
              />
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveEdit}>
                <Text style={styles.buttonTextWhite}>Save</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* OTC Medications Modal */}
      <Modal visible={editingSection === 'otcMedications'} animationType="slide" onRequestClose={handleCancel}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit OTC Medications & Supplements</Text>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <Text style={styles.label}>OTC Medications & Supplements (one per line)</Text>
            <TextInput
              style={[styles.input, { minHeight: 120 }]}
              multiline
              value={editData.otcMedications?.join('\n') || ''}
              onChangeText={(text) => setEditData({
                ...editData,
                otcMedications: text.split('\n').filter(m => m.trim())
              })}
              placeholder="Medication/Supplement 1&#10;Medication/Supplement 2"
            />
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveEdit}>
                <Text style={styles.buttonTextWhite}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={editingSection === 'conditions'} animationType="slide" onRequestClose={handleCancel}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Conditions</Text>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <Text style={styles.label}>Conditions (one per line)</Text>
            <TextInput
              style={[styles.input, { minHeight: 120 }]}
              multiline
              value={editData.conditions?.join('\n') || ''}
              onChangeText={(text) => setEditData({
                ...editData,
                conditions: text.split('\n').filter(c => c.trim())
              })}
              placeholder="Condition 1&#10;Condition 2"
            />
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveEdit}>
                <Text style={styles.buttonTextWhite}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={editingSection === 'allergies'} animationType="slide" onRequestClose={handleCancel}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Allergies</Text>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <Text style={styles.label}>Allergies (one per line)</Text>
            <TextInput
              style={[styles.input, { minHeight: 120 }]}
              multiline
              value={editData.allergies?.join('\n') || ''}
              onChangeText={(text) => setEditData({
                ...editData,
                allergies: text.split('\n').filter(a => a.trim())
              })}
              placeholder="Allergy 1&#10;Allergy 2"
            />
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveEdit}>
                <Text style={styles.buttonTextWhite}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={editingSection === 'vaccines'} animationType="slide" onRequestClose={handleCancel}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Vaccinations</Text>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {userData.vaccines && userData.vaccines.length > 0 ? (
              <View>
                {userData.vaccines.map((vaccine, idx) => (
                  <View key={idx} style={{ marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.entryTitle}>{vaccine.name}</Text>
                        <Text style={styles.entryMeta}>Date: {vaccine.date}</Text>
                        {vaccine.nextDue && <Text style={styles.entryMeta}>Next due: {vaccine.nextDue}</Text>}
                      </View>
                      <TouchableOpacity
                        onPress={async () => {
                          const updatedVaccines = userData.vaccines!.filter((_, i) => i !== idx);
                          await patchUserData({ vaccines: updatedVaccines });
                          Alert.alert('Success', 'Vaccine deleted');
                        }}
                        style={{ marginLeft: 12 }}
                      >
                        <Text style={{ color: '#FF3B30', fontWeight: '600' }}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>No vaccines recorded</Text>
            )}

            <View style={{ marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#E0E0E0' }}>
              <Text style={styles.fieldLabel}>Add New Vaccine</Text>

              <Text style={styles.label}>Vaccine Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., COVID-19 (Booster)"
                placeholderTextColor="#999"
                value={newVaccineName}
                onChangeText={setNewVaccineName}
              />

              <Text style={styles.label}>Date Received</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 2024-01-15"
                placeholderTextColor="#999"
                value={newVaccineDate}
                onChangeText={setNewVaccineDate}
              />

              <Text style={styles.label}>Next Due (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 2025-01-15"
                placeholderTextColor="#999"
                value={newVaccineNextDue}
                onChangeText={setNewVaccineNextDue}
              />

              <TouchableOpacity
                style={styles.saveButton}
                onPress={async () => {
                  if (newVaccineName.trim() && newVaccineDate.trim()) {
                    const updatedVaccines = [...(userData.vaccines || []), {
                      name: newVaccineName.trim(),
                      date: newVaccineDate.trim(),
                      nextDue: newVaccineNextDue.trim() || undefined,
                    }];
                    await patchUserData({ vaccines: updatedVaccines });
                    setNewVaccineName('');
                    setNewVaccineDate('');
                    setNewVaccineNextDue('');
                    Alert.alert('Success', 'Vaccine added');
                  } else {
                    Alert.alert('Error', 'Please fill in vaccine name and date');
                  }
                }}
              >
                <Text style={styles.buttonTextWhite}>+ Add Vaccine</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.backButton} onPress={handleCancel}>
              <Text style={styles.buttonText}>Back</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Add Vaccine from Recommended Modal */}
      <Modal visible={showVaccineModal} animationType="slide" onRequestClose={() => setShowVaccineModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Vaccine</Text>
            <TouchableOpacity onPress={() => setShowVaccineModal(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Vaccine Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Vaccine name"
              placeholderTextColor="#999"
              value={newVaccineName}
              onChangeText={setNewVaccineName}
              editable={false}
            />

            <Text style={styles.label}>Date Received</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#999"
              value={newVaccineDate}
              onChangeText={setNewVaccineDate}
            />

            <Text style={styles.label}>Next Due (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#999"
              value={newVaccineNextDue}
              onChangeText={setNewVaccineNextDue}
            />

            <TouchableOpacity
              style={styles.saveButton}
              onPress={async () => {
                if (newVaccineName.trim() && newVaccineDate.trim()) {
                  const updatedVaccines = [...(userData.vaccines || []), {
                    name: newVaccineName.trim(),
                    date: newVaccineDate.trim(),
                    nextDue: newVaccineNextDue.trim() || undefined,
                  }];
                  setEditData({ ...editData, vaccines: updatedVaccines });
                  await patchUserData({ vaccines: updatedVaccines });
                  setNewVaccineName('');
                  setNewVaccineDate('');
                  setNewVaccineNextDue('');
                  setShowVaccineModal(false);
                  Alert.alert('Success', 'Vaccine added successfully!');
                } else {
                  Alert.alert('Error', 'Please fill in vaccine name and date');
                }
              }}
            >
              <Text style={styles.buttonTextWhite}>Add Vaccine</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setShowVaccineModal(false)}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={editingSection === 'insurance'} animationType="slide" onRequestClose={handleCancel}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingInsuranceId !== null ? 'Edit Insurance' : 'Add Insurance'}</Text>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Insurance Provider</Text>
            <TextInput
              style={styles.input}
              value={insuranceProvider}
              onChangeText={setInsuranceProvider}
              placeholder="e.g., Blue Cross Blue Shield"
            />
            <Text style={styles.label}>Member ID</Text>
            <TextInput
              style={styles.input}
              value={insuranceMemberId}
              onChangeText={setInsuranceMemberId}
              placeholder="e.g., BCX123456789"
            />
            <Text style={styles.label}>Group Number (Optional)</Text>
            <TextInput
              style={styles.input}
              value={insuranceGroupNumber}
              onChangeText={setInsuranceGroupNumber}
              placeholder="e.g., GRP789"
            />
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveEdit}>
                <Text style={styles.buttonTextWhite}>Save</Text>
              </TouchableOpacity>
            </View>
            {editingInsuranceId !== null && (
              <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                <Text style={styles.deleteButtonText}>Delete Insurance</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={editingSection === 'pharmacy'} animationType="slide" onRequestClose={handleCancel}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Pharmacy</Text>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Pharmacy Name</Text>
            <TextInput
              style={styles.input}
              value={pharmacyName}
              onChangeText={setPharmacyName}
              placeholder="e.g., CVS Pharmacy"
            />
            <Text style={styles.label}>Address</Text>
            <TextInput
              style={styles.input}
              value={pharmacyAddress}
              onChangeText={setPharmacyAddress}
              placeholder="e.g., 123 Main St, Springfield, IL 62701"
            />
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={pharmacyPhone}
              onChangeText={setPharmacyPhone}
              placeholder="e.g., (555) 123-4567"
            />
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveEdit}>
                <Text style={styles.buttonTextWhite}>Save</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={editingSection === 'screenings'} animationType="slide" onRequestClose={handleCancel}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingScreeningId !== null ? 'Edit Screening' : 'Add Screening'}</Text>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Screening Type</Text>
            <TextInput
              style={styles.input}
              value={screeningType}
              onChangeText={setScreeningType}
              placeholder="e.g., Colonoscopy, Mammogram, Eye Exam, Dental, Blood Pressure"
            />
            <Text style={styles.label}>Date</Text>
            <TextInput
              style={styles.input}
              value={screeningDate}
              onChangeText={setScreeningDate}
              placeholder="e.g., 03/15/2024"
            />
            <Text style={styles.label}>Notes (Optional)</Text>
            <TextInput
              style={styles.input}
              value={screeningNotes}
              onChangeText={setScreeningNotes}
              placeholder="e.g., Provider name, results, next due date"
              multiline
            />
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveEdit}>
                <Text style={styles.buttonTextWhite}>Save</Text>
              </TouchableOpacity>
            </View>
            {editingScreeningId !== null && (
              <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                <Text style={styles.deleteButtonText}>Delete Screening</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={editingSection === 'appointments'} animationType="slide" onRequestClose={handleCancel}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingAppointmentId ? 'Edit Appointment' : 'Add Appointment'}</Text>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Date & Time</Text>
            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={handleOpenDatePicker}
            >
              <Text style={styles.dateTimeButtonText}>
                {appointmentDateTime || 'Select date & time...'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.label}>Doctor Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Dr. Sarah Johnson"
              value={appointmentDoctorName}
              onChangeText={setAppointmentDoctorName}
            />
            <Text style={styles.label}>Specialty</Text>
            <TextInput
              style={styles.input}
              placeholder="Cardiology"
              value={appointmentSpecialty}
              onChangeText={setAppointmentSpecialty}
            />

            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveEdit}>
                <Text style={styles.buttonTextWhite}>Save</Text>
              </TouchableOpacity>
            </View>
            {editingAppointmentId && (
              <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                <Text style={styles.deleteButtonText}>Delete Appointment</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Date & Time Picker Modal */}
      <Modal visible={showDatePicker} animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Date & Time</Text>
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

            <View style={styles.pickerRow}>
              {/* Hour Picker */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Hour</Text>
                <ScrollView style={styles.scrollPicker} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((hour) => (
                    <TouchableOpacity
                      key={hour}
                      style={[styles.pickerOption, selectedHour === hour && styles.pickerOptionSelected]}
                      onPress={() => setSelectedHour(hour)}
                    >
                      <Text style={[styles.pickerOptionText, selectedHour === hour && styles.pickerOptionTextSelected]}>
                        {hour}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Minute Picker */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Minute</Text>
                <ScrollView style={styles.scrollPicker} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: 60 }, (_, i) => i).map((minute) => (
                    <TouchableOpacity
                      key={minute}
                      style={[styles.pickerOption, selectedMinute === minute && styles.pickerOptionSelected]}
                      onPress={() => setSelectedMinute(minute)}
                    >
                      <Text style={[styles.pickerOptionText, selectedMinute === minute && styles.pickerOptionTextSelected]}>
                        {String(minute).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Period Picker */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Period</Text>
                <ScrollView style={styles.scrollPicker} showsVerticalScrollIndicator={false}>
                  {['AM', 'PM'].map((period) => (
                    <TouchableOpacity
                      key={period}
                      style={[styles.pickerOption, selectedPeriod === period && styles.pickerOptionSelected]}
                      onPress={() => setSelectedPeriod(period)}
                    >
                      <Text style={[styles.pickerOptionText, selectedPeriod === period && styles.pickerOptionTextSelected]}>
                        {period}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <TouchableOpacity
              style={styles.datePickerDoneButton}
              onPress={handleDateTimePickerDone}
            >
              <Text style={styles.datePickerDoneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={editingSection === 'emergency'} animationType="slide" onRequestClose={handleCancel}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingEmergencyContactId !== null ? 'Edit Emergency Contact' : 'Add Emergency Contact'}</Text>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={emergencyContactName}
              onChangeText={setEmergencyContactName}
              placeholder="Full name"
            />
            <Text style={styles.label}>Relationship</Text>
            <TextInput
              style={styles.input}
              value={emergencyContactRelationship}
              onChangeText={setEmergencyContactRelationship}
              placeholder="e.g., Spouse, Parent, Sister"
            />
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={emergencyContactPhone}
              onChangeText={setEmergencyContactPhone}
              placeholder="(555) 123-4567"
            />
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveEdit}>
                <Text style={styles.buttonTextWhite}>Save</Text>
              </TouchableOpacity>
            </View>
            {editingEmergencyContactId !== null && (
              <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                <Text style={styles.deleteButtonText}>Delete Contact</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Medication Input Modal */}
      <Modal visible={medicationInputMode !== null} animationType="slide" onRequestClose={() => {
        setMedicationInputMode(null);
        setMedicationType(null);
        setMedicationPhotoUri(null);
        setMedicationInputText('');
      }}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add {medicationType === 'prescription' ? 'Prescription' : 'OTC'} Medication</Text>
            <TouchableOpacity onPress={() => {
              setMedicationInputMode(null);
              setMedicationType(null);
              setMedicationPhotoUri(null);
              setMedicationInputText('');
            }}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {medicationInputMode === 'method' && (
              <>
                <Text style={styles.label}>How would you like to add?</Text>
                <Text style={styles.sublabel}>Choose a method to add your medication</Text>

                <TouchableOpacity style={styles.methodButton} onPress={handleMedicationPhotoCapture}>
                  <Text style={styles.methodButtonIcon}>📷</Text>
                  <View style={styles.methodButtonContent}>
                    <Text style={styles.methodButtonText}>Take Photo</Text>
                    <Text style={styles.methodButtonDesc}>Photograph the pill bottle (real device)</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.methodButton} onPress={handleMedicationPhotoLibrary}>
                  <Text style={styles.methodButtonIcon}>🖼️</Text>
                  <View style={styles.methodButtonContent}>
                    <Text style={styles.methodButtonText}>Choose Photo</Text>
                    <Text style={styles.methodButtonDesc}>Select from photo library (real device)</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.methodButton} onPress={() => setMedicationInputMode('text')}>
                  <Text style={styles.methodButtonIcon}>✍️</Text>
                  <View style={styles.methodButtonContent}>
                    <Text style={styles.methodButtonText}>Type Details</Text>
                    <Text style={styles.methodButtonDesc}>Always available - enter medication name</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}

            {medicationInputMode === 'text' && (
              <>
                <Text style={styles.label}>Medication Name</Text>
                <Text style={styles.sublabel}>Enter the medication name and dosage</Text>
                <TextInput
                  style={[styles.input, { minHeight: 100 }]}
                  placeholder="e.g., Lisinopril 10mg daily"
                  placeholderTextColor="#999"
                  value={medicationInputText}
                  onChangeText={setMedicationInputText}
                  multiline
                />
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setMedicationInputMode('method')}
                >
                  <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={handleMedicationTextSubmit}
                >
                  <Text style={styles.addButtonText}>Add Medication</Text>
                </TouchableOpacity>
              </>
            )}

            {medicationInputMode === 'photo' && medicationPhotoUri && (
              <>
                <Text style={styles.label}>Preview Your Bottle</Text>
                <Image source={{ uri: medicationPhotoUri }} style={styles.photoPreview} resizeMode="contain" />
                <Text style={styles.sublabel}>Claude will analyze this label to extract medication details</Text>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => {
                    setMedicationInputMode('method');
                    setMedicationPhotoUri(null);
                  }}
                >
                  <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addButton, analyzingMedication && styles.buttonDisabled]}
                  onPress={handleMedicationPhotoSubmit}
                  disabled={analyzingMedication}
                >
                  {analyzingMedication ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.addButtonText}>Analyze & Add Medication</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

    </>
  );
}

const styles = StyleSheet.create({
  tapForHistory: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
    paddingLeft: 8,
  },
  vitalHint: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
  },
  detailCurrent: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  readingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  readingValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  readingDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  sourceNote: {
    fontSize: 11,
    color: '#888',
    marginTop: 8,
  },
  addReadingButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  addReadingText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 13,
  },
  addReadingDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  vitalChartBox: {
    marginTop: 4,
    marginBottom: 8,
  },
  vitalChartLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  epicEditLink: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  epicEditTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  epicEditHint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  epicEditLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    marginBottom: 6,
  },
  epicEditInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#000',
    backgroundColor: '#FAFAFA',
  },
  epicEditSave: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  epicEditSaveText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
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
  section: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  editButton: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  editButtonSmall: {
    fontSize: 14,
    color: '#007AFF',
  },
  vitalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  vitalTouch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailModal: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  detailAction: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  detailClose: {
    fontSize: 26,
    color: '#007AFF',
    fontWeight: '600',
  },
  detailContent: {
    paddingTop: 12,
    paddingBottom: 60,
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  rowIcon: {
    width: 22,
    marginRight: 12,
  },
  rowChevron: {
    marginLeft: 8,
  },
  vitalContent: {
    flex: 1,
  },
  vitalLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  vitalEmoji: {
    fontSize: 16,
    marginRight: 4,
  },
  vitalValue: {
    fontSize: 15,
    fontWeight: '400',
    color: '#000',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  listCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  cardWrapper: {
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 10,
  },
  cardIcon: {
    fontSize: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  cardMeta: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 50,
    backgroundColor: '#F0F0F0',
  },
  metricLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 2,
  },
  metricStatus: {
    fontSize: 10,
    color: '#66BB6A',
    fontWeight: '500',
  },
  listItem: {
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  listItemText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#E8F0FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  allergyTag: {
    backgroundColor: '#FFE8E8',
  },
  allergyText: {
    color: '#FF3333',
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  resultProvider: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 3,
  },
  resultSummary: {
    fontSize: 12,
    color: '#666',
    marginBottom: 3,
  },
  resultDate: {
    fontSize: 11,
    color: '#999',
  },
  arrow: {
    fontSize: 20,
    color: '#DDD',
  },
  emptyText: {
    fontSize: 14,
    color: '#66BB6A',
    textAlign: 'center',
    paddingVertical: 8,
    fontWeight: '500',
  },
  itemRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  itemNextDue: {
    fontSize: 11,
    color: '#007AFF',
    fontWeight: '500',
  },
  itemPhone: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  infoLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    color: '#000',
    fontWeight: '600',
  },
  infoValueMono: {
    fontSize: 13,
    color: '#000',
    fontWeight: '600',
    fontFamily: 'Courier New',
  },
  infoRowWithEdit: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  infoColumn: {
    flex: 1,
  },
  contactRowWithEdit: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  spacing: {
    height: 100,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
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
  modalContent: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#000',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginTop: 16,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 30,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  buttonTextWhite: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  medRowName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  medRowDetail: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  medsTabs: {
    flexDirection: 'row',
    backgroundColor: '#EFEFF4',
    borderRadius: 10,
    padding: 3,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  medsTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  medsTabActive: {
    backgroundColor: '#FFF',
  },
  medsTabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  medsTabTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  medTimes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 10,
  },
  medTimesEmpty: {
    fontSize: 13,
    color: '#666',
  },
  timeChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#E8F1FF',
  },
  timeChipText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  timeAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  timeInput: {
    flex: 1,
    fontSize: 15,
    color: '#000',
    paddingVertical: 6,
  },
  timeAddButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  timeAddText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  medField: {
    paddingVertical: 12,
  },
  medFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  medFieldInput: {
    fontSize: 16,
    color: '#000',
    paddingVertical: 4,
  },
  medSaveWrap: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  medSaveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  medSaveText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  lastHealthSection: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  healthSection: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  healthSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  healthSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
  },
  editLink: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  healthItem: {
    fontSize: 14,
    color: '#333',
    marginBottom: 6,
    lineHeight: 20,
  },
  healthItemMeta: {
    fontSize: 12,
    color: '#999',
    marginBottom: 6,
    lineHeight: 18,
  },
  contactRow: {
    paddingVertical: 4,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  contactRelationship: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  contactPhoneNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  photoCaptureSection: {
    marginBottom: 24,
  },
  photoButton: {
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    marginBottom: 12,
  },
  photoButtonIcon: {
    fontSize: 32,
    marginBottom: 10,
  },
  photoButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  photoButtonSubtext: {
    fontSize: 12,
    color: '#666',
  },
  manualEntrySection: {
    marginBottom: 24,
  },
  appointmentItem: {
    paddingVertical: 14,
    flex: 1,
  },
  appointmentItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  appointmentDivider: {
    height: 1,
    backgroundColor: '#F5F5F5',
  },
  appointmentDate: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
    marginBottom: 6,
  },
  appointmentDoctor: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  appointmentSpecialty: {
    fontSize: 13,
    color: '#666',
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
    marginTop: 20,
  },
  addButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  dateTimeButton: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 16,
  },
  dateTimeButtonText: {
    fontSize: 15,
    color: '#000',
  },
  datePickerContent: {
    flex: 1,
    flexDirection: 'column',
    paddingHorizontal: 20,
  },
  dateTimeScrollView: {
    flex: 1,
    marginVertical: 20,
  },
  dateTimeOption: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: '#F5F5F5',
  },
  dateTimeOptionSelected: {
    backgroundColor: '#007AFF',
  },
  dateTimeOptionText: {
    fontSize: 15,
    color: '#000',
    fontWeight: '500',
  },
  dateTimeOptionTextSelected: {
    color: '#FFF',
    fontWeight: '600',
  },
  datePickerDoneButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 30,
  },
  datePickerDoneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  pickerRow: {
    flexDirection: 'row',
    marginBottom: 20,
    marginHorizontal: -20,
    paddingHorizontal: 20,
    gap: 16,
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
  bloodTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  bloodTypeButton: {
    width: '23%',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloodTypeButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  bloodTypeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#666',
  },
  bloodTypeButtonTextSelected: {
    color: '#FFF',
  },
  genderGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  genderButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  genderButtonTextSelected: {
    color: '#FFF',
  },
  datePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 24,
    height: 200,
  },
  pickerColumn: {
    flex: 1,
    marginHorizontal: 8,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  picker: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  pickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerOptionSelected: {
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  pickerOptionTextSelected: {
    color: '#FFF',
    fontWeight: '600',
  },
  customGenderContainer: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  customGenderLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 12,
  },
  customGenderInput: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#000',
    borderWidth: 2,
    borderColor: '#007AFF',
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  deleteButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  snapshotHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 12,
  },
  snapshotTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
  },
  historyItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  historyItem: {
    flex: 1,
  },
  historyType: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  historyDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  typeButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  typeButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  typeButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  typeButtonTextSelected: {
    color: '#FFF',
  },
  descriptionInput: {
    height: 100,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  historyCategory: {
    marginBottom: 16,
  },
  historyCategoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyCategoryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  addLink: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '600',
  },
  historyEntry: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 8,
  },
  entryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  entryMeta: {
    fontSize: 12,
    color: '#999',
  },
  familyMemberContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  familyButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  familyButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  familyButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  familyButtonTextSelected: {
    color: '#FFF',
  },
  sublabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
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
  buttonDisabled: {
    backgroundColor: '#CCC',
  },
  recommendedSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopColor: '#E0E0E0',
    borderTopWidth: 1,
  },
  recommendedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  recommendedSubtitle: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
  },
  recommendedList: {
    gap: 8,
  },
  recommendedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  completedItem: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  recommendedCheckbox: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginRight: 10,
    minWidth: 16,
  },
  recommendedText: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  completedText: {
    color: '#666',
    textDecorationLine: 'line-through',
  },
  screeningSection: {
    marginBottom: 0,
  },
  screeningSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  screeningSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  addButtonSmall: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  completedScreeningItem: {
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  completedScreeningType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 3,
  },
  completedScreeningDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  completedScreeningNotes: {
    fontSize: 12,
    color: '#999',
    marginTop: 3,
    fontStyle: 'italic',
  },
  emptyScreeningText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    paddingVertical: 12,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 16,
  },
});
