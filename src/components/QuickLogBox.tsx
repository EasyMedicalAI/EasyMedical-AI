// Type or speak a note such as "today my weight is 182". The entries are shown for confirmation before anything is saved.
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { SpeechModule, speechAvailable, useSpeechEvent } from '@/services/speech';
import { UserHealthData } from '@/types/medical';
import { LogEntry, parseLogText, describeEntry, savableEntries, currentMedicationNames } from '@/services/quickLog';

export default function QuickLogBox({
  userData,
  onSave,
}: {
  userData: UserHealthData;
  onSave: (entries: LogEntry[]) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [entries, setEntries] = useState<LogEntry[] | null>(null);
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
      setEntries(parsed.length > 0 ? parsed : [{ type: 'unclear', message: 'Nothing to log. Try saying it another way.' }]);
    } catch (error) {
      Alert.alert('Could not log that', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    if (!entries) return;
    const toSave = savableEntries(entries, active);
    if (toSave.length === 0) return;
    setSaving(true);
    try {
      await onSave(toSave);
      setEntries(null);
      setText('');
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => setEntries(null);

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Log something</Text>
      <Text style={styles.hint}>
        Try "my weight is 182", "I just started Losartan 50 mg", or "I slept 7 hours".
      </Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={listening ? 'Listening...' : 'Type, or tap the microphone to speak'}
          placeholderTextColor="#999"
          value={text}
          onChangeText={(value) => {
            setText(value);
            if (entries) setEntries(null);
          }}
          multiline
          editable={!loading && !saving}
        />
        <TouchableOpacity
          style={[styles.micButton, listening && styles.micButtonActive]}
          onPress={toggleListening}
          disabled={loading || saving}
          accessibilityLabel={listening ? 'Stop listening' : 'Speak your note'}
        >
          <Text style={styles.micIcon}>{listening ? '■' : '🎤'}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, (!text.trim() || loading) && styles.buttonDisabled]}
        onPress={send}
        disabled={!text.trim() || loading}
      >
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Review</Text>}
      </TouchableOpacity>

      {entries && (
        <View style={styles.confirm}>
          <Text style={styles.confirmTitle}>Please check before saving</Text>
          {entries.map((entry, index) => (
            <Text key={index} style={entry.type === 'unclear' ? styles.questionLine : styles.entryLine}>
              {entry.type === 'unclear' ? '? ' : '• '}
              {describeEntry(entry, active)}
            </Text>
          ))}

          <View style={styles.confirmButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={cancel} disabled={saving}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, savableEntries(entries, active).length === 0 && styles.buttonDisabled]}
              onPress={confirm}
              disabled={savableEntries(entries, active).length === 0 || saving}
            >
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Save</Text>}
            </TouchableOpacity>
          </View>
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
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    marginBottom: 10,
    lineHeight: 17,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    minHeight: 44,
    fontSize: 15,
    color: '#000',
    backgroundColor: '#FAFAFA',
  },
  micButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#E8F1FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonActive: {
    backgroundColor: '#FF3B30',
  },
  micIcon: {
    fontSize: 20,
    color: '#FFF',
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
    fontWeight: '700',
    fontSize: 15,
  },
  confirm: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F7F9FC',
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  confirmTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  entryLine: {
    fontSize: 14,
    color: '#222',
    marginBottom: 6,
    lineHeight: 20,
  },
  questionLine: {
    fontSize: 14,
    color: '#B45309',
    marginBottom: 6,
    lineHeight: 20,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    color: '#007AFF',
    fontWeight: '700',
    fontSize: 15,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
});
