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
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [editingEmergencyContactId, setEditingEmergencyContactId] = useState<number | null>(null);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const abnormalResults = getAbnormalResults();

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
        await updateUserData({
          ...editData,
          insurance: {
            provider: insuranceProvider,
            memberId: insuranceMemberId,
            groupNumber: insuranceGroupNumber,
          }
        });
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
      } else {
        await updateUserData(editData);
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

  const handleDateTimePickerDone = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedDateTime = `${months[selectedMonth]} ${selectedDay}, 2024 • ${selectedHour}:${String(selectedMinute).padStart(2, '0')} ${selectedPeriod}`;
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
        medications: [...(editData.medications || []), ...mockMedications],
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

        {/* VITALS & METRICS Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vitals & Metrics</Text>

          <View style={styles.card}>
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
            {/* Medications */}
            <View style={styles.healthSection}>
              <View style={styles.healthSectionHeader}>
                <Text style={styles.healthSectionTitle}>💊 Medications</Text>
                <TouchableOpacity onPress={() => {
                  setEditData(userData);
                  setEditingSection('medications');
                }}>
                  <Text style={styles.editLink}>Edit</Text>
                </TouchableOpacity>
              </View>
              {(userData.medications && userData.medications.length > 0) ? (
                userData.medications.map((med, idx) => (
                  <Text key={idx} style={styles.healthItem}>• {med}</Text>
                ))
              ) : (
                <>
                  <Text style={styles.healthItem}>• Lisinopril 10mg daily</Text>
                  <Text style={styles.healthItem}>• Metformin 500mg twice daily</Text>
                </>
              )}
            </View>

            {/* Conditions */}
            <View style={styles.healthSection}>
              <View style={styles.healthSectionHeader}>
                <Text style={styles.healthSectionTitle}>⚕️ Conditions</Text>
                <TouchableOpacity onPress={() => {
                  setEditData(userData);
                  setEditingSection('conditions');
                }}>
                  <Text style={styles.editLink}>Edit</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.tagContainer}>
                {(userData.conditions && userData.conditions.length > 0) ? (
                  userData.conditions.map((condition, idx) => (
                    <View key={idx} style={styles.tag}>
                      <Text style={styles.tagText}>{condition}</Text>
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
            </View>

            {/* Allergies */}
            <View style={styles.healthSection}>
              <View style={styles.healthSectionHeader}>
                <Text style={styles.healthSectionTitle}>⚠️ Allergies</Text>
                <TouchableOpacity onPress={() => {
                  setEditData(userData);
                  setEditingSection('allergies');
                }}>
                  <Text style={styles.editLink}>Edit</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.tagContainer}>
                {(userData.allergies && userData.allergies.length > 0) ? (
                  userData.allergies.map((allergy, idx) => (
                    <View key={idx} style={[styles.tag, styles.allergyTag]}>
                      <Text style={[styles.tagText, styles.allergyText]}>{allergy}</Text>
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
            </View>

            {/* Vaccines */}
            <View style={styles.healthSection}>
              <View style={styles.healthSectionHeader}>
                <Text style={styles.healthSectionTitle}>💉 Vaccinations</Text>
                <TouchableOpacity onPress={() => {
                  setEditData(userData);
                  setEditingSection('vaccines');
                }}>
                  <Text style={styles.editLink}>Edit</Text>
                </TouchableOpacity>
              </View>
              {(userData.vaccines && userData.vaccines.length > 0) ? (
                userData.vaccines.map((vaccine, idx) => (
                  <View key={idx}>
                    <Text style={styles.healthItem}>• {vaccine.name}</Text>
                    <Text style={styles.healthItemMeta}>  {new Date(vaccine.date).toLocaleDateString()}</Text>
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
                <Text style={styles.cardTitle}>Upcoming Appointment</Text>
                <Text style={styles.cardMeta}>Next scheduled</Text>
              </View>
            </View>
            <View style={styles.card}>
              {userData.appointments && userData.appointments.length > 0 ? (
                userData.appointments.slice(0, 1).map((apt) => (
                  <View key={apt.id} style={styles.appointmentItemRow}>
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
                ))
              ) : (
                <Text style={styles.emptyText}>No upcoming appointments</Text>
              )}
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  setEditData(userData);
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
                <Text style={styles.cardMeta}>Active coverage</Text>
              </View>
            </View>
            <View style={styles.card}>
              <View style={styles.infoRowWithEdit}>
                <View style={styles.infoColumn}>
                  <Text style={styles.infoLabel}>Provider</Text>
                  <Text style={styles.infoValue}>
                    {userData.insurance?.provider || 'Blue Cross Blue Shield'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => {
                  setEditData(userData);
                  setEditingSection('insurance');
                  setInsuranceProvider(userData.insurance?.provider || '');
                  setInsuranceMemberId(userData.insurance?.memberId || '');
                  setInsuranceGroupNumber(userData.insurance?.groupNumber || '');
                }}>
                  <Text style={styles.editLink}>Edit</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Member ID</Text>
                <Text style={styles.infoValueMono}>
                  {userData.insurance?.memberId || 'BCX123456789'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  setEditData(userData);
                  setEditingSection('insurance');
                  setInsuranceProvider(userData.insurance?.provider || '');
                  setInsuranceMemberId(userData.insurance?.memberId || '');
                  setInsuranceGroupNumber(userData.insurance?.groupNumber || '');
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
                <Text style={styles.cardTitle}>Emergency Contact</Text>
                <Text style={styles.cardMeta}>Primary contact</Text>
              </View>
            </View>
            <View style={styles.card}>
              {userData.emergencyContacts && userData.emergencyContacts.length > 0 ? (
                <View style={styles.contactRowWithEdit}>
                  <View>
                    <Text style={styles.contactName}>{userData.emergencyContacts[0].name}</Text>
                    <Text style={styles.contactRelationship}>{userData.emergencyContacts[0].relationship}</Text>
                    <Text style={styles.contactPhoneNumber}>{userData.emergencyContacts[0].phone}</Text>
                  </View>
                  <TouchableOpacity onPress={() => {
                    setEditData(userData);
                    setEditingSection('emergency');
                    setEditingEmergencyContactId(0);
                    setEmergencyContactName(userData.emergencyContacts[0].name);
                    setEmergencyContactRelationship(userData.emergencyContacts[0].relationship);
                    setEmergencyContactPhone(userData.emergencyContacts[0].phone);
                  }}>
                    <Text style={styles.editLink}>Edit</Text>
                  </TouchableOpacity>
                </View>
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

      <Modal visible={editingSection === 'medications'} animationType="slide" onRequestClose={handleCancel}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Medications</Text>
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
                value={editData.medications?.join('\n') || ''}
                onChangeText={(text) => setEditData({
                  ...editData,
                  medications: text.split('\n').filter(m => m.trim())
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
            <Text style={styles.modalTitle}>Edit Insurance</Text>
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
    marginBottom: 28,
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
    height: 300,
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
    flex: 1,
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
});
