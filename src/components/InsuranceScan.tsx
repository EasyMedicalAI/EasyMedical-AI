// Add insurance by scanning the card: take or choose a photo, or choose a PDF. The details are read, then checked before saving.
// The card image is held only while it is read. It is not saved.
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { cameraService } from '@/services/cameraService';
import { convertHeicToJpeg } from '@/services/claudeService';

let DocumentPicker: any = null;
try {
  DocumentPicker = require('expo-document-picker');
} catch {
  DocumentPicker = null;
}

export interface CardDetails {
  provider: string;
  plan: string;
  memberId: string;
  groupNumber: string;
  payerPhone: string;
}

const BLANK: CardDetails = { provider: '', plan: '', memberId: '', groupNumber: '', payerPhone: '' };

type Step = 'choose' | 'reading' | 'review';

export default function InsuranceScan({
  visible,
  onClose,
  onEnterByHand,
  onSave,
  onDismiss,
}: {
  visible: boolean;
  onClose: () => void;
  onEnterByHand: () => void;
  onSave: (card: CardDetails) => Promise<void>;
  onDismiss?: () => void;
}) {
  const [step, setStep] = useState<Step>('choose');
  const [details, setDetails] = useState<CardDetails>(BLANK);
  const [lowConfidence, setLowConfidence] = useState(false);
  const [notes, setNotes] = useState('');

  // Each time the screen opens, start again
  useEffect(() => {
    if (visible) {
      setStep('choose');
      setDetails(BLANK);
      setLowConfidence(false);
      setNotes('');
    }
  }, [visible]);

  // Reads a picked photo as base64, converting HEIC to JPEG first
  const readImage = async (uri: string, mimeType?: string) => {
    const jpegUri = mimeType && /heic|heif/i.test(mimeType) ? await convertHeicToJpeg(uri) : uri;
    return FileSystem.readAsStringAsync(jpegUri, { encoding: FileSystem.EncodingType.Base64 });
  };

  // Sends the card to be read, then shows what was found for checking
  const readCard = async (images: string[], documents: string[]) => {
    setStep('reading');
    const result = await cameraService.analyzeInsuranceCard(images, documents);
    if (!result.success) {
      Alert.alert('Could not read the card', 'Try a clearer photo, or enter the details by hand.');
      setStep('choose');
      return;
    }
    const card = result.data;
    setDetails({
      provider: card.insurer || '',
      plan: card.planName || '',
      memberId: card.memberId || '',
      groupNumber: card.groupNumber || '',
      payerPhone: card.payerPhone || '',
    });
    setLowConfidence(card.confidence !== 'high');
    setNotes(card.notes || '');
    setStep('review');
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera off', 'Turn on Camera for EasyMedical in Settings to scan your card.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await readCard([await readImage(asset.uri, asset.mimeType)], []);
  };

  const choosePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photos off', 'Turn on Photos for EasyMedical in Settings to choose a photo of your card.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await readCard([await readImage(asset.uri, asset.mimeType)], []);
  };

  const choosePdf = async () => {
    if (!DocumentPicker) {
      Alert.alert('PDF needs an app update', 'Choose a photo for now, or enter the details by hand.');
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
    await readCard([], [base64]);
  };

  const save = async () => {
    if (!details.provider.trim() || !details.memberId.trim()) {
      Alert.alert('Check the card', 'The insurer and member ID are needed.');
      return;
    }
    await onSave({ ...details, provider: details.provider.trim(), memberId: details.memberId.trim() });
  };

  const field = (label: string, key: keyof CardDetails, placeholder: string, optional = false) => (
    <>
      <Text style={styles.label}>
        {label}
        {optional && <Text style={styles.optional}> (OPTIONAL)</Text>}
      </Text>
      <TextInput
        style={styles.input}
        value={details[key]}
        onChangeText={(value) => setDetails((current) => ({ ...current, [key]: value }))}
        placeholder={placeholder}
        placeholderTextColor="#8E8E93"
        autoCapitalize={key === 'memberId' || key === 'groupNumber' ? 'characters' : 'words'}
      />
    </>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onDismiss={onDismiss}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Add insurance</Text>
          {step === 'review' ? (
            <TouchableOpacity onPress={save} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.save}>Save</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 50 }} />
          )}
        </View>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          {step === 'choose' && (
            <>
              <Text style={styles.intro}>Scan your insurance card. We'll read the details for you to check.</Text>
              <TouchableOpacity style={styles.primary} onPress={takePhoto}>
                <Text style={styles.primaryText}>Take a photo of the card</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondary} onPress={choosePhoto}>
                <Text style={styles.secondaryText}>Choose a photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondary} onPress={choosePdf}>
                <Text style={styles.secondaryText}>Choose a PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkRow} onPress={onEnterByHand}>
                <Text style={styles.link}>Enter the details by hand</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'reading' && (
            <View style={styles.reading}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.intro}>Reading your card...</Text>
            </View>
          )}

          {step === 'review' && (
            <>
              <Text style={styles.intro}>Check these details against your card.</Text>
              {lowConfidence && (
                <Text style={styles.warning}>
                  Some details were hard to read. Check them carefully.{notes ? ` ${notes}` : ''}
                </Text>
              )}
              {field('Insurer', 'provider', 'e.g. Aetna')}
              {field('Plan', 'plan', 'e.g. PPO', true)}
              {field('Member ID', 'memberId', 'As printed on the card')}
              {field('Group number', 'groupNumber', 'As printed on the card', true)}
              {field('Customer service phone', 'payerPhone', 'As printed on the card', true)}
              <TouchableOpacity style={styles.linkRow} onPress={() => setStep('choose')}>
                <Text style={styles.link}>Scan again</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D0D0D5',
  },
  title: { fontSize: 17, fontWeight: '600', color: '#000' },
  cancel: { fontSize: 17, color: '#007AFF' },
  save: { fontSize: 17, fontWeight: '600', color: '#007AFF' },
  form: { paddingHorizontal: 20, paddingBottom: 48 },
  intro: { fontSize: 15, color: '#333', marginTop: 16, marginBottom: 12 },
  warning: { fontSize: 14, color: '#7A5A00', backgroundColor: '#FFF4DB', borderRadius: 10, padding: 10, marginBottom: 8 },
  primary: { backgroundColor: '#007AFF', borderRadius: 12, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  primaryText: { color: '#FFF', fontSize: 17, fontWeight: '600' },
  secondary: { backgroundColor: '#F2F2F7', borderRadius: 12, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  secondaryText: { color: '#007AFF', fontSize: 17, fontWeight: '500' },
  linkRow: { alignItems: 'center', paddingVertical: 14 },
  link: { fontSize: 15, color: '#007AFF', fontWeight: '500' },
  reading: { alignItems: 'center', paddingVertical: 60 },
  label: { fontSize: 12, fontWeight: '600', color: '#8E8E93', letterSpacing: 0.5, marginTop: 18, marginBottom: 6 },
  optional: { fontWeight: '400', letterSpacing: 0 },
  input: { backgroundColor: '#F2F2F7', borderRadius: 12, paddingHorizontal: 14, minHeight: 50, fontSize: 17, color: '#000' },
});
