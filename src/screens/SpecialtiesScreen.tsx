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
import { useRecords } from '@/context/RecordsContext';
import { useRouter } from 'expo-router';
import { v4 as uuidv4 } from 'uuid';
import { claudeService } from '@/services/claudeService';
import { epicService, Appointment } from '@/services/epicService';

let ImagePicker: any;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  console.warn('ImagePicker not available');
}

export default function SpecialtiesScreen() {
  const { records, loading, getUniqueSpecialties, addRecord } = useRecords();
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [uploadingSpecialty, setUploadingSpecialty] = useState<string | null>(null);
  const [recordText, setRecordText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<'method' | 'text' | 'photo'>('method');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [doctorName, setDoctorName] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentSummary, setAppointmentSummary] = useState('');
  const [epicAppointments, setEpicAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showAppointmentDetail, setShowAppointmentDetail] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [showDoctorAppointments, setShowDoctorAppointments] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      const appointments = await epicService.getAppointments();
      setEpicAppointments(appointments);
    } catch (error) {
      console.error('Failed to load appointments:', error);
    }
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
    'Dentistry',
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
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
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
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
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
      const photoDescription = `Medical record document - ${uploadingSpecialty}. Photo uploaded for analysis.`;
      const parsedRecord = await claudeService.parseRecordFromText(photoDescription, recordId);

      await addRecord({
        id: recordId,
        uploadDate: parsedRecord.uploadDate || new Date().toISOString(),
        originalText: parsedRecord.originalText,
        specialty: uploadingSpecialty,
        provider: parsedRecord.provider || 'Unknown',
        summary: parsedRecord.summary || 'Medical record',
        extractedData: parsedRecord.extractedData || {},
        processed: true,
        isTeamMember: true,
      });

      setUploadingSpecialty(null);
      setPhotoUri(null);
      setUploadMode('method');
      Alert.alert('Success', 'Record added to your team!');
    } catch (error) {
      Alert.alert('Error', 'Failed to process record: ' + String(error));
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

      await addRecord({
        id: recordId,
        uploadDate: new Date().toISOString(),
        originalText: appointmentSummary,
        specialty: uploadingSpecialty,
        provider: doctorName,
        summary: appointmentSummary,
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

  // Get team records (records marked as part of user's team)
  const teamRecords = records.filter(r => r.isTeamMember === true);
  const teamBySpecialty: Record<string, typeof records> = {};
  teamRecords.forEach(record => {
    if (!teamBySpecialty[record.specialty]) {
      teamBySpecialty[record.specialty] = [];
    }
    teamBySpecialty[record.specialty].push(record);
  });

  return (
    <ScrollView style={styles.container}>
      <View style={styles.topBar}>
        <View />
        <Text style={styles.appName}>EasyMedical AI</Text>
      </View>
      <View style={styles.header}>
        <Text style={styles.title}>My Health Records</Text>
        <Text style={styles.subtitle}>{specialties.length} specialties available</Text>
      </View>

      {/* My Records Section - Shows uploaded records + Epic appointments */}
      <View style={styles.teamSection}>
        <Text style={styles.sectionTitle}>📋 My Records</Text>
        {(teamRecords.length > 0 || epicAppointments.length > 0) ? (
          <View style={styles.recordsCardsContainer}>
            {/* Group records by specialty */}
            {Object.entries(teamBySpecialty).map(([specialty, docs]) => (
              <View key={specialty} style={styles.recordCard}>
                <Text style={styles.recordSpecialty}>
                  {getSpecialtyEmoji(specialty)} {specialty}
                </Text>
                <View style={styles.doctorsList}>
                  {/* Get unique providers for this specialty */}
                  {Array.from(new Set(docs.map(doc => doc.provider))).map((provider, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.doctorItem}
                      onPress={() => {
                        setSelectedDoctor(provider);
                        setShowDoctorAppointments(true);
                      }}
                    >
                      <Text style={styles.recordDoctor}>{provider}</Text>
                      <Text style={styles.recordDate}>
                        {docs.find(d => d.provider === provider)?.uploadDate?.split('T')[0]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}

            {/* Add Epic appointments as additional specialties if not already shown */}
            {epicAppointments.length > 0 && (
              Object.entries(
                epicAppointments.reduce((acc: Record<string, typeof epicAppointments>, apt) => {
                  const specialty = 'Cardiology';
                  if (!acc[specialty]) acc[specialty] = [];
                  acc[specialty].push(apt);
                  return acc;
                }, {} as Record<string, typeof epicAppointments>)
              ).map(([specialty, apts]) => (
                !teamBySpecialty[specialty] && (
                  <View key={`epic-${specialty}`} style={styles.recordCard}>
                    <Text style={styles.recordSpecialty}>
                      {getSpecialtyEmoji(specialty)} {specialty}
                    </Text>
                    <View style={styles.doctorsList}>
                      {Array.from(new Set(apts.map(apt => apt.provider))).map((provider, idx) => (
                        <TouchableOpacity
                          key={idx}
                          style={styles.doctorItem}
                          onPress={() => {
                            setSelectedDoctor(provider);
                            setShowDoctorAppointments(true);
                          }}
                        >
                          <Text style={styles.recordDoctor}>{provider}</Text>
                          <Text style={styles.recordDate}>
                            {apts.find(a => a.provider === provider)?.date}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )
              ))
            )}
          </View>
        ) : (
          <Text style={styles.teamEmptyText}>No records yet. Upload your first record to get started.</Text>
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

      {/* Other Section */}
      <View style={styles.otherSection}>
        <Text style={styles.otherSectionTitle}>Other</Text>
        <TouchableOpacity
          style={styles.uploadSpecialtyButton}
          onPress={() => setUploadingSpecialty('Other')}
        >
          <Text style={styles.uploadSpecialtyButtonText}>📄 Other</Text>
        </TouchableOpacity>
      </View>


      <View style={styles.spacing} />

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
          <ScrollView style={styles.modalContent}>
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
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Aug 15, 2025"
                  placeholderTextColor="#999"
                  value={appointmentDate}
                  onChangeText={setAppointmentDate}
                  editable={!isUploading}
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
    </ScrollView>
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
});
