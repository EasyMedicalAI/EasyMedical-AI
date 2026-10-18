// Add an appointment by typing or saying it, such as "Dr. Patel, cardiology, Tuesday at 2pm". The details are listed for review before saving.
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SpeechModule, speechAvailable, useSpeechEvent } from '@/services/speech';
import { UserHealthData } from '@/types/medical';
import { LogEntry, parseLogText, currentMedicationNames } from '@/services/quickLog';
import EntryReview from '@/components/EntryReview';

export default function AppointmentQuickAdd({
  userData,
  onSave,
  onEnterDetails,
}: {
  userData: UserHealthData;
  onSave: (entries: LogEntry[]) => Promise<void>;
  onEnterDetails: () => void;
}) {
  const [text, setText] = useState('');
  const [entries, setEntries] = useState<LogEntry[] | null>(null);
  const [reviewKey, setReviewKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [listening, setListening] = useState(false);

  const active = currentMedicationNames(userData);

  useSpeechEvent('start', () => setListening(true));
  useSpeechEvent('end', () => setListening(false));
  useSpeechEvent('result', (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) {
      setText(transcript);
      setEntries(null);
    }
  });
  useSpeechEvent('error', (event) => {
    setListening(false);
    if (event.error !== 'aborted') {
      Alert.alert('Could not hear that', event.message || 'Please try again, or type it instead.');
    }
  });

  const toggleListening = async () => {
    if (!speechAvailable || !SpeechModule) {
      Alert.alert('Speaking needs an app update', 'This version of the app cannot listen yet. You can still type the appointment.');
      return;
    }
    if (listening) {
      SpeechModule.stop();
      return;
    }
    const permission = await SpeechModule.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microphone off', 'Turn on Microphone and Speech Recognition for EasyMedical in Settings to speak an appointment.');
      return;
    }
    SpeechModule.start({ lang: 'en-US', interimResults: true, continuous: false });
  };

  const review = async () => {
    const note = text.trim();
    if (!note || loading) return;
    setLoading(true);
    try {
      const parsed = (await parseLogText(note, active)).filter((entry) => entry.type === 'add_appointment');
      if (parsed.length === 0) {
        Alert.alert('No appointment found', 'Try including the date, and the doctor or specialty if you have them.');
        return;
      }
      setEntries(parsed);
      setReviewKey((key) => key + 1);
      setText('');
    } catch (error) {
      Alert.alert('Could not read that', error instanceof Error ? error.message : 'Please try again, or enter the details instead.');
    } finally {
      setLoading(false);
    }
  };

  const confirm = async (toSave: LogEntry[]) => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(toSave);
      setEntries(null);
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Add an appointment</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={listening ? 'Listening...' : 'Dr. Patel, cardiology, Tuesday at 2pm'}
          placeholderTextColor="#8E8E93"
          value={text}
          onChangeText={setText}
          multiline
          editable={!loading && !saving}
        />
        <TouchableOpacity
          style={[styles.micButton, listening && styles.micButtonActive]}
          onPress={toggleListening}
          disabled={loading || saving}
          accessibilityLabel={listening ? 'Stop listening' : 'Speak the appointment'}
        >
          <MaterialCommunityIcons name={listening ? 'stop' : 'microphone-outline'} size={20} color={listening ? '#FFF' : '#333'} />
        </TouchableOpacity>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity onPress={onEnterDetails} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.link}>Enter details instead</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, (!text.trim() || loading) && styles.buttonDisabled]}
          onPress={review}
          disabled={!text.trim() || loading}
        >
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Review</Text>}
        </TouchableOpacity>
      </View>

      {entries && (
        <View style={styles.review}>
          <EntryReview
            key={reviewKey}
            entries={entries}
            active={active}
            saving={saving}
            saveLabel="Save appointment"
            onSave={confirm}
            onCancel={() => setEntries(null)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 12,
    minHeight: 50,
    fontSize: 16,
    color: '#000',
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D0D0D5',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonActive: {
    backgroundColor: '#FF3B30',
    borderColor: '#FF3B30',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  link: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#A9CFFF',
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
  },
  review: {
    marginTop: 16,
  },
});
