import React, { useState } from 'react';
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
} from 'react-native';
import { useRecords } from '@/context/RecordsContext';
import { useRouter } from 'expo-router';
import WearableVitals from '@/components/WearableVitals';

export default function HomeScreen() {
  const { records, userData, loading, getAbnormalResults, updateUserData } = useRecords();
  const router = useRouter();
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editData, setEditData] = useState(userData);
  const [medicationPhoto, setMedicationPhoto] = useState<string | null>(null);
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [appointmentDateTime, setAppointmentDateTime] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(7); // Aug (0-indexed)
  const [selectedDay, setSelectedDay] = useState(15);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
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
  const [editingPrescriptionMedIdx, setEditingPrescriptionMedIdx] = useState<number | null>(null);
  const [editingPrescriptionMedValue, setEditingPrescriptionMedValue] = useState('');
  const [addingOtcMed, setAddingOtcMed] = useState(false);
  const [newOtcMed, setNewOtcMed] = useState('');
  const [editingOtcMedIdx, setEditingOtcMedIdx] = useState<number | null>(null);
  const [editingOtcMedValue, setEditingOtcMedValue] = useState('');
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

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

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

        await updateUserData({ ...editData, appointments: updatedAppointments });
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

        await updateUserData({ ...editData, insurances: updatedInsurances });
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

        await updateUserData({ ...editData, emergencyContacts: updatedContacts });
        setEmergencyContactName('');
        setEmergencyContactRelationship('');
        setEmergencyContactPhone('');
      } else if (editingHistoryType === 'surgical' && surgeryName) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const formattedDate = `${months[historyDateMonth]} ${historyDateYear}`;
        let surgicalHistory = editData.surgicalHistory || [];
        if (editingIndex !== null) {
          surgicalHistory[editingIndex] = { surgeryName, date: formattedDate };
        } else {
          surgicalHistory.push({ surgeryName, date: formattedDate });
        }
        await updateUserData({ ...editData, surgicalHistory });
        setSurgeryName('');
        setSurgeryDate('');
      } else if (editingHistoryType === 'family' && familyMember && familyCondition) {
        let familyHistory = editData.familyHistory || [];
        if (editingIndex !== null) {
          familyHistory[editingIndex] = { familyMember, condition: familyCondition };
        } else {
          familyHistory.push({ familyMember, condition: familyCondition });
        }
        await updateUserData({ ...editData, familyHistory });
        setFamilyMember('');
        setFamilyCondition('');
      } else if (editingHistoryType === 'conditions' && conditionName) {
        let pastConditions = editData.pastConditions || [];
        if (editingIndex !== null) {
          pastConditions[editingIndex] = conditionName;
        } else {
          pastConditions.push(conditionName);
        }
        await updateUserData({ ...editData, pastConditions });
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
        await updateUserData({ ...editData, hospitalizations });
        setHospitalizationReason('');
        setHospitalizationDate('');
      } else {
        await updateUserData(editData);
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

  const handleDelete = async () => {
    try {
      if (editingSection === 'appointments' && editingAppointmentId) {
        const updatedAppointments = (editData.appointments || []).filter(apt => apt.id !== editingAppointmentId);
        await updateUserData({ ...editData, appointments: updatedAppointments });
        Alert.alert('Success', 'Appointment deleted');
        setEditingSection(null);
        setEditingAppointmentId(null);
      } else if (editingSection === 'emergency' && editingEmergencyContactId !== null) {
        const updatedContacts = (editData.emergencyContacts || []).filter((_, idx) => idx !== editingEmergencyContactId);
        await updateUserData({ ...editData, emergencyContacts: updatedContacts });
        Alert.alert('Success', 'Emergency contact deleted');
        setEditingSection(null);
        setEditingEmergencyContactId(null);
      } else if (editingSection === 'insurance' && editingInsuranceId !== null) {
        const updatedInsurances = (editData.insurances || []).filter((_, idx) => idx !== editingInsuranceId);
        await updateUserData({ ...editData, insurances: updatedInsurances });
        Alert.alert('Success', 'Insurance deleted');
        setEditingSection(null);
        setEditingInsuranceId(null);
      } else if (editingHistoryType && editingIndex !== null) {
        if (editingHistoryType === 'surgical') {
          const updated = (editData.surgicalHistory || []).filter((_, i) => i !== editingIndex);
          await updateUserData({ ...editData, surgicalHistory: updated });
        } else if (editingHistoryType === 'family') {
          const updated = (editData.familyHistory || []).filter((_, i) => i !== editingIndex);
          await updateUserData({ ...editData, familyHistory: updated });
        } else if (editingHistoryType === 'conditions') {
          const updated = (editData.pastConditions || []).filter((_, i) => i !== editingIndex);
          await updateUserData({ ...editData, pastConditions: updated });
        } else if (editingHistoryType === 'hospitalization') {
          const updated = (editData.hospitalizations || []).filter((_, i) => i !== editingIndex);
          await updateUserData({ ...editData, hospitalizations: updated });
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

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View />
          <Text style={styles.appName}>EasyMedical</Text>
        </View>

        {/* Your Health Snapshot Title */}
        <View style={styles.snapshotHeader}>
          <Text style={styles.snapshotTitle}>Your Health Snapshot</Text>
        </View>

        {/* VITALS & METRICS Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vitals & Metrics</Text>

          <View style={styles.card}>
            {/* Birthday */}
            <View style={styles.vitalRow}>
              <View style={styles.vitalContent}>
                <Text style={styles.vitalLabel}>
                  <Text style={styles.vitalEmoji}>🎂</Text>
                  {' Birthday: '}
                  <Text style={styles.vitalValue}>
                    {userData.birthday ? `${userData.birthday} (${calculateAge(userData.birthday)})` : '—'}
                  </Text>
                </Text>
              </View>
              <TouchableOpacity onPress={() => {
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
              }}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* Gender */}
            <View style={styles.vitalRow}>
              <View style={styles.vitalContent}>
                <Text style={styles.vitalLabel}>
                  <Text style={styles.vitalEmoji}>👥</Text>
                  {' Gender: '}
                  <Text style={styles.vitalValue}>{userData.gender || '—'}</Text>
                </Text>
              </View>
              <TouchableOpacity onPress={() => {
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
              }}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* Height */}
            <View style={styles.vitalRow}>
              <View style={styles.vitalContent}>
                <Text style={styles.vitalLabel}>
                  <Text style={styles.vitalEmoji}>📏</Text>
                  {' Height: '}
                  <Text style={styles.vitalValue}>
                    {userData.height?.includes("'") ? userData.height : (userData.height ? `${userData.height.replace(/\s/g, "'")}\"` : '0\'0"')}
                  </Text>
                </Text>
              </View>
              <TouchableOpacity onPress={() => {
                setEditData(userData);
                setEditingSection('height');
              }}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* Weight */}
            <View style={styles.vitalRow}>
              <View style={styles.vitalContent}>
                <Text style={styles.vitalLabel}>
                  <Text style={styles.vitalEmoji}>⚖️</Text>
                  {' Weight: '}
                  <Text style={styles.vitalValue}>
                    {userData.weight?.includes('lbs') ? userData.weight : `${userData.weight} lbs`}
                  </Text>
                </Text>
              </View>
              <TouchableOpacity onPress={() => {
                setEditData(userData);
                setEditingSection('weight');
              }}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* Blood Pressure */}
            <View style={styles.vitalRow}>
              <View style={styles.vitalContent}>
                <Text style={styles.vitalLabel}>
                  <Text style={styles.vitalEmoji}>💉</Text>
                  {' Blood Pressure: '}
                  <Text style={styles.vitalValue}>{userData.vitals?.bloodPressure}</Text>
                </Text>
              </View>
              <TouchableOpacity onPress={() => {
                setEditData(userData);
                setEditingSection('bloodPressure');
              }}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* Blood Type */}
            <View style={styles.vitalRow}>
              <View style={styles.vitalContent}>
                <Text style={styles.vitalLabel}>
                  <Text style={styles.vitalEmoji}>🩸</Text>
                  {' Blood Type: '}
                  <Text style={styles.vitalValue}>{userData.bloodType}</Text>
                </Text>
              </View>
              <TouchableOpacity onPress={() => {
                setEditData(userData);
                setEditingSection('bloodType');
              }}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* WEARABLE VITALS Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Wearable Devices</Text>
          <WearableVitals />
        </View>

        {/* CURRENT HEALTH Section */}
        <View style={styles.section}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardIcon}>❤️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Current Health</Text>
              <Text style={styles.cardMeta}>Complete health profile</Text>
            </View>
          </View>

          <View style={styles.card}>
            {/* Prescription Medications */}
            <View style={styles.healthSection}>
              <View style={styles.healthSectionHeader}>
                <Text style={styles.healthSectionTitle}>💊 Prescription Medications</Text>
                <TouchableOpacity onPress={() => setAddingPrescriptionMed(!addingPrescriptionMed)}>
                  <Text style={styles.editLink}>+ Add</Text>
                </TouchableOpacity>
              </View>
              {(userData.prescriptionMedications && userData.prescriptionMedications.length > 0) ? (
                userData.prescriptionMedications.map((med, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 }}>
                    {editingPrescriptionMedIdx === idx ? (
                      <TextInput
                        style={[styles.input, { flex: 1, height: 36 }]}
                        value={editingPrescriptionMedValue}
                        onChangeText={setEditingPrescriptionMedValue}
                      />
                    ) : (
                      <Text style={[styles.healthItem, { flex: 1 }]}>• {med}</Text>
                    )}
                    {editingPrescriptionMedIdx === idx ? (
                      <>
                        <TouchableOpacity
                          onPress={async () => {
                            const updated = [...(userData.prescriptionMedications || [])];
                            updated[idx] = editingPrescriptionMedValue;
                            const updatedData = { ...editData, prescriptionMedications: updated };
                            setEditData(updatedData);
                            await updateUserData(updatedData);
                            setEditingPrescriptionMedIdx(null);
                          }}
                        >
                          <Text style={styles.editLink}>✓</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setEditingPrescriptionMedIdx(null)}>
                          <Text style={styles.editLink}>✕</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity onPress={() => {
                        setEditingPrescriptionMedIdx(idx);
                        setEditingPrescriptionMedValue(med);
                      }}>
                        <Text style={styles.editLink}>Edit</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              ) : (
                <>
                  <Text style={styles.healthItem}>• Lisinopril 10mg daily</Text>
                  <Text style={styles.healthItem}>• Metformin 500mg twice daily</Text>
                </>
              )}
              {addingPrescriptionMed && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
                  <TextInput
                    style={[styles.input, { flex: 1, height: 40 }]}
                    placeholder="Enter medication"
                    placeholderTextColor="#999"
                    value={newPrescriptionMed}
                    onChangeText={setNewPrescriptionMed}
                  />
                  <TouchableOpacity
                    style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#007AFF', borderRadius: 6 }}
                    onPress={async () => {
                      if (newPrescriptionMed.trim()) {
                        const updatedData = {
                          ...editData,
                          prescriptionMedications: [...(editData.prescriptionMedications || []), newPrescriptionMed.trim()]
                        };
                        setEditData(updatedData);
                        await updateUserData(updatedData);
                        setNewPrescriptionMed('');
                        setAddingPrescriptionMed(false);
                      }
                    }}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '600' }}>Add</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* OTC Medications and Supplements */}
            <View style={styles.healthSection}>
              <View style={styles.healthSectionHeader}>
                <Text style={styles.healthSectionTitle}>🌿 OTC Medications & Supplements</Text>
                <TouchableOpacity onPress={() => setAddingOtcMed(!addingOtcMed)}>
                  <Text style={styles.editLink}>+ Add</Text>
                </TouchableOpacity>
              </View>
              {(userData.otcMedications && userData.otcMedications.length > 0) ? (
                userData.otcMedications.map((med, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 }}>
                    {editingOtcMedIdx === idx ? (
                      <TextInput
                        style={[styles.input, { flex: 1, height: 36 }]}
                        value={editingOtcMedValue}
                        onChangeText={setEditingOtcMedValue}
                      />
                    ) : (
                      <Text style={[styles.healthItem, { flex: 1 }]}>• {med}</Text>
                    )}
                    {editingOtcMedIdx === idx ? (
                      <>
                        <TouchableOpacity
                          onPress={async () => {
                            const updated = [...(userData.otcMedications || [])];
                            updated[idx] = editingOtcMedValue;
                            const updatedData = { ...editData, otcMedications: updated };
                            setEditData(updatedData);
                            await updateUserData(updatedData);
                            setEditingOtcMedIdx(null);
                          }}
                        >
                          <Text style={styles.editLink}>✓</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setEditingOtcMedIdx(null)}>
                          <Text style={styles.editLink}>✕</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity onPress={() => {
                        setEditingOtcMedIdx(idx);
                        setEditingOtcMedValue(med);
                      }}>
                        <Text style={styles.editLink}>Edit</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              ) : (
                <>
                  <Text style={styles.healthItem}>• Vitamin D 2000 IU daily</Text>
                  <Text style={styles.healthItem}>• Omega-3 supplements</Text>
                </>
              )}
              {addingOtcMed && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
                  <TextInput
                    style={[styles.input, { flex: 1, height: 40 }]}
                    placeholder="Enter OTC medication or supplement"
                    placeholderTextColor="#999"
                    value={newOtcMed}
                    onChangeText={setNewOtcMed}
                  />
                  <TouchableOpacity
                    style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#007AFF', borderRadius: 6 }}
                    onPress={async () => {
                      if (newOtcMed.trim()) {
                        const updatedData = {
                          ...editData,
                          otcMedications: [...(editData.otcMedications || []), newOtcMed.trim()]
                        };
                        setEditData(updatedData);
                        await updateUserData(updatedData);
                        setNewOtcMed('');
                        setAddingOtcMed(false);
                      }
                    }}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '600' }}>Add</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Conditions */}
            <View style={styles.healthSection}>
              <View style={styles.healthSectionHeader}>
                <Text style={styles.healthSectionTitle}>⚕️ Conditions</Text>
                <TouchableOpacity onPress={() => setAddingCondition(!addingCondition)}>
                  <Text style={styles.editLink}>+ Add</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.tagContainer}>
                {(userData.conditions && userData.conditions.length > 0) ? (
                  userData.conditions.map((condition, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 }}>
                      {editingConditionIdx === idx ? (
                        <TextInput
                          style={[styles.input, { flex: 1, height: 36 }]}
                          value={editingConditionValue}
                          onChangeText={setEditingConditionValue}
                        />
                      ) : (
                        <View style={[styles.tag, { flex: 1 }]}>
                          <Text style={[styles.tagText, { flex: 1 }]} numberOfLines={1}>{condition}</Text>
                        </View>
                      )}
                      {editingConditionIdx === idx ? (
                        <>
                          <TouchableOpacity
                            onPress={async () => {
                              const updated = [...(userData.conditions || [])];
                              updated[idx] = editingConditionValue;
                              const updatedData = { ...editData, conditions: updated };
                              setEditData(updatedData);
                              await updateUserData(updatedData);
                              setEditingConditionIdx(null);
                            }}
                          >
                            <Text style={styles.editLink}>✓</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setEditingConditionIdx(null)}>
                            <Text style={styles.editLink}>✕</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <TouchableOpacity onPress={() => {
                          setEditingConditionIdx(idx);
                          setEditingConditionValue(condition);
                        }}>
                          <Text style={styles.editLink}>Edit</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                ) : (
                  <>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>Hypertension</Text>
                    </View>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>Type 2 Diabetes</Text>
                    </View>
                  </>
                )}
              </View>
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
                        await updateUserData(updatedData);
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

            {/* Allergies */}
            <View style={styles.healthSection}>
              <View style={styles.healthSectionHeader}>
                <Text style={styles.healthSectionTitle}>⚠️ Allergies</Text>
                <TouchableOpacity onPress={() => setAddingAllergy(!addingAllergy)}>
                  <Text style={styles.editLink}>+ Add</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.tagContainer}>
                {(userData.allergies && userData.allergies.length > 0) ? (
                  userData.allergies.map((allergy, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 }}>
                      {editingAllergyIdx === idx ? (
                        <TextInput
                          style={[styles.input, { flex: 1, height: 36 }]}
                          value={editingAllergyValue}
                          onChangeText={setEditingAllergyValue}
                        />
                      ) : (
                        <View style={[styles.tag, styles.allergyTag, { flex: 1 }]}>
                          <Text style={[styles.tagText, styles.allergyText, { flex: 1 }]} numberOfLines={1}>{allergy}</Text>
                        </View>
                      )}
                      {editingAllergyIdx === idx ? (
                        <>
                          <TouchableOpacity
                            onPress={async () => {
                              const updated = [...(userData.allergies || [])];
                              updated[idx] = editingAllergyValue;
                              const updatedData = { ...editData, allergies: updated };
                              setEditData(updatedData);
                              await updateUserData(updatedData);
                              setEditingAllergyIdx(null);
                            }}
                          >
                            <Text style={styles.editLink}>✓</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setEditingAllergyIdx(null)}>
                            <Text style={styles.editLink}>✕</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <TouchableOpacity onPress={() => {
                          setEditingAllergyIdx(idx);
                          setEditingAllergyValue(allergy);
                        }}>
                          <Text style={styles.editLink}>Edit</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                ) : (
                  <>
                    <View style={[styles.tag, styles.allergyTag]}>
                      <Text style={[styles.tagText, styles.allergyText]}>Penicillin</Text>
                    </View>
                    <View style={[styles.tag, styles.allergyTag]}>
                      <Text style={[styles.tagText, styles.allergyText]}>Sulfa drugs</Text>
                    </View>
                  </>
                )}
              </View>
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
                        await updateUserData(updatedData);
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

            {/* Vaccines */}
            <View style={styles.healthSection}>
              <View style={styles.healthSectionHeader}>
                <Text style={styles.healthSectionTitle}>💉 Vaccinations</Text>
                <TouchableOpacity onPress={() => setAddingVaccine(!addingVaccine)}>
                  <Text style={styles.editLink}>+ Add</Text>
                </TouchableOpacity>
              </View>
              {(userData.vaccines && userData.vaccines.length > 0) ? (
                userData.vaccines.map((vaccine, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 6 }}>
                    {editingVaccineIdx === idx ? (
                      <TextInput
                        style={[styles.input, { flex: 1, height: 36 }]}
                        value={editingVaccineValue}
                        onChangeText={setEditingVaccineValue}
                      />
                    ) : (
                      <View style={{ flex: 1 }}>
                        <Text style={styles.healthItem}>• {vaccine.name}</Text>
                        <Text style={styles.healthItemMeta}>  {new Date(vaccine.date).toLocaleDateString()}</Text>
                      </View>
                    )}
                    {editingVaccineIdx === idx ? (
                      <>
                        <TouchableOpacity
                          onPress={async () => {
                            const updated = [...(userData.vaccines || [])];
                            updated[idx] = { ...vaccine, name: editingVaccineValue };
                            const updatedData = { ...editData, vaccines: updated };
                            setEditData(updatedData);
                            await updateUserData(updatedData);
                            setEditingVaccineIdx(null);
                          }}
                        >
                          <Text style={styles.editLink}>✓</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setEditingVaccineIdx(null)}>
                          <Text style={styles.editLink}>✕</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity onPress={() => {
                        setEditingVaccineIdx(idx);
                        setEditingVaccineValue(vaccine.name);
                      }}>
                        <Text style={styles.editLink}>Edit</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              ) : (
                <>
                  <Text style={styles.healthItem}>• COVID-19 (Booster)</Text>
                  <Text style={styles.healthItemMeta}>  1/15/2024</Text>
                  <Text style={styles.healthItem}>• Flu Shot</Text>
                  <Text style={styles.healthItemMeta}>  9/20/2024</Text>
                </>
              )}
              {addingVaccine && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
                  <TextInput
                    style={[styles.input, { flex: 1, height: 40 }]}
                    placeholder="Enter vaccine name"
                    placeholderTextColor="#999"
                    value={newVaccine}
                    onChangeText={setNewVaccine}
                  />
                  <TouchableOpacity
                    style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#007AFF', borderRadius: 6 }}
                    onPress={async () => {
                      if (newVaccine.trim()) {
                        const updatedData = {
                          ...editData,
                          vaccines: [...(editData.vaccines || []), { name: newVaccine.trim(), date: new Date().toISOString() }]
                        };
                        setEditData(updatedData);
                        await updateUserData(updatedData);
                        setNewVaccine('');
                        setAddingVaccine(false);
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

        {/* HEALTH HISTORY Section */}
        <View style={styles.section}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardIcon}>📚</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Health History</Text>
            </View>
          </View>

          <View style={styles.card}>
            {/* Surgical History */}
            <View style={styles.historyCategory}>
              <View style={styles.historyCategoryHeader}>
                <Text style={styles.historyCategoryTitle}>🔧 Surgical History</Text>
                <TouchableOpacity onPress={() => {
                  setEditData(userData);
                  setEditingHistoryType('surgical');
                  setEditingIndex(null);
                  setSurgeryDate('');
                  setSurgeryName('');
                }}>
                  <Text style={styles.addLink}>+ Add</Text>
                </TouchableOpacity>
              </View>
              {userData.surgicalHistory && userData.surgicalHistory.length > 0 ? (
                userData.surgicalHistory.map((surgery, idx) => (
                  <View key={idx} style={styles.historyEntry}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryTitle}>{surgery.surgeryName}</Text>
                      <Text style={styles.entryMeta}>{surgery.date}</Text>
                    </View>
                    <TouchableOpacity onPress={() => {
                      setEditData(userData);
                      setEditingHistoryType('surgical');
                      setEditingIndex(idx);
                      setSurgeryDate(surgery.date);
                      setSurgeryName(surgery.surgeryName);
                    }}>
                      <Text style={styles.editLink}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No surgical history added</Text>
              )}
            </View>

            <View style={styles.divider} />

            {/* Family History */}
            <View style={styles.historyCategory}>
              <View style={styles.historyCategoryHeader}>
                <Text style={styles.historyCategoryTitle}>👨‍👩‍👧 Family History</Text>
                <TouchableOpacity onPress={() => {
                  setEditData(userData);
                  setEditingHistoryType('family');
                  setEditingIndex(null);
                  setFamilyMember('');
                  setFamilyCondition('');
                }}>
                  <Text style={styles.addLink}>+ Add</Text>
                </TouchableOpacity>
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
                          <TouchableOpacity onPress={() => {
                            setEditData(userData);
                            setEditingHistoryType('family');
                            setEditingIndex(item.idx);
                            setFamilyMember(item.familyMember);
                            setFamilyCondition(item.condition);
                          }}>
                            <Text style={styles.editLink}>Edit</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No family history added</Text>
              )}
            </View>

            <View style={styles.divider} />

            {/* Past Conditions */}
            <View style={styles.historyCategory}>
              <View style={styles.historyCategoryHeader}>
                <Text style={styles.historyCategoryTitle}>📋 Past Conditions</Text>
                <TouchableOpacity onPress={() => {
                  setEditData(userData);
                  setEditingHistoryType('conditions');
                  setEditingIndex(null);
                  setConditionName('');
                }}>
                  <Text style={styles.addLink}>+ Add</Text>
                </TouchableOpacity>
              </View>
              {userData.pastConditions && userData.pastConditions.length > 0 ? (
                userData.pastConditions.map((condition, idx) => (
                  <View key={idx} style={styles.historyEntry}>
                    <Text style={styles.entryTitle}>{condition}</Text>
                    <TouchableOpacity onPress={() => {
                      setEditData(userData);
                      setEditingHistoryType('conditions');
                      setEditingIndex(idx);
                      setConditionName(condition);
                    }}>
                      <Text style={styles.editLink}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No past conditions added</Text>
              )}
            </View>

            <View style={styles.divider} />

            {/* Hospitalizations */}
            <View style={styles.historyCategory}>
              <View style={styles.historyCategoryHeader}>
                <Text style={styles.historyCategoryTitle}>🏥 Hospitalizations</Text>
                <TouchableOpacity onPress={() => {
                  setEditData(userData);
                  setEditingHistoryType('hospitalization');
                  setEditingIndex(null);
                  setHospitalizationDate('');
                  setHospitalizationReason('');
                }}>
                  <Text style={styles.addLink}>+ Add</Text>
                </TouchableOpacity>
              </View>
              {userData.hospitalizations && userData.hospitalizations.length > 0 ? (
                userData.hospitalizations.map((hospitalization, idx) => (
                  <View key={idx} style={styles.historyEntry}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryTitle}>{hospitalization.reason}</Text>
                      <Text style={styles.entryMeta}>{hospitalization.date}</Text>
                    </View>
                    <TouchableOpacity onPress={() => {
                      setEditData(userData);
                      setEditingHistoryType('hospitalization');
                      setEditingIndex(idx);
                      setHospitalizationDate(hospitalization.date);
                      setHospitalizationReason(hospitalization.reason);
                    }}>
                      <Text style={styles.editLink}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No hospitalizations added</Text>
              )}
            </View>
          </View>
        </View>

        {/* LABS & RESULTS Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Labs & Results</Text>

          <View style={styles.cardWrapper}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardIcon}>🔬</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Recent Abnormal Results</Text>
                <Text style={styles.cardMeta}>{abnormalResults.length} findings</Text>
              </View>
            </View>
            {abnormalResults.length > 0 ? (
              <View style={styles.card}>
                {abnormalResults.slice(0, 3).map((result, idx) => (
                  <TouchableOpacity
                    key={result.id}
                    style={styles.resultItem}
                    onPress={() => router.push(`/detail/${result.id}`)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultProvider}>{result.provider}</Text>
                      <Text style={styles.resultSummary} numberOfLines={1}>{result.summary}</Text>
                      <Text style={styles.resultDate}>
                        {new Date(result.uploadDate).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text style={styles.arrow}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.emptyText}>✓ No abnormal results</Text>
              </View>
            )}
          </View>
        </View>

        {/* APPOINTMENTS & INSURANCE Section */}
        <View style={styles.section}>
          {/* Appointments */}
          <View style={styles.cardWrapper}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardIcon}>📅</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Upcoming Appointments</Text>
                <Text style={styles.cardMeta}>{userData.appointments?.length || 0} scheduled</Text>
              </View>
            </View>
            <View style={styles.card}>
              {userData.appointments && userData.appointments.length > 0 ? (
                [...userData.appointments]
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
                      {idx < userData.appointments.length - 1 && <View style={styles.divider} />}
                    </View>
                  ))
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

          {/* Insurance */}
          <View style={styles.cardWrapper}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardIcon}>🏥</Text>
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
                <>
                  <View style={styles.infoRowWithEdit}>
                    <View style={styles.infoColumn}>
                      <Text style={styles.infoLabel}>Provider</Text>
                      <Text style={styles.infoValue}>Blue Cross Blue Shield</Text>
                    </View>
                    <TouchableOpacity onPress={() => {
                      setEditData(userData);
                      setEditingSection('insurance');
                      setEditingInsuranceId(0);
                      setInsuranceProvider('Blue Cross Blue Shield');
                      setInsuranceMemberId('BCX123456789');
                      setInsuranceGroupNumber('');
                    }}>
                      <Text style={styles.editLink}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Member ID</Text>
                    <Text style={styles.infoValueMono}>BCX123456789</Text>
                  </View>
                </>
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

          {/* Emergency Contacts */}
          <View style={styles.cardWrapper}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardIcon}>📞</Text>
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
                <View style={styles.contactRowWithEdit}>
                  <View>
                    <Text style={styles.contactName}>Jane Doe</Text>
                    <Text style={styles.contactRelationship}>Spouse</Text>
                    <Text style={styles.contactPhoneNumber}>(555) 123-4567</Text>
                  </View>
                  <TouchableOpacity onPress={() => {
                    setEditData(userData);
                    setEditingSection('emergency');
                    setEditingEmergencyContactId(0);
                    setEmergencyContactName('Jane Doe');
                    setEmergencyContactRelationship('Spouse');
                    setEmergencyContactPhone('(555) 123-4567');
                  }}>
                    <Text style={styles.editLink}>Edit</Text>
                  </TouchableOpacity>
                </View>
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

        <View style={styles.spacing} />
      </ScrollView>

      {/* EDIT MODALS */}
      {/* Blood Type Modal */}
      {/* Birthday Modal */}
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
                  updateUserData({ ...editData, birthday: formattedBirthday });
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
                  updateUserData({ ...editData, gender: genderToSave });
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
              onPress={() => {
                setEditData({ ...editData, height: `${selectedFeet}'${selectedInches}"` });
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
              onPress={() => {
                setEditData({ ...editData, weight: `${selectedWeight} lbs` });
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
                  ...editData,
                  vitals: { ...editData.vitals, bloodPressure: `${selectedSystolic}/${selectedDiastolic} mmHg` }
                };
                await updateUserData(updatedData);
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
          <View style={styles.modalContent}>
            <Text style={styles.infoText}>Vaccination editing coming soon</Text>
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.saveButton} onPress={handleCancel}>
                <Text style={styles.buttonTextWhite}>Back</Text>
              </TouchableOpacity>
            </View>
          </View>
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
    </>
  );
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
  section: {
    paddingHorizontal: 20,
    marginBottom: 48,
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
    fontWeight: '700',
    color: '#007AFF',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  cardWrapper: {
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  cardIcon: {
    fontSize: 20,
  },
  cardTitle: {
    fontSize: 15,
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
    gap: 10,
  },
  pickerColumn: {
    flex: 1,
    minHeight: 250,
    maxHeight: 250,
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    marginBottom: 8,
    paddingHorizontal: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scrollPicker: {
    height: 220,
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  pickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  pickerOptionSelected: {
    backgroundColor: '#E3F2FD',
  },
  pickerOptionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  pickerOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '700',
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
});
