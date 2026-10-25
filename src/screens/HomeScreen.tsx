import React, { useState, useEffect } from 'react';
import DateWheel, { dateFromText, textFromDate } from '@/components/DateWheel';
import FindDoctor from '@/components/FindDoctor';
import FindPharmacy from '@/components/FindPharmacy';
import InlineFieldsForm from '@/components/InlineFieldsForm';
import EpicBadge from '@/components/EpicBadge';
import BloodPressureChart from '@/components/BloodPressureChart';
import InsuranceScan, { CardDetails } from '@/components/InsuranceScan';
import VaccineForm, { VaccineFormValues, blankVaccineForm } from '@/components/VaccineEditor';
import ScreeningForm, { ScreeningFormValues, blankScreeningForm } from '@/components/ScreeningForm';
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
import { cameraService } from '@/services/cameraService';
import { ehrService, Medication, Appointment, Observation, Allergy, Condition, EpicOverride } from '@/services/ehrService';
import LabTrendChart from '@/components/LabTrendChart';
import QuickLogBox from '@/components/QuickLogBox';
import MedicationCalendar from '@/components/MedicationCalendar';
import { nextDoseLabel, defaultTimes, dateKey, dateFromKey } from '@/services/doseSchedule';
import MedicationLabelReview, { MedicationDraft } from '@/components/MedicationLabelReview';
import MedicationForm, { MedicationFormValues, blankMedicationForm, formFromMedication, medicationFieldsFromForm } from '@/components/MedicationForm';
import AppointmentQuickAdd from '@/components/AppointmentQuickAdd';
import AppointmentEditor, { formatAppointmentDateTime, appointmentPartsFrom, defaultAppointmentTime } from '@/components/AppointmentEditor';
import AppointmentReminderOptions from '@/components/AppointmentReminderOptions';
import { appointmentMoment } from '@/services/reminders';
import MedicalHistoryForm, { HistoryDraft, blankHistoryDraft, FAMILY_MEMBERS, formatHistoryDate, historyDateFrom } from '@/components/MedicalHistoryForm';
import { isBirthOutcome, isLossOutcome } from '@/components/PregnancyEditor';
import FieldFormEditor from '@/components/FieldFormEditor';
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
  onPress?: () => void;
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
        {onPress ? <MaterialCommunityIcons name="chevron-right" size={20} color="#C7C7CC" style={styles.rowChevron} /> : null}
      </TouchableOpacity>
    </View>
  );
}

