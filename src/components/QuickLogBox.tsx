// Type or speak a note such as "my weight is 182". The entries are listed for review. Tap one to change it, then save.
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SpeechModule, speechAvailable, useSpeechEvent } from '@/services/speech';
import { UserHealthData } from '@/types/medical';
import { LogEntry, parseLogText, currentMedicationNames } from '@/services/quickLog';
import EntryReview from '@/components/EntryReview';

export default function QuickLogBox({
  userData,
  onSave,
}: {
  userData: UserHealthData;
  onSave: (entries: LogEntry[]) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [entries, setEntries] = useState<LogEntry[] | null>(null);
  // Changes each time a note is read, so the review starts fresh
  const [reviewKey, setReviewKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [listening, setListening] = useState(false);

  const active = currentMedicationNames(userData);

  // Speech fills the text box as the person talks; they still review it and tap Review
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
      Alert.alert('Speaking needs an app update', 'This version of the app cannot listen yet. You can still type your note.');
      return;
    }
    if (listening) {
      SpeechModule.stop();
      return;
    }
    const permission = await SpeechModule.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microphone off', 'Turn on Microphone and Speech Recognition for EasyMedical in Settings to speak your notes.');
      return;
    }
    SpeechModule.start({ lang: 'en-US', interimResults: true, continuous: false });
  };

  const send = async () => {
    const note = text.trim();
    if (!note || loading) return;
    setLoading(true);
    try {
      const parsed = await parseLogText(note, active);
      setEntries(parsed.length > 0 ? parsed : [{ type: 'unclear', message: 'Nothing to log. Try saying it another way.' } as LogEntry]);
      setReviewKey((key) => key + 1);
      setText('');
    } catch (error) {
      Alert.alert('Could not log that', error instanceof Error ? error.message : 'Please try again.');
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
      <Text style={styles.title}>Quick Log</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={listening ? 'Listening...' : 'Type, or tap the microphone to speak'}
          placeholderTextColor="#999"
          value={text}
          onChangeText={setText}
          multiline
          editable={!loading && !saving}
        />
        <TouchableOpacity
          style={[styles.micButton, listening && styles.micButtonActive]}
          onPress={toggleListening}
          disabled={loading || saving}
          accessibilityLabel={listening ? 'Stop listening' : 'Speak your note'}
        >
          <MaterialCommunityIcons name={listening ? 'stop' : 'microphone-outline'} size={20} color={listening ? '#FFF' : '#333'} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, (!text.trim() || loading) && styles.buttonDisabled]}
        onPress={send}
        disabled={!text.trim() || loading}
      >
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Review</Text>}
      </TouchableOpacity>

      <Text style={styles.hint}>For example: my weight is 182, I slept 7 hours</Text>

      {entries && (
        <View style={styles.review}>
          <EntryReview
            key={reviewKey}
            entries={entries}
            active={active}
            saving={saving}
            saveLabel="Save"
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
    marginBottom: 32,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 10,
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D0D0D5',
    borderRadius: 10,
    padding: 12,
    minHeight: 44,
    fontSize: 15,
    color: '#000',
    backgroundColor: '#FFF',
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
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
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
