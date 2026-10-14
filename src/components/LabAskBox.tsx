// Lets the user ask the chatbot a question about one lab result, with that result as context.
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { chatbotService } from '@/services/chatbotService';

export default function LabAskBox({ labName, context }: { labName: string; context: string }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const reply = await chatbotService.askHealthQuestion(trimmed, context);
      setAnswer(reply);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not get an answer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Have more questions?</Text>
      <Text style={styles.subtitle}>Ask the chatbot about your {labName} result.</Text>

      <TextInput
        style={styles.input}
        placeholder={`e.g. What can affect my ${labName}?`}
        placeholderTextColor="#999"
        value={question}
        onChangeText={setQuestion}
        multiline
        editable={!loading}
      />

      <TouchableOpacity
        style={[styles.button, (!question.trim() || loading) && styles.buttonDisabled]}
        onPress={ask}
        disabled={!question.trim() || loading}
      >
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Ask</Text>}
      </TouchableOpacity>

      {answer ? <Text style={styles.answer}>{answer}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.disclaimer}>General information only, not medical advice. Your provider can explain your results.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    minHeight: 44,
    fontSize: 15,
    color: '#000',
    backgroundColor: '#FAFAFA',
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
  answer: {
    fontSize: 14,
    lineHeight: 21,
    color: '#222',
    marginTop: 12,
  },
  error: {
    fontSize: 13,
    color: '#FF3B30',
    marginTop: 12,
  },
  disclaimer: {
    fontSize: 11,
    color: '#888',
    marginTop: 12,
  },
});