export default function HomeScreen() {
  const { records, userData, loading, getAbnormalResults, patchUserData, setEpicAppointmentsForReminders } = useRecords();
  const router = useRouter();
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editData, setEditData] = useState(userData);
  // Keep the editing copy in step with saved data, so a later save never writes back older readings
  useEffect(() => {
    setEditData(userData);
  }, [userData]);
  const [medicationPhoto, setMedicationPhoto] = useState<string | null>(null);
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState<Date>(() => new Date());
  const [appointmentTime, setAppointmentTime] = useState<Date>(defaultAppointmentTime);
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [selectedWeight, setSelectedWeight] = useState(180);
  const [selectedSystolic, setSelectedSystolic] = useState(120);
  const [selectedDiastolic, setSelectedDiastolic] = useState(80);
  const [appointmentDoctorName, setAppointmentDoctorName] = useState('');
  const [appointmentSpecialty, setAppointmentSpecialty] = useState('');
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [appointmentTab, setAppointmentTab] = useState<'upcoming' | 'previous'>('upcoming');
  const [insuranceDraft, setInsuranceDraft] = useState({ provider: '', memberId: '', groupNumber: '' });
  // The plan being edited: its index, 'new' for a new plan, or null when none is open
  const [editingInsurance, setEditingInsurance] = useState<number | 'new' | null>(null);
  const [allergyDraft, setAllergyDraft] = useState('');
  const [editingAllergy, setEditingAllergy] = useState<number | 'new' | null>(null);
  const [conditionDraft, setConditionDraft] = useState('');
  const [editingCondition, setEditingCondition] = useState<{ list: 'active' | 'resolved'; index: number } | 'new' | null>(null);
  const [emergencyDraft, setEmergencyDraft] = useState({ name: '', relationship: '', phone: '' });
  // The contact being edited: its index, 'new' for a new contact, or null when none is open
  const [editingContact, setEditingContact] = useState<number | 'new' | null>(null);
  const [insuranceScanOpen, setInsuranceScanOpen] = useState(false);
  const [insuranceManualNext, setInsuranceManualNext] = useState(false);
  const [editingPharmacy, setEditingPharmacy] = useState(false);
  const [pharmacyDraft, setPharmacyDraft] = useState({ name: '', address: '', phone: '' });
  const [openScreening, setOpenScreening] = useState<{ key: string } | null>(null);
  const [screeningForm, setScreeningForm] = useState<ScreeningFormValues>(blankScreeningForm());
  const [birthdayPick, setBirthdayPick] = useState<Date>(() => new Date(1990, 0, 1, 12));
  const [selectedGender, setSelectedGender] = useState('Other');
  const [customGender, setCustomGender] = useState('');
  const [openHistory, setOpenHistory] = useState<{ key: string } | null>(null);
  const [historyDraft, setHistoryDraft] = useState<HistoryDraft>(blankHistoryDraft());
  const [addingPrescriptionMed, setAddingPrescriptionMed] = useState(false);
  const [newPrescriptionMed, setNewPrescriptionMed] = useState('');
  const [editingMed, setEditingMed] = useState<{ kind: 'prescription' | 'otc'; index: number } | null>(null);
  const [pendingMedEdit, setPendingMedEdit] = useState<{ kind: 'prescription' | 'otc'; index: number } | null>(null);
  const [medForm, setMedForm] = useState<MedicationFormValues>(blankMedicationForm());
  const [medsTab, setMedsTab] = useState<'list' | 'calendar'>('list');
  const [addingOtcMed, setAddingOtcMed] = useState(false);
  const [newOtcMed, setNewOtcMed] = useState('');
  const [addingVaccine, setAddingVaccine] = useState(false);
  const [newVaccine, setNewVaccine] = useState('');
  const [editingVaccineIdx, setEditingVaccineIdx] = useState<number | null>(null);
  const [editingVaccineValue, setEditingVaccineValue] = useState('');
  const [editingVaccineId, setEditingVaccineId] = useState<number | null>(null);
  const [openVaccine, setOpenVaccine] = useState<{ key: string } | null>(null);
  const [vaccineForm, setVaccineForm] = useState<VaccineFormValues>(blankVaccineForm());
  const [medicationInputMode, setMedicationInputMode] = useState<'method' | 'text' | 'photo' | 'label-review' | null>(null);
  const [labelDraft, setLabelDraft] = useState<MedicationDraft | null>(null);
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
  // iOS can't show a modal from inside another, so an editor opened from a page waits until that page has closed
  const [pendingEditor, setPendingEditor] = useState<(() => void) | null>(null);
  const openEditorFromPage = (open: () => void) => {
    setPendingEditor(() => open);
    setOpenPage(null);
  };
  const runPendingEditor = () => {
    if (!pendingEditor) return;
    setPendingEditor(null);
    pendingEditor();
  };
  // Allergies: your own can be added, edited, or deleted right on the page. Epic allergies are edited through their Epic edit screen.
  const epicAllergyNames = new Set(epicAllergies.map((a) => a.allergen.trim().toLowerCase()));
  const manualAllergyRows = (userData.allergies || [])
    .map((allergy, index) => ({ allergy, index }))
    .filter(({ allergy }) => !epicAllergyNames.has(allergy.trim().toLowerCase()));
  // An allergy row opens its form in place: its index in your list, or 'new' for a new allergy
  const openAllergyEditor = (index: number | 'new') => {
    setAllergyDraft(index === 'new' ? '' : (userData.allergies || [])[index] || '');
    setEditingAllergy(index);
  };
  const saveAllergy = async () => {
    const name = allergyDraft.trim();
    if (!name) {
      Alert.alert('Add an allergy', 'Enter the allergy.');
      return;
    }
    const allergies = [...(userData.allergies || [])];
    if (editingAllergy === 'new') allergies.push(name);
    else if (editingAllergy !== null) allergies[editingAllergy] = name;
    await patchUserData({ allergies });
    setEditingAllergy(null);
  };
  const deleteAllergy = async () => {
    if (typeof editingAllergy !== 'number') return;
    await patchUserData({ allergies: (userData.allergies || []).filter((_, i) => i !== editingAllergy) });
    setEditingAllergy(null);
  };
  const renderAllergyForm = () => (
    <InlineFieldsForm
      fields={[{ key: 'name', label: 'Allergy', placeholder: 'e.g. Penicillin' }]}
      values={{ name: allergyDraft }}
      onChange={(_, value) => setAllergyDraft(value)}
      onSave={saveAllergy}
      onCancel={() => setEditingAllergy(null)}
      onDelete={typeof editingAllergy === 'number' ? deleteAllergy : undefined}
      deleteLabel="Delete allergy"
    />
  );
  // Conditions: add, rename, and move between Active and Resolved
  const epicConditionNames = new Set(epicConditions.map((c) => c.name.trim().toLowerCase()));
  const activeConditionRows = (userData.conditions || [])
    .map((condition, index) => ({ condition, index }))
    .filter(({ condition }) => !epicConditionNames.has(condition.trim().toLowerCase()));
  // A condition row opens its form in place: a plain index in its list, or 'new' for a condition added to Active
  const openConditionEditor = (editing: { list: 'active' | 'resolved'; index: number } | 'new') => {
    const name = editing === 'new' ? '' : editing.list === 'active' ? (userData.conditions || [])[editing.index] : (userData.pastConditions || [])[editing.index];
    setConditionDraft(name || '');
    setEditingCondition(editing);
  };
  const saveCondition = async () => {
    const name = conditionDraft.trim();
    if (!name) {
      Alert.alert('Add a condition', 'Enter the condition name.');
      return;
    }
    const active = [...(userData.conditions || [])];
    const resolved = [...(userData.pastConditions || [])];
    if (editingCondition === 'new') active.push(name);
    else if (editingCondition) (editingCondition.list === 'active' ? active : resolved)[editingCondition.index] = name;
    await patchUserData({ conditions: active, pastConditions: resolved });
    setEditingCondition(null);
  };
  // Moves a condition to the other list, or removes it. The name typed in the form is kept.
  const moveCondition = async (from: 'active' | 'resolved', index: number, to: 'active' | 'resolved' | 'delete', name?: string) => {
    const active = [...(userData.conditions || [])];
    const resolved = [...(userData.pastConditions || [])];
    const [item] = (from === 'active' ? active : resolved).splice(index, 1);
    if (to === 'active') active.push(name || item);
    if (to === 'resolved') resolved.push(name || item);
    await patchUserData({ conditions: active, pastConditions: resolved });
    setEditingCondition(null);
  };
  const moveEditingCondition = (to: 'active' | 'resolved' | 'delete') => {
    if (editingCondition === null || editingCondition === 'new') return;
    return moveCondition(editingCondition.list, editingCondition.index, to, conditionDraft.trim());
  };
  const renderConditionForm = () => {
    const existing = editingCondition !== null && editingCondition !== 'new';
    const markAs = existing && editingCondition.list === 'active' ? 'resolved' : 'active';
    return (
      <InlineFieldsForm
        fields={[{ key: 'name', label: 'Condition', placeholder: 'e.g. Type 2 diabetes' }]}
        values={{ name: conditionDraft }}
        onChange={(_, value) => setConditionDraft(value)}
        onSave={saveCondition}
        onCancel={() => setEditingCondition(null)}
        extraLabel={existing ? `Mark as ${markAs}` : undefined}
        onExtra={existing ? () => moveEditingCondition(markAs) : undefined}
        onDelete={existing ? () => moveEditingCondition('delete') : undefined}
        deleteLabel="Delete condition"
      />
    );
  };

  // Opens the pharmacy editor once the Pharmacy page has closed
  // Saves a pharmacy found by search as the preferred pharmacy
  const usePharmacy = (pharmacy: { name: string; address: string; phone?: string }) =>
    patchUserData({ pharmacy: { name: pharmacy.name, address: pharmacy.address, phone: pharmacy.phone ?? '' } });
  const openPharmacyEditor = () => {
    setPharmacyDraft({ name: userData.pharmacy?.name || '', address: userData.pharmacy?.address || '', phone: userData.pharmacy?.phone || '' });
    setEditingPharmacy(true);
  };
  const savePharmacy = async () => {
    const name = pharmacyDraft.name.trim();
    const phone = pharmacyDraft.phone.trim();
    if (!name || !phone) {
      Alert.alert('Add details', 'Enter the pharmacy name and phone number.');
      return;
    }
    await patchUserData({ pharmacy: { name, address: pharmacyDraft.address.trim(), phone } });
    setEditingPharmacy(false);
  };
  const deletePharmacy = async () => {
    await patchUserData({ pharmacy: undefined });
    setEditingPharmacy(false);
  };
  const openContactEditor = (index: number | 'new') => {
    const contact = index === 'new' ? undefined : (userData.emergencyContacts || [])[index];
    setEmergencyDraft({ name: contact?.name || '', relationship: contact?.relationship || '', phone: contact?.phone || '' });
    setEditingContact(index);
  };
  const saveEmergencyContact = async () => {
    const name = emergencyDraft.name.trim();
    const phone = emergencyDraft.phone.trim();
    if (!name || !phone) {
      Alert.alert('Add details', 'Enter the contact name and phone number.');
      return;
    }
    const contact = { name, relationship: emergencyDraft.relationship.trim(), phone };
    const contacts = userData.emergencyContacts || [];
    const updated = editingContact === 'new' ? [...contacts, contact] : contacts.map((c, idx) => (idx === editingContact ? contact : c));
    await patchUserData({ emergencyContacts: updated });
    setEditingContact(null);
  };
  const deleteEmergencyContact = async () => {
    if (typeof editingContact !== 'number') return;
    await patchUserData({ emergencyContacts: (userData.emergencyContacts || []).filter((_, idx) => idx !== editingContact) });
    setEditingContact(null);
  };
  const renderContactForm = () => (
    <InlineFieldsForm
      fields={[
        { key: 'name', label: 'Name', placeholder: 'e.g. Jane Doe' },
        { key: 'relationship', label: 'Relationship', placeholder: 'e.g. Spouse', optional: true },
        { key: 'phone', label: 'Phone', placeholder: 'e.g. (555) 123-4567', keyboardType: 'phone-pad' },
      ]}
      values={emergencyDraft}
      onChange={(key, value) => setEmergencyDraft((draft) => ({ ...draft, [key]: value }))}
      onSave={saveEmergencyContact}
      onCancel={() => setEditingContact(null)}
      onDelete={typeof editingContact === 'number' ? deleteEmergencyContact : undefined}
      deleteLabel="Delete contact"
    />
  );
  // Opens the card scan once the Insurance page has closed
  const openInsuranceScan = () => openEditorFromPage(() => setInsuranceScanOpen(true));
  // Adds a plan read from a card
  const saveScannedInsurance = async (card: CardDetails) => {
    await patchUserData({
      insurances: [
        ...(userData.insurances || []),
        { provider: card.provider, memberId: card.memberId, groupNumber: card.groupNumber || undefined, plan: card.plan || undefined, payerPhone: card.payerPhone || undefined },
      ],
    });
    setInsuranceScanOpen(false);
  };
  const openInsuranceEditor = (index: number | 'new') => {
    const item = index === 'new' ? undefined : (userData.insurances || [])[index];
    setInsuranceDraft({ provider: item?.provider || '', memberId: item?.memberId || '', groupNumber: item?.groupNumber || '' });
    setEditingInsurance(index);
  };
  const saveInsurance = async () => {
    const provider = insuranceDraft.provider.trim();
    if (!provider) {
      Alert.alert('Add a provider', 'Enter the insurance provider.');
      return;
    }
    const values = { provider, memberId: insuranceDraft.memberId.trim(), groupNumber: insuranceDraft.groupNumber.trim() };
    const insurances = userData.insurances || [];
    // An existing plan keeps the fields that aren't in this form, such as the plan name and payer phone
    const updated = editingInsurance === 'new' ? [...insurances, values] : insurances.map((item, idx) => (idx === editingInsurance ? { ...item, ...values } : item));
    await patchUserData({ insurances: updated });
    setEditingInsurance(null);
  };
  const deleteInsurance = async () => {
    if (typeof editingInsurance !== 'number') return;
    await patchUserData({ insurances: (userData.insurances || []).filter((_, idx) => idx !== editingInsurance) });
    setEditingInsurance(null);
  };
  const renderInsuranceForm = () => (
    <InlineFieldsForm
      fields={[
        { key: 'provider', label: 'Provider', placeholder: 'e.g. Blue Cross Blue Shield' },
        { key: 'memberId', label: 'Member ID', placeholder: 'e.g. BCX123456789' },
        { key: 'groupNumber', label: 'Group number', placeholder: 'e.g. GRP789', optional: true },
      ]}
      values={insuranceDraft}
      onChange={(key, value) => setInsuranceDraft((draft) => ({ ...draft, [key]: value }))}
      onSave={saveInsurance}
      onCancel={() => setEditingInsurance(null)}
      onDelete={typeof editingInsurance === 'number' ? deleteInsurance : undefined}
      deleteLabel="Delete insurance"
    />
  );

  // Vaccines: a form opens inside the row that was tapped. Rows are "completed-<n>", "recommended-<n>", or "new".
  const safeDate = (text: string) => (/^\d{4}-\d{2}-\d{2}$/.test(text) ? dateFromKey(text) : new Date());
  const openVaccineForm = (key: string, values: VaccineFormValues) => {
    setVaccineForm(values);
    setOpenVaccine({ key });
  };
  const toggleCompletedVaccine = (index: number) => {
    const key = `completed-${index}`;
    if (openVaccine?.key === key) return setOpenVaccine(null);
    const vaccine = (userData.vaccines || [])[index];
    openVaccineForm(key, { name: vaccine.name, date: safeDate(vaccine.date), nextDue: vaccine.nextDue ? safeDate(vaccine.nextDue) : null });
  };
  const toggleNewVaccine = (key: string, name = '') => {
    if (openVaccine?.key === key) return setOpenVaccine(null);
    openVaccineForm(key, blankVaccineForm(name));
  };
  const closeVaccine = () => setOpenVaccine(null);
  const saveVaccine = async () => {
    const name = vaccineForm.name.trim();
    if (!name || !vaccineForm.date) {
      Alert.alert('Add details', 'Enter the vaccine name and the date it was given.');
      return;
    }
    const entry = { name, date: dateKey(vaccineForm.date), nextDue: vaccineForm.nextDue ? dateKey(vaccineForm.nextDue) : undefined };
    const list = [...(userData.vaccines || [])];
    const match = openVaccine?.key.match(/^completed-(\d+)$/);
    if (match) list[parseInt(match[1], 10)] = entry;
    else list.push(entry);
    await patchUserData({ vaccines: list });
    setOpenVaccine(null);
  };
  const deleteVaccine = async () => {
    const match = openVaccine?.key.match(/^completed-(\d+)$/);
    if (!match) return;
    const index = parseInt(match[1], 10);
    await patchUserData({ vaccines: (userData.vaccines || []).filter((_, i) => i !== index) });
    setOpenVaccine(null);
  };

  // Screenings: a form opens inside the row that was tapped. Rows are "completed-<n>", "recommended-<n>", or "new".
  const openScreeningForm = (key: string, values: ScreeningFormValues) => {
    setScreeningForm(values);
    setOpenScreening({ key });
  };
  const toggleCompletedScreening = (index: number) => {
    const key = `completed-${index}`;
    if (openScreening?.key === key) return setOpenScreening(null);
    const screening = (userData.screenings || [])[index];
    openScreeningForm(key, { type: screening.type, date: dateFromText(screening.date) ?? new Date(), notes: screening.notes || '' });
  };
  const toggleNewScreening = (key: string, type = '') => {
    if (openScreening?.key === key) return setOpenScreening(null);
    openScreeningForm(key, blankScreeningForm(type));
  };
  const closeScreening = () => setOpenScreening(null);
  const saveScreening = async () => {
    const type = screeningForm.type.trim();
    if (!type || !screeningForm.date) {
      Alert.alert('Add details', 'Enter the screening and the date it was done.');
      return;
    }
    const entry = { type, date: textFromDate(screeningForm.date), notes: screeningForm.notes.trim() || undefined };
    const list = [...(userData.screenings || [])];
    const match = openScreening?.key.match(/^completed-(\d+)$/);
    if (match) list[parseInt(match[1], 10)] = entry;
    else list.push(entry);
    await patchUserData({ screenings: list });
    setOpenScreening(null);
  };
  const deleteScreening = async () => {
    const match = openScreening?.key.match(/^completed-(\d+)$/);
    if (!match) return;
    const index = parseInt(match[1], 10);
    await patchUserData({ screenings: (userData.screenings || []).filter((_, i) => i !== index) });
    setOpenScreening(null);
  };

  // Medical history: an entry's form opens inside its row. Rows are "surgery-<n>", "family-<n>", "hospital-<n>",
  // "pregnancy-<n>", or "<kind>-new" for a new entry.
  const familyGroups = Object.entries(
    (userData.familyHistory || []).reduce<Record<string, { key: string; member: string; items: { condition: string; index: number }[] }>>((groups, item, index) => {
      const key = item.familyMember.trim().toLowerCase();
      if (!groups[key]) groups[key] = { key, member: item.familyMember, items: [] };
      groups[key].items.push({ condition: item.condition, index });
      return groups;
    }, {})
  ).map(([, group]) => group);
  const pregnancyList = (userData.pregnancies || [])
    .map((pregnancy, index) => ({ pregnancy, index }))
    .sort((a, b) => Number(b.pregnancy.year) - Number(a.pregnancy.year));
  const pregnancyCount = (userData.pregnancies || []).length;
  const birthCount = (userData.pregnancies || []).filter((p) => isBirthOutcome(p.outcome)).length;
  const lossCount = (userData.pregnancies || []).filter((p) => isLossOutcome(p.outcome)).length;
  // With no pregnancies recorded, the summary greys out; it still opens for adding
  const obUnused = pregnancyCount === 0;

  const patchHistoryDraft = (patch: Partial<HistoryDraft>) => setHistoryDraft((draft) => ({ ...draft, ...patch }));
  const closeHistory = () => setOpenHistory(null);

  // Opens the entry's form under its row, or closes it if it's already open
  const startHistory = (kind: 'surgery' | 'family' | 'hospital' | 'pregnancy', index: number | null) => {
    const key = `${kind}-${index === null ? 'new' : index}`;
    if (openHistory?.key === key) return setOpenHistory(null);
    let values = blankHistoryDraft();
    if (index !== null && kind === 'surgery') {
      const item = (userData.surgicalHistory || [])[index];
      values = { ...values, name: item.surgeryName, date: historyDateFrom(item.date) };
    } else if (index !== null && kind === 'hospital') {
      const item = (userData.hospitalizations || [])[index];
      values = { ...values, name: item.reason, date: historyDateFrom(item.date) };
    } else if (index !== null && kind === 'family') {
      const item = (userData.familyHistory || [])[index];
      values = { ...values, member: item.familyMember, customMember: !FAMILY_MEMBERS.includes(item.familyMember), condition: item.condition };
    } else if (index !== null && kind === 'pregnancy') {
      const item = (userData.pregnancies || [])[index];
      values = { ...values, year: item.year, outcome: item.outcome, complications: [...item.complications] };
    }
    setHistoryDraft(values);
    setOpenHistory({ key });
  };

  const historyIndex = (kind: string): number | null => {
    const match = openHistory?.key.match(new RegExp(`^${kind}-(\\d+)$`));
    return match ? parseInt(match[1], 10) : null;
  };

  const saveHistory = async () => {
    const kind = (openHistory?.key ?? '').split('-')[0];
    const index = historyIndex(kind);
    const draft = historyDraft;
    if (kind === 'surgery') {
      if (!draft.name.trim()) return Alert.alert('Add a name', 'Enter the surgery.');
      const entry = { surgeryName: draft.name.trim(), date: formatHistoryDate(draft.date) };
      const list = [...(userData.surgicalHistory || [])];
      if (index !== null) list[index] = entry;
      else list.push(entry);
      await patchUserData({ surgicalHistory: list });
    } else if (kind === 'family') {
      if (!draft.member.trim() || !draft.condition.trim()) return Alert.alert('Fill in the fields', 'Enter who it is and the condition.');
      const entry = { familyMember: draft.member.trim(), condition: draft.condition.trim() };
      const list = [...(userData.familyHistory || [])];
      if (index !== null) list[index] = entry;
      else list.push(entry);
      await patchUserData({ familyHistory: list });
    } else if (kind === 'hospital') {
      if (!draft.name.trim()) return Alert.alert('Add a reason', 'Enter the reason for the hospital stay.');
      const entry = { reason: draft.name.trim(), date: formatHistoryDate(draft.date) };
      const list = [...(userData.hospitalizations || [])];
      if (index !== null) list[index] = entry;
      else list.push(entry);
      await patchUserData({ hospitalizations: list });
    } else if (kind === 'pregnancy') {
      const yearNumber = parseInt(draft.year, 10);
      if (!/^\d{4}$/.test(draft.year) || yearNumber < 1900 || yearNumber > new Date().getFullYear()) {
        return Alert.alert('Check the year', 'Enter the four-digit year of the pregnancy.');
      }
      if (!draft.outcome) return Alert.alert('Choose how it ended', 'Pick one of the options.');
      const entry = { year: draft.year, outcome: draft.outcome, complications: draft.complications };
      const list = [...(userData.pregnancies || [])];
      if (index !== null) list[index] = entry;
      else list.push(entry);
      await patchUserData({ pregnancies: list });
    }
    setOpenHistory(null);
  };

  const deleteHistory = async () => {
    const kind = (openHistory?.key ?? '').split('-')[0];
    const index = historyIndex(kind);
    if (index === null) return;
    if (kind === 'surgery') await patchUserData({ surgicalHistory: (userData.surgicalHistory || []).filter((_, i) => i !== index) });
    else if (kind === 'family') await patchUserData({ familyHistory: (userData.familyHistory || []).filter((_, i) => i !== index) });
    else if (kind === 'hospital') await patchUserData({ hospitalizations: (userData.hospitalizations || []).filter((_, i) => i !== index) });
    else if (kind === 'pregnancy') await patchUserData({ pregnancies: (userData.pregnancies || []).filter((_, i) => i !== index) });
    setOpenHistory(null);
  };


  // A blank appointment for the form editor, opened from the Appointments page
  const openNewAppointment = () => {
    setEditData(userData);
    setAppointmentDate(new Date());
    setAppointmentTime(defaultAppointmentTime());
    setAppointmentDoctorName('');
    setAppointmentSpecialty('');
    setEditingAppointmentId(null);
    openEditorFromPage(() => setEditingSection('appointments'));
  };

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
      setEpicAppointmentsForReminders(appts);
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

  // Epic medications the patient has removed here. They stay in Epic and are only hidden in this app.
  const visibleEpicMedications = epicMedications.filter((m) => !epicOverrides[`medication:${m.id}`]?.hidden);
  const removeEpicMedication = (key: string, name: string) => {
    Alert.alert('Remove medication?', `${name} will be hidden in this app. Epic's record is not changed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => setEpicOverrides(await ehrService.saveOverride(key, { ...epicOverrides[key], hidden: true })),
      },
    ]);
  };

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
  // The newest reading, shown at the top of the blood pressure screen
  const latestBp = bpList[0];
  // Normal under 120/80, elevated 120–129 with diastolic under 80, high otherwise
  const bpStatus = (r: { systolic: number; diastolic: number }) =>
    r.systolic >= 130 || r.diastolic >= 80 ? 'High' : r.systolic >= 120 ? 'Elevated' : 'Normal';

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
      if (editingSection === 'appointments') {
        const dateTime = formatAppointmentDateTime(appointmentDate, appointmentTime);
        let updatedAppointments;

        if (editingAppointmentId) {
          // Update existing appointment
          updatedAppointments = (editData.appointments || []).map(apt =>
            apt.id === editingAppointmentId
              ? { ...apt, dateTime, doctorName: appointmentDoctorName, specialty: appointmentSpecialty }
              : apt
          );
          setEditingAppointmentId(null);
        } else {
          // Add new appointment
          const newAppointment = {
            id: String(Date.now()),
            dateTime,
            doctorName: appointmentDoctorName,
            specialty: appointmentSpecialty,
          };
          updatedAppointments = [...(editData.appointments || []), newAppointment];
        }

        await patchUserData({ appointments: updatedAppointments });
        setAppointmentDoctorName('');
        setAppointmentSpecialty('');
      } else {
        // Save only what differs from the current profile, so nothing else is written back
        const changes = Object.fromEntries(
          Object.entries(editData).filter(([key, value]) => (userData as any)[key] !== value)
        );
        await patchUserData(changes);
      }
      setEditingSection(null);
      Alert.alert('Success', 'Changes saved');
    } catch (error) {
      Alert.alert('Error', 'Failed to save changes');
    }
  };

  const handleCancel = () => {
    setEditData(userData);
    setEditingSection(null);
    setMedicationPhoto(null);
    setEditingAppointmentId(null);
    setAppointmentDoctorName('');
    setAppointmentSpecialty('');
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
    if (!medicationPhotoUri) {
      Alert.alert('Error', 'Please select a photo');
      return;
    }

    setAnalyzingMedication(true);
    try {
      let imageUri = medicationPhotoUri;
      if (medicationPhotoMediaType.includes('heic') || medicationPhotoMediaType.includes('heif')) {
        imageUri = await convertHeicToJpeg(medicationPhotoUri);
      }
      const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: FileSystem.EncodingType.Base64 });
      const result = await cameraService.analyzeMedicationLabel([base64]);
      if (!result.success) throw new Error(result.error || 'Could not read the label');

      const label = result.data;
      setLabelDraft({
        name: label.name,
        dose: label.dose,
        howOften: label.howOften,
        reminderTimes: label.reminderTimes.length > 0 ? label.reminderTimes : defaultTimes(label.timesPerDay),
        isOtc: label.isOtc,
        notes: label.notes,
        confidence: label.confidence,
      });
      setMedicationInputMode('label-review');
    } catch (error) {
      Alert.alert('Could not read that label', error instanceof Error ? error.message : String(error));
    } finally {
      setAnalyzingMedication(false);
    }
  };

  // Saves a checked label: the name joins the list, and its dose, how often, and reminder times are kept
  const saveLabelDraft = async (draft: MedicationDraft) => {
    const key = draft.isOtc ? 'otcMedications' : 'prescriptionMedications';
    const list = [...((userData as any)[key] || [])];
    if (!list.some((n: string) => n.trim().toLowerCase() === draft.name.toLowerCase())) list.push(draft.name);

    const history = [...(userData.medicationHistory || [])];
    const fields = {
      dose: draft.dose || undefined,
      frequency: draft.howOften || undefined,
      reminderTimes: draft.reminderTimes.length > 0 ? draft.reminderTimes : undefined,
    };
    const activeIdx = history.findIndex((m) => m.name.trim().toLowerCase() === draft.name.toLowerCase() && !m.endDate);
    if (activeIdx >= 0) history[activeIdx] = { ...history[activeIdx], name: draft.name, ...fields };
    else history.push({ name: draft.name, ...fields, startDate: new Date().toISOString() });

    const patch: any = { medicationHistory: history };
    patch[key] = list;
    await patchUserData(patch);
    setLabelDraft(null);
    setMedicationPhotoUri(null);
    setMedicationInputMode(null);
  };

  const handleMedicationTextSubmit = async () => {
    const name = medForm.name.trim();
    if (!name || !medicationType) {
      Alert.alert('Add a name', 'Enter the medication name.');
      return;
    }

    try {
      const key = medListKey(medicationType);
      const list = [...((userData as any)[key] || [])];
      if (!list.some((n: string) => n.trim().toLowerCase() === name.toLowerCase())) list.push(name);

      const history = [...(userData.medicationHistory || [])];
      const fields = medicationFieldsFromForm(medForm);
      const activeIdx = history.findIndex((m) => m.name.trim().toLowerCase() === name.toLowerCase() && !m.endDate);
      if (activeIdx >= 0) history[activeIdx] = { ...history[activeIdx], name, ...fields };
      else history.push({ name, ...fields });

      const patch: any = { medicationHistory: history };
      patch[key] = list;
      await patchUserData(patch);

      setMedicationInputMode(null);
      setMedicationType(null);
      setMedForm(blankMedicationForm());
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
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to delete');
    }
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
  const openMedEdit = (kind: 'prescription' | 'otc', index: number) => {
    const name = ((userData as any)[medListKey(kind)] || [])[index] ?? '';
    const active = (userData.medicationHistory || []).find((m) => m.name === name && !m.endDate);
    setMedForm(formFromMedication(name, active));
    setEditingMed({ kind, index });
  };
  const saveMedEdit = async () => {
    if (!editingMed) return;
    const newName = medForm.name.trim();
    if (!newName) {
      Alert.alert('Add a name', 'Enter the medication name.');
      return;
    }
    const key = medListKey(editingMed.kind);
    const list = [...((userData as any)[key] || [])];
    const oldName = list[editingMed.index];
    list[editingMed.index] = newName;
    const history = [...(userData.medicationHistory || [])];
    const details = medicationFieldsFromForm(medForm);
    const activeIdx = history.findIndex((m) => m.name === oldName && !m.endDate);
    if (activeIdx >= 0) history[activeIdx] = { ...history[activeIdx], name: newName, ...details };
    else history.push({ name: newName, ...details });
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
    new Set([...(userData.prescriptionMedications || []), ...visibleEpicMedications.map((m) => m.name)]).size +
    (userData.otcMedications || []).length;
  const allergyNames = [...new Set([...(userData.allergies || []), ...epicAllergies.map((a) => a.allergen)])];
  const allergyValue = allergyNames.length === 1 ? allergyNames[0] : String(allergyNames.length);
  const conditionCount = new Set([...(userData.conditions || []), ...currentEpicConditions.map((c) => c.name)]).size;
  const historyCount =
    (userData.surgicalHistory || []).length +
    (userData.familyHistory || []).length +
    (userData.pregnancies || []).length +
    (userData.hospitalizations || []).length;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  // Read the saved text with the same parser as reminders, which handles the date formats the app saves
  const upcoming = [
    ...(userData.appointments || []).map((a) => appointmentMoment(a.dateTime)?.at),
    ...epicAppointments.map((a) => (a.start ? new Date(a.start) : undefined)),
  ]
    .filter((d): d is Date => !!d && !isNaN(d.getTime()) && d.getTime() >= todayStart.getTime())
    .sort((a, b) => a.getTime() - b.getTime());
  const appointmentValue = upcoming.length
    ? `Next ${upcoming[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : 'Next: none';
  // Manual and Epic visits split into upcoming and previous by date. Each list is sorted so the nearest visit comes first.
  const appointmentItems = [
    ...(userData.appointments || []).map((apt) => ({ key: `manual-${apt.id}`, kind: 'manual' as const, apt, when: appointmentMoment(apt.dateTime)?.at })),
    ...epicAppointments.map((apt) => ({ key: `epic-${apt.id}`, kind: 'epic' as const, apt, when: apt.start ? new Date(apt.start) : undefined })),
  ].flatMap((item) => (item.when && !isNaN(item.when.getTime()) ? [{ ...item, when: item.when }] : []));
  const upcomingItems = appointmentItems
    .filter((item) => item.when.getTime() >= todayStart.getTime())
    .sort((a, b) => a.when.getTime() - b.when.getTime());
  const previousItems = appointmentItems
    .filter((item) => item.when.getTime() < todayStart.getTime())
    .sort((a, b) => b.when.getTime() - a.when.getTime());
  const visibleAppointments = appointmentTab === 'upcoming' ? upcomingItems : previousItems;
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
      setBirthdayPick(new Date(yearStr || 1990, monthIdx >= 0 ? monthIdx : 0, dayStr || 1, 12));
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

  // Height is stored as 5'10"; the form starts from the saved height
  const openHeightEditor = () => {
    const match = (userData.height || '').match(/(\d+)\D+(\d+)/);
    setHeightFeet(match ? match[1] : '');
    setHeightInches(match ? match[2] : '');
    setEditingSection('height');
  };
  const saveHeight = async () => {
    const feet = parseInt(heightFeet, 10);
    const inches = parseInt(heightInches, 10);
    if (!/^\d+$/.test(heightFeet.trim()) || !/^\d+$/.test(heightInches.trim()) || feet < 3 || feet > 8 || inches < 0 || inches > 11) {
      Alert.alert('Check the height', 'Enter feet from 3 to 8, and inches from 0 to 11.');
      return;
    }
    await patchUserData({ height: `${feet}'${inches}"` });
    setEditingSection(null);
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
              onPress={openHeightEditor}
            />

            <View style={styles.divider} />

            {/* Weight */}
            <VitalRow
              icon="scale-bathroom"
              label="Weight"
              value={weightNow ? `${weightNow.value} lbs` : userData.weight?.includes('lbs') ? userData.weight : `${userData.weight} lbs`}
              onPress={() => setVitalDetail('weight')}
            />

            <View style={styles.divider} />

            {/* Blood Pressure */}
            <VitalRow
              icon="heart-pulse"
              label="Blood pressure"
              value={bloodPressureNow ? `${bloodPressureNow.systolic}/${bloodPressureNow.diastolic} mmHg` : userData.vitals?.bloodPressure || '—'}
              onPress={() => setVitalDetail('bp')}
            />

            <View style={styles.divider} />

            {/* Pulse and respirations, from Epic */}
            <VitalRow icon="pulse" label="Pulse" value={userData.vitals?.pulse || '—'} />

            <View style={styles.divider} />

            <VitalRow icon="lungs" label="Respirations" value={userData.vitals?.respirations || '—'} />

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
            <VitalRow icon="doctor" label="Find a doctor" value="" onPress={() => setOpenPage('find-doctor')} />
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
              {(userData.prescriptionMedications && userData.prescriptionMedications.length > 0) || visibleEpicMedications.length > 0 ? (
                <>
                  {/* Manual medications */}
                  {userData.prescriptionMedications && userData.prescriptionMedications.map((med, idx) => new Set(visibleEpicMedications.map((m) => m.name.trim().toLowerCase())).has(med.trim().toLowerCase()) ? null : (
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
                  {visibleEpicMedications.map((med, index) => {
                    const key = `medication:${med.id}`;
                    const name = epicText(key, String(med.name ?? ''), 'primary');
                    const dosage = epicText(key, String(med.dosage ?? ''), 'secondary');
                    return (
                      <View key={`epic-med-${index}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 }}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                            <Text style={styles.medRowName}>{name}</Text>
                            <EpicBadge />
                          </View>
                          {dosage ? <Text style={styles.medRowDetail}>{dosage}</Text> : null}
                        </View>
                        {showMedicationControls && (
                          <TouchableOpacity onPress={() => removeEpicMedication(key, name)}>
                            <Text style={[styles.editLink, { color: '#FF3B30' }]}>Remove</Text>
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <Text style={styles.healthItem}>{[med.name, med.dose].filter(Boolean).join(' · ')}</Text>
                      {med.source === 'epic' && <EpicBadge />}
                    </View>
                    <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                      {[med.startDate && `Started ${shortDate(med.startDate)}`, med.endDate && `Stopped ${shortDate(med.endDate)}`].filter(Boolean).join(' · ')}
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

      <DetailModal visible={openPage === 'conditions'} title="Conditions" onClose={closeDetail} onDismiss={runPendingEditor}>
        <Section title="Active">
          <ListCard>
            {[
              ...activeConditionRows.map(({ condition, index }) => (
                editingCondition !== null && editingCondition !== 'new' && editingCondition.list === 'active' && editingCondition.index === index ? (
                  <React.Fragment key={'active-' + index}>{renderConditionForm()}</React.Fragment>
                ) : (
                  <ListRow key={'active-' + index} icon="stethoscope" label={condition} onPress={() => openConditionEditor({ list: 'active', index })} />
                )
              )),
              ...currentEpicConditions.map((cond) => {
                const key = `condition:${cond.id}`;
                const name = epicText(key, cond.name, 'primary');
                const detail = epicText(key, cond.status ? `Status: ${cond.status}` : '', 'secondary');
                return (
                  <ListRow
                    key={'epic-' + cond.id}
                    icon="stethoscope"
                    label={name}
                    badge={<EpicBadge />}
                    hint={detail || undefined}
                    onPress={() => openEditorFromPage(() => openEpicEdit(key, 'condition', name, detail))}
                  />
                );
              }),
            ].map((row, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <Divider />}
                {row}
              </React.Fragment>
            ))}
            {activeConditionRows.length + currentEpicConditions.length === 0 && <Text style={styles.emptyText}>No active conditions</Text>}
            {activeConditionRows.length + currentEpicConditions.length > 0 && <Divider />}
            {editingCondition === 'new' ? (
              renderConditionForm()
            ) : (
              <ListRow icon="plus-circle-outline" label="Add condition" onPress={() => openConditionEditor('new')} />
            )}
          </ListCard>
        </Section>

        <Section title="Resolved">
          <ListCard>
            {[
              ...(userData.pastConditions || []).map((condition, index) =>
                editingCondition !== null && editingCondition !== 'new' && editingCondition.list === 'resolved' && editingCondition.index === index ? (
                  <React.Fragment key={'resolved-' + index}>{renderConditionForm()}</React.Fragment>
                ) : (
                  <ListRow key={'resolved-' + index} icon="check-circle-outline" label={condition} onPress={() => openConditionEditor({ list: 'resolved', index })} />
                )
              ),
              ...pastEpicConditions.map((cond) => (
                <ListRow
                  key={'past-epic-' + cond.id}
                  icon="check-circle-outline"
                  label={cond.name}
                  badge={<EpicBadge />}
                  hint={[cond.status && `Status: ${cond.status}`, cond.onsetDate && `Started ${onsetText(cond.onsetDate)}`].filter(Boolean).join(' · ') || undefined}
                />
              )),
            ].map((row, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <Divider />}
                {row}
              </React.Fragment>
            ))}
            {(userData.pastConditions || []).length + pastEpicConditions.length === 0 && <Text style={styles.emptyText}>No resolved conditions</Text>}
          </ListCard>
        </Section>
      </DetailModal>

      <DetailModal visible={openPage === 'find-doctor'} title="Find a doctor" onClose={closeDetail}>
        <FindDoctor
          plan={userData.insurances?.[0]?.provider || undefined}
          planName={userData.insurances?.[0]?.plan}
          payerPhone={userData.insurances?.[0]?.payerPhone}
        />
      </DetailModal>

      <DetailModal visible={openPage === 'allergies'} title="Allergies" onClose={closeDetail} onDismiss={runPendingEditor}>
        <Section title="Allergies">
          <ListCard>
            {[
              ...manualAllergyRows.map(({ allergy, index }) =>
                editingAllergy === index ? (
                  <React.Fragment key={'manual-' + index}>{renderAllergyForm()}</React.Fragment>
                ) : (
                  <ListRow key={'manual-' + index} icon="alert-outline" label={allergy} onPress={() => openAllergyEditor(index)} />
                )
              ),
              ...epicAllergies.map((allergy) => {
                const key = `allergy:${allergy.id}`;
                const allergen = epicText(key, allergy.allergen, 'primary');
                const reaction = epicText(key, allergy.reaction, 'secondary');
                return (
                  <ListRow
                    key={'epic-' + allergy.id}
                    icon="alert-outline"
                    label={allergen}
                    badge={<EpicBadge />}
                    hint={reaction ? `Reaction: ${reaction}` : undefined}
                    onPress={() => openEditorFromPage(() => openEpicEdit(key, 'allergy', allergen, reaction))}
                  />
                );
              }),
            ].map((row, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <Divider />}
                {row}
              </React.Fragment>
            ))}
            {manualAllergyRows.length + epicAllergies.length === 0 && <Text style={styles.emptyText}>No allergies added</Text>}
            {manualAllergyRows.length + epicAllergies.length > 0 && <Divider />}
            {editingAllergy === 'new' ? (
              renderAllergyForm()
            ) : (
              <ListRow icon="plus-circle-outline" label="Add allergy" onPress={() => openAllergyEditor('new')} />
            )}
          </ListCard>
        </Section>
      </DetailModal>

      <DetailModal visible={openPage === 'history'} onClose={closeDetail} title="Medical history" onDismiss={runPendingEditor}>
        <Section title="Surgeries">
          <ListCard>
            {openHistory?.key === 'surgery-new' && (
              <View style={styles.inlineForm}>
                <MedicalHistoryForm kind="surgery" values={historyDraft} onChange={patchHistoryDraft} onSave={saveHistory} onCancel={closeHistory} />
              </View>
            )}
            {(userData.surgicalHistory || []).map((surgery, index) => {
              const key = `surgery-${index}`;
              return (
                <React.Fragment key={key}>
                  {index > 0 && <Divider />}
                  {openHistory?.key === key ? (
                    <View style={styles.inlineForm}>
                      <MedicalHistoryForm kind="surgery" values={historyDraft} onChange={patchHistoryDraft} onSave={saveHistory} onCancel={closeHistory} onDelete={deleteHistory} />
                    </View>
                  ) : (
                    <ListRow icon="content-cut" label={surgery.surgeryName} value={surgery.date} onPress={() => startHistory('surgery', index)} />
                  )}
                </React.Fragment>
              );
            })}
            {(userData.surgicalHistory || []).length === 0 && openHistory?.key !== 'surgery-new' && <Text style={styles.emptyText}>No surgical history added</Text>}
            {(userData.surgicalHistory || []).length > 0 && <Divider />}
            {openHistory?.key !== 'surgery-new' && <ListRow icon="plus-circle-outline" label="Add surgery" onPress={() => startHistory('surgery', null)} />}
          </ListCard>
        </Section>

        <Section title="Family history">
          <ListCard>
            {openHistory?.key === 'family-new' && (
              <View style={styles.inlineForm}>
                <MedicalHistoryForm kind="family" values={historyDraft} onChange={patchHistoryDraft} onSave={saveHistory} onCancel={closeHistory} />
              </View>
            )}
            {familyGroups.map((group, groupIndex) => (
              <React.Fragment key={'family-group-' + group.key}>
                {groupIndex > 0 && <Divider />}
                <Text style={styles.familyPerson}>{group.member}</Text>
                {group.items.map((item) => {
                  const key = `family-${item.index}`;
                  return (
                    <React.Fragment key={key}>
                      {openHistory?.key === key ? (
                        <View style={styles.inlineForm}>
                          <MedicalHistoryForm kind="family" values={historyDraft} onChange={patchHistoryDraft} onSave={saveHistory} onCancel={closeHistory} onDelete={deleteHistory} />
                        </View>
                      ) : (
                        <ListRow icon="account-outline" label={item.condition} onPress={() => startHistory('family', item.index)} />
                      )}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            ))}
            {(userData.familyHistory || []).length === 0 && openHistory?.key !== 'family-new' && <Text style={styles.emptyText}>No family history added</Text>}
            {(userData.familyHistory || []).length > 0 && <Divider />}
            {openHistory?.key !== 'family-new' && <ListRow icon="plus-circle-outline" label="Add family history" onPress={() => startHistory('family', null)} />}
          </ListCard>
        </Section>

        <Section title="Hospitalizations">
          <ListCard>
            {openHistory?.key === 'hospital-new' && (
              <View style={styles.inlineForm}>
                <MedicalHistoryForm kind="hospitalization" values={historyDraft} onChange={patchHistoryDraft} onSave={saveHistory} onCancel={closeHistory} />
              </View>
            )}
            {(userData.hospitalizations || []).map((stay, index) => {
              const key = `hospital-${index}`;
              return (
                <React.Fragment key={key}>
                  {index > 0 && <Divider />}
                  {openHistory?.key === key ? (
                    <View style={styles.inlineForm}>
                      <MedicalHistoryForm kind="hospitalization" values={historyDraft} onChange={patchHistoryDraft} onSave={saveHistory} onCancel={closeHistory} onDelete={deleteHistory} />
                    </View>
                  ) : (
                    <ListRow icon="hospital-box-outline" label={stay.reason} value={stay.date} onPress={() => startHistory('hospital', index)} />
                  )}
                </React.Fragment>
              );
            })}
            {(userData.hospitalizations || []).length === 0 && openHistory?.key !== 'hospital-new' && <Text style={styles.emptyText}>No hospitalizations added</Text>}
            {(userData.hospitalizations || []).length > 0 && <Divider />}
            {openHistory?.key !== 'hospital-new' && <ListRow icon="plus-circle-outline" label="Add hospitalization" onPress={() => startHistory('hospital', null)} />}
          </ListCard>
        </Section>

        <Section title="Obstetric history (if applicable)">
          <ListCard>
            <View style={obUnused ? styles.greyedOut : undefined}>
              <ListRow icon="human-pregnant" label="Pregnancies" value={String(pregnancyCount)} />
              <Divider />
              <ListRow icon="baby-face-outline" label="Births" value={String(birthCount)} />
              <Divider />
              <ListRow icon="heart-outline" label="Losses" value={String(lossCount)} />
            </View>
            {openHistory?.key === 'pregnancy-new' && (
              <>
                <Divider />
                <View style={styles.inlineForm}>
                  <MedicalHistoryForm kind="pregnancy" values={historyDraft} onChange={patchHistoryDraft} onSave={saveHistory} onCancel={closeHistory} />
                </View>
              </>
            )}
            {pregnancyList.map(({ pregnancy, index }) => {
              const key = `pregnancy-${index}`;
              return (
                <React.Fragment key={key}>
                  <Divider />
                  {openHistory?.key === key ? (
                    <View style={styles.inlineForm}>
                      <MedicalHistoryForm kind="pregnancy" values={historyDraft} onChange={patchHistoryDraft} onSave={saveHistory} onCancel={closeHistory} onDelete={deleteHistory} />
                    </View>
                  ) : (
                    <ListRow
                      icon="baby-carriage"
                      label={pregnancy.outcome}
                      hint={pregnancy.complications.join(', ') || undefined}
                      value={pregnancy.year}
                      onPress={() => startHistory('pregnancy', index)}
                    />
                  )}
                </React.Fragment>
              );
            })}
            {openHistory?.key !== 'pregnancy-new' && (
              <>
                <Divider />
                <ListRow icon="plus-circle-outline" label="Add pregnancy" onPress={() => startHistory('pregnancy', null)} />
              </>
            )}
          </ListCard>
        </Section>

      </DetailModal>

      <DetailModal
        visible={openPage === 'appointments'}
        onClose={closeDetail}
        onDismiss={runPendingEditor}
      >
        <View style={styles.section}>
          {/* Appointments */}
          <View style={styles.cardWrapper}>
            <View style={styles.cardTitleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Appointments</Text>
                <Text style={styles.cardMeta}>{upcomingItems.length} upcoming · {previousItems.length} previous</Text>
              </View>
              {epicAppointments.length > 0 && (
                <TouchableOpacity onPress={loadEpicData}>
                  <Text style={styles.editLink}>Sync</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.card}>
              <View style={styles.segmentedControl}>
                {(['upcoming', 'previous'] as const).map((tab) => (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.segment, appointmentTab === tab && styles.segmentOn]}
                    onPress={() => setAppointmentTab(tab)}
                  >
                    <Text style={[styles.segmentText, appointmentTab === tab && styles.segmentTextOn]}>
                      {tab === 'upcoming' ? `Upcoming (${upcomingItems.length})` : `Previous (${previousItems.length})`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {visibleAppointments.length > 0 ? (
                visibleAppointments.map((item, idx) => (
                  <View key={item.key}>
                    {item.kind === 'manual' ? (
                      <View style={styles.appointmentItemRow}>
                        <View style={styles.appointmentItem}>
                          <Text style={styles.appointmentDate}>{item.apt.dateTime}</Text>
                          <Text style={styles.appointmentDoctor}>{item.apt.doctorName}</Text>
                          <Text style={styles.appointmentSpecialty}>{item.apt.specialty}</Text>
                        </View>
                        <TouchableOpacity onPress={() => {
                          setEditData(userData);
                          setEditingAppointmentId(item.apt.id);
                          const parts = appointmentPartsFrom(item.apt.dateTime);
                          setAppointmentDate(parts.date);
                          setAppointmentTime(parts.time);
                          setAppointmentDoctorName(item.apt.doctorName);
                          setAppointmentSpecialty(item.apt.specialty);
                          openEditorFromPage(() => setEditingSection('appointments'));
                        }}>
                          <Text style={styles.editLink}>Edit</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.appointmentItemRow}>
                        <View style={styles.appointmentItem}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                            <Text style={styles.appointmentDate}>{item.apt.date} at {item.apt.time}</Text>
                            <EpicBadge />
                          </View>
                          <Text style={styles.appointmentDoctor}>{epicText(`appointment:${item.apt.id}`, item.apt.provider, 'secondary')}</Text>
                          <Text style={styles.appointmentSpecialty}>{epicText(`appointment:${item.apt.id}`, item.apt.description, 'primary')}</Text>
                        </View>
                      </View>
                    )}
                    {idx < visibleAppointments.length - 1 && <View style={styles.divider} />}
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>
                  {appointmentTab === 'upcoming' ? 'No upcoming appointments' : 'No previous appointments'}
                </Text>
              )}
            </View>
          </View>


        </View>
        <AppointmentQuickAdd
          userData={userData}
          onSave={async (entries: LogEntry[]) => {
            const updated = applyLogEntries(userData, entries);
            await patchUserData({ appointments: updated.appointments });
          }}
          onEnterDetails={openNewAppointment}
        />
        <AppointmentReminderOptions
          value={userData.appointmentReminders ?? 'standard'}
          onChange={(level) => patchUserData({ appointmentReminders: level })}
        />
      </DetailModal>

      <DetailModal visible={openPage === 'screenings'} title="Health screenings" onClose={closeDetail} onDismiss={runPendingEditor}>
        <Section title="Completed">
          <ListCard>
            {openScreening?.key === 'new' && (
              <View style={styles.inlineForm}>
                <ScreeningForm values={screeningForm} onChange={(patch) => setScreeningForm((form) => ({ ...form, ...patch }))} onSave={saveScreening} onCancel={closeScreening} />
              </View>
            )}
            {(userData.screenings || []).map((screening, index) => {
              const key = `completed-${index}`;
              return (
                <React.Fragment key={key}>
                  {index > 0 && <Divider />}
                  {openScreening?.key === key ? (
                    <View style={styles.inlineForm}>
                      <ScreeningForm
                        values={screeningForm}
                        onChange={(patch) => setScreeningForm((form) => ({ ...form, ...patch }))}
                        onSave={saveScreening}
                        onCancel={closeScreening}
                        onDelete={deleteScreening}
                      />
                    </View>
                  ) : (
                    <ListRow
                      icon="clipboard-pulse-outline"
                      label={screening.type}
                      hint={screening.notes || undefined}
                      value={screening.date}
                      onPress={() => toggleCompletedScreening(index)}
                    />
                  )}
                </React.Fragment>
              );
            })}
            {(userData.screenings || []).length === 0 && openScreening?.key !== 'new' && <Text style={styles.emptyText}>No screenings added yet</Text>}
            {(userData.screenings || []).length > 0 && <Divider />}
            {openScreening?.key !== 'new' && <ListRow icon="plus-circle-outline" label="Add screening" onPress={() => toggleNewScreening('new')} />}
          </ListCard>
        </Section>

        <Section title="Recommended (USPSTF)">
          <ListCard>
            {getRecommendedScreenings().map((screening, index) => {
              const key = `recommended-${index}`;
              const isCompleted = (userData.screenings || []).some((s) =>
                s.type.toLowerCase().includes(screening.toLowerCase().split('(')[0].trim().toLowerCase())
              );
              return (
                <React.Fragment key={key}>
                  {index > 0 && <Divider />}
                  {openScreening?.key === key ? (
                    <View style={styles.inlineForm}>
                      <ScreeningForm values={screeningForm} onChange={(patch) => setScreeningForm((form) => ({ ...form, ...patch }))} onSave={saveScreening} onCancel={closeScreening} />
                    </View>
                  ) : (
                    <ListRow
                      icon={isCompleted ? 'check-circle' : 'circle-outline'}
                      label={screening}
                      hint={isCompleted ? 'Recorded' : undefined}
                      onPress={isCompleted ? undefined : () => toggleNewScreening(key, screening)}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </ListCard>
        </Section>
      </DetailModal>

      <DetailModal visible={openPage === 'vaccines'} title="Vaccines" onClose={closeDetail} onDismiss={runPendingEditor}>
        <Section title="Completed">
          <ListCard>
            {openVaccine?.key === 'new' && (
              <View style={styles.inlineForm}>
                <VaccineForm values={vaccineForm} onChange={(patch) => setVaccineForm((form) => ({ ...form, ...patch }))} onSave={saveVaccine} onCancel={closeVaccine} />
              </View>
            )}
            {(userData.vaccines || []).map((vaccine, index) => {
              const key = `completed-${index}`;
              return (
                <React.Fragment key={key}>
                  {index > 0 && <Divider />}
                  {openVaccine?.key === key ? (
                    <View style={styles.inlineForm}>
                      <VaccineForm
                        values={vaccineForm}
                        onChange={(patch) => setVaccineForm((form) => ({ ...form, ...patch }))}
                        onSave={saveVaccine}
                        onCancel={closeVaccine}
                        onDelete={deleteVaccine}
                      />
                    </View>
                  ) : (
                    <ListRow
                      icon="needle"
                      label={vaccine.name}
                      hint={vaccine.nextDue ? `Next due ${vaccine.nextDue}` : undefined}
                      value={vaccine.date}
                      onPress={() => toggleCompletedVaccine(index)}
                    />
                  )}
                </React.Fragment>
              );
            })}
            {(userData.vaccines || []).length === 0 && openVaccine?.key !== 'new' && <Text style={styles.emptyText}>No vaccines recorded</Text>}
            {(userData.vaccines || []).length > 0 && <Divider />}
            {openVaccine?.key !== 'new' && <ListRow icon="plus-circle-outline" label="Add vaccine" onPress={() => toggleNewVaccine('new')} />}
          </ListCard>
        </Section>

        <Section title="Recommended">
          <ListCard>
            {getRecommendedVaccines().map((vaccine, index) => {
              const key = `recommended-${index}`;
              const isCompleted = (userData.vaccines || []).some((v) =>
                v.name.toLowerCase().includes(vaccine.toLowerCase().split('(')[0].split('-')[0].trim().toLowerCase())
              );
              return (
                <React.Fragment key={key}>
                  {index > 0 && <Divider />}
                  {openVaccine?.key === key ? (
                    <View style={styles.inlineForm}>
                      <VaccineForm values={vaccineForm} onChange={(patch) => setVaccineForm((form) => ({ ...form, ...patch }))} onSave={saveVaccine} onCancel={closeVaccine} />
                    </View>
                  ) : (
                    <ListRow
                      icon={isCompleted ? 'check-circle' : 'circle-outline'}
                      label={vaccine}
                      hint={isCompleted ? 'Recorded' : undefined}
                      onPress={isCompleted ? undefined : () => toggleNewVaccine(key, vaccine.split('(')[0].trim())}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </ListCard>
        </Section>
      </DetailModal>

      <DetailModal visible={openPage === 'insurance'} title="Insurance" onClose={closeDetail} onDismiss={runPendingEditor}>
        <Section title="Plans">
          <ListCard>
            {(userData.insurances || []).map((insurance, idx) => (
              <React.Fragment key={'plan-' + idx}>
                {idx > 0 && <Divider />}
                {editingInsurance === idx ? (
                  renderInsuranceForm()
                ) : (
                  <ListRow
                    icon="card-account-details-outline"
                    label={insurance.provider}
                    hint={[insurance.plan, insurance.memberId && `Member ID ${insurance.memberId}`, insurance.groupNumber && `Group ${insurance.groupNumber}`].filter(Boolean).join(' · ') || undefined}
                    onPress={() => openInsuranceEditor(idx)}
                  />
                )}
              </React.Fragment>
            ))}
            {(userData.insurances || []).length === 0 && <Text style={styles.emptyText}>Scan your insurance card to add your plan</Text>}
            {(userData.insurances || []).length > 0 && <Divider />}
            {editingInsurance === 'new' ? (
              renderInsuranceForm()
            ) : (
              <>
                <ListRow icon="card-account-details-outline" label="Scan insurance card" onPress={openInsuranceScan} />
                <Divider />
                <ListRow icon="pencil-outline" label="Enter details by hand" onPress={() => openInsuranceEditor('new')} />
              </>
            )}
          </ListCard>
        </Section>
      </DetailModal>
      <DetailModal visible={openPage === 'pharmacy'} title="Pharmacy" onClose={closeDetail} onDismiss={runPendingEditor}>
        <Section title="Preferred pharmacy">
          <ListCard>
            {editingPharmacy ? (
              <InlineFieldsForm
                fields={[
                  { key: 'name', label: 'Pharmacy name', placeholder: 'e.g. CVS on Main Street' },
                  { key: 'address', label: 'Address', placeholder: 'e.g. 12 Main Street', optional: true },
                  { key: 'phone', label: 'Phone', placeholder: 'e.g. (555) 123-4567', keyboardType: 'phone-pad' },
                ]}
                values={pharmacyDraft}
                onChange={(key, value) => setPharmacyDraft((draft) => ({ ...draft, [key]: value }))}
                onSave={savePharmacy}
                onCancel={() => setEditingPharmacy(false)}
                onDelete={userData.pharmacy ? deletePharmacy : undefined}
                deleteLabel="Remove pharmacy"
              />
            ) : userData.pharmacy ? (
              <ListRow
                icon="pill"
                label={userData.pharmacy.name}
                hint={[userData.pharmacy.address, userData.pharmacy.phone].filter(Boolean).join(' · ') || undefined}
                onPress={openPharmacyEditor}
              />
            ) : (
              <ListRow icon="plus-circle-outline" label="Add pharmacy" onPress={openPharmacyEditor} />
            )}
          </ListCard>
        </Section>
        <FindPharmacy onUse={usePharmacy} />
      </DetailModal>
      <DetailModal visible={openPage === 'emergency'} title="Emergency contacts" onClose={closeDetail} onDismiss={runPendingEditor}>
        <Section title="Contacts">
          <ListCard>
            {(userData.emergencyContacts || []).map((contact, idx) => (
              <React.Fragment key={'contact-' + idx}>
                {idx > 0 && <Divider />}
                {editingContact === idx ? (
                  renderContactForm()
                ) : (
                  <ListRow
                    icon="phone-outline"
                    label={contact.name}
                    hint={[contact.relationship, contact.phone].filter(Boolean).join(' · ') || undefined}
                    onPress={() => openContactEditor(idx)}
                  />
                )}
              </React.Fragment>
            ))}
            {(userData.emergencyContacts || []).length === 0 && <Text style={styles.emptyText}>No emergency contacts added</Text>}
            {(userData.emergencyContacts || []).length > 0 && <Divider />}
            {editingContact === 'new' ? (
              renderContactForm()
            ) : (
              <ListRow icon="plus-circle-outline" label="Add contact" onPress={() => openContactEditor('new')} />
            )}
          </ListCard>
        </Section>
      </DetailModal>

      {/* Edit one medication */}
      <DetailPage visible={editingMed !== null} title="Edit medication" onClose={() => setEditingMed(null)}>
        <View style={styles.medFormWrap}>
          <MedicationForm value={medForm} onChange={(patch) => setMedForm((form) => ({ ...form, ...patch }))} />
        </View>

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
              {latestBp ? (
                <View style={styles.latestBpCard}>
                  <Text style={styles.latestBpLabel}>Latest</Text>
                  <Text style={styles.latestBpValue}>
                    {latestBp.systolic}/{latestBp.diastolic} <Text style={styles.latestBpUnit}>mmHg</Text>
                  </Text>
                  <Text style={styles.readingDate}>{formatReadingDate(latestBp.date)} · {bpStatus(latestBp)}</Text>
                </View>
              ) : (
                <Text style={styles.detailCurrent}>No reading yet</Text>
              )}
              {bpHint ? <Text style={styles.vitalHint}>{bpHint}</Text> : null}

              {bpSorted.length > 0 && (
                <>
                  <Text style={styles.vitalChartLabel}>Last {Math.min(20, bpSorted.length)} readings</Text>
                  <BloodPressureChart points={bpSorted.slice(-20)} />
                </>
              )}

              <Text style={styles.epicEditLabel}>All readings</Text>
              <Text style={styles.sourceNote}>
                Hold a reading to delete it. Normal values from MedlinePlus (National Library of Medicine).
              </Text>
              {bpList.length === 0 && <Text style={styles.emptyText}>No readings saved yet.</Text>}
              {bpList.map((r) => (
                <TouchableOpacity
                  key={`b-${r.index}`}
                  style={styles.readingRow}
                  onLongPress={() => deleteBpReading(r.index)}
                  delayLongPress={400}
                >
                  <View>
                    <Text style={styles.readingValue}>{r.systolic}/{r.diastolic} mmHg</Text>
                    <Text style={styles.readingDate}>{formatReadingDate(r.date)} · {bpStatus(r)}</Text>
                  </View>
                </TouchableOpacity>
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
            <DateWheel
              label="Date"
              value={dateFromText(newReadingDate)}
              onChange={(picked) => setNewReadingDate(textFromDate(picked))}
              maximumDate={new Date()}
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
            <DateWheel
              label="Birthday"
              value={birthdayPick}
              onChange={setBirthdayPick}
              maximumDate={new Date()}
            />

            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => {
                  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                  const formattedBirthday = `${months[birthdayPick.getMonth()]} ${birthdayPick.getDate()}, ${birthdayPick.getFullYear()}`;
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
      <FieldFormEditor
        visible={editingSection === 'height'}
        title="height"
        isEditing
        fields={[
          { key: 'feet', label: 'Feet', placeholder: 'e.g. 5', keyboardType: 'number-pad' },
          { key: 'inches', label: 'Inches', placeholder: 'e.g. 10', keyboardType: 'number-pad' },
        ]}
        values={{ feet: heightFeet, inches: heightInches }}
        onChange={(key, value) => {
          if (key === 'feet') setHeightFeet(value.replace(/\D/g, '').slice(0, 1));
          else setHeightInches(value.replace(/\D/g, '').slice(0, 2));
        }}
        onSave={saveHeight}
        onCancel={handleCancel}
      />

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




      {/* Add Vaccine from Recommended Modal */}

      <InsuranceScan
        visible={insuranceScanOpen}
        onClose={() => setInsuranceScanOpen(false)}
        onEnterByHand={() => {
          setInsuranceScanOpen(false);
          setInsuranceManualNext(true);
        }}
        onSave={saveScannedInsurance}
        onDismiss={() => {
          // Entering by hand returns to the Insurance page with the new plan form open, once the scan screen has closed
          if (!insuranceManualNext) return;
          setInsuranceManualNext(false);
          setInsuranceDraft({ provider: '', memberId: '', groupNumber: '' });
          setEditingInsurance('new');
          setOpenPage('insurance');
        }}
      />



      <AppointmentEditor
        visible={editingSection === 'appointments'}
        isEditing={editingAppointmentId !== null}
        doctorName={appointmentDoctorName}
        specialty={appointmentSpecialty}
        date={appointmentDate}
        time={appointmentTime}
        onChange={(patch) => {
          if (patch.doctorName !== undefined) setAppointmentDoctorName(patch.doctorName);
          if (patch.specialty !== undefined) setAppointmentSpecialty(patch.specialty);
          if (patch.date) setAppointmentDate(patch.date);
          if (patch.time) setAppointmentTime(patch.time);
        }}
        onSave={handleSaveEdit}
        onCancel={handleCancel}
        onDelete={handleDelete}
      />

      <Modal visible={medicationInputMode !== null} animationType="slide" onRequestClose={() => {
        setMedicationInputMode(null);
        setMedicationType(null);
        setMedicationPhotoUri(null);
        setMedicationInputText('');
      }}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add {medicationType === 'prescription' ? 'Prescription' : 'OTC'} Medication</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {medicationInputMode === 'text' && (
                <TouchableOpacity onPress={() => setMedForm(blankMedicationForm())} style={{ marginRight: 16 }}>
                  <Text style={{ fontSize: 17, color: '#007AFF' }}>Clear</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => {
                setMedicationInputMode(null);
                setMedicationType(null);
                setMedicationPhotoUri(null);
                setMedicationInputText('');
              }}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
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

                <TouchableOpacity style={styles.methodButton} onPress={() => { setMedForm(blankMedicationForm()); setMedicationInputMode('text'); }}>
                  <Text style={styles.methodButtonIcon}>✍️</Text>
                  <View style={styles.methodButtonContent}>
                    <Text style={styles.methodButtonText}>Type Details</Text>
                    <Text style={styles.methodButtonDesc}>Always available - enter medication name</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}

            {medicationInputMode === 'text' && (
              <View style={styles.medFormWrap}>
                <MedicationForm value={medForm} onChange={(patch) => setMedForm((form) => ({ ...form, ...patch }))} />
                <TouchableOpacity style={styles.medSaveButton} onPress={handleMedicationTextSubmit}>
                  <Text style={styles.medSaveText}>Save medication</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.backButton} onPress={() => setMedicationInputMode('method')}>
                  <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
              </View>
            )}

            {medicationInputMode === 'label-review' && labelDraft && (
              <MedicationLabelReview
                draft={labelDraft}
                onSave={saveLabelDraft}
                onCancel={() => {
                  setLabelDraft(null);
                  setMedicationInputMode('method');
                }}
              />
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
  greyedOut: { opacity: 0.4 },
  familyPerson: { fontSize: 13, fontWeight: '600', color: '#8E8E93', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  inlineForm: { padding: 14, backgroundColor: '#F7FAFF' },
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
  latestBpCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginTop: 8, marginBottom: 12 },
  latestBpLabel: { fontSize: 12, fontWeight: '600', color: '#8E8E93', letterSpacing: 0.4, textTransform: 'uppercase' },
  latestBpValue: { fontSize: 40, fontWeight: '700', color: '#000', marginTop: 4 },
  latestBpUnit: { fontSize: 15, fontWeight: '500', color: '#8E8E93' },
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
  medFormWrap: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
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
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#E9E9EB',
    borderRadius: 9,
    padding: 2,
    margin: 12,
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
