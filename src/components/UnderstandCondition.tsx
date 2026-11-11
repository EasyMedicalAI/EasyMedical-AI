// Understand your condition: trusted, plain-language information on a condition, from MedlinePlus.
// Layout: ask first. The person asks a question, sees a general answer, then opens the trusted pages.
// It explains and points to sources. It does not diagnose or recommend treatment.
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Keyboard, Linking, StyleSheet } from 'react-native';
import { healthTopics, HealthTopic } from '@/services/medlinePlus';
import { chatbotService } from '@/services/chatbotService';

const SUGGESTED_QUESTIONS = ['What are the common signs?', 'Which doctor treats it?', 'What should I ask my doctor?'];

interface Lookup {
  condition: string;
  topics?: HealthTopic[];
  error?: string;
}

interface Answer {
  condition: string;
  text?: string;
  error?: string;
}

export default function UnderstandCondition({ conditions }: { conditions: string[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [typed, setTyped] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [asking, setAsking] = useState(false);

  // The first condition is shown when the screen opens
  const condition = selected ?? conditions[0] ?? null;

  // Asks the health assistant about the condition shown. General information only, no records are sent.
  // A suggested question passes its text directly; otherwise the typed question is used.
  const askQuestion = async (suggested?: string) => {
    const text = (suggested ?? question).trim();
    if (!text || !condition || asking) return;
    Keyboard.dismiss();
    const forCondition = condition;
    setAsking(true);
    setAnswer(null);
    try {
      const reply = await chatbotService.askHealthQuestion(
        `My question is about ${forCondition}. Give general information only, not a diagnosis or treatment. My question: ${text}`
      );
      setAnswer({ condition: forCondition, text: reply });
      setQuestion('');
    } catch (e) {
      setAnswer({ condition: forCondition, error: e instanceof Error ? e.message : 'Could not get an answer. Please try again.' });
    } finally {
      setAsking(false);
    }
  };

  // Looks up a condition the person typed, even if it is not in their records
  const lookUpTyped = () => {
    const name = typed.trim();
    if (!name) return;
    Keyboard.dismiss();
    setSelected(name);
    setTyped('');
  };

  useEffect(() => {
    if (!condition) return;
    let cancelled = false;
    healthTopics(condition)
      .then((topics) => {
        if (!cancelled) setLookup({ condition, topics });
      })
      .catch((e) => {
        if (!cancelled) setLookup({ condition, error: e instanceof Error ? e.message : 'Could not load information. Please try again.' });
      });
    return () => {
      cancelled = true;
    };
  }, [condition]);

  // Results only count for the condition that is shown now
  const current = lookup && lookup.condition === condition ? lookup : null;
  const loading = !!condition && !current;
  const currentAnswer = answer && answer.condition === condition ? answer : null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>What do you want to know?</Text>

      {conditions.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No conditions yet</Text>
          <Text style={styles.emptyText}>Add a condition to your records, or type one below to find trusted information about it.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionLabel}>CONDITION</Text>
          <View style={styles.chips}>
            {conditions.map((name) => {
              const isOn = name === condition;
              return (
                <TouchableOpacity
                  key={name}
                  style={[styles.chip, isOn && styles.chipOn]}
                  onPress={() => setSelected(name)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isOn }}
                >
                  <Text style={[styles.chipText, isOn && styles.chipTextOn]}>{name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      <Text style={styles.sectionLabel}>OR TYPE YOUR OWN</Text>
      <View style={styles.typeRow}>
        <TextInput
          style={styles.input}
          value={typed}
          onChangeText={setTyped}
          placeholder="For example, psoriatic arthritis"
          placeholderTextColor="#8E8E93"
          maxLength={100}
          returnKeyType="search"
          onSubmitEditing={lookUpTyped}
          autoCorrect={false}
          accessibilityLabel="Type a condition to look up"
        />
        <TouchableOpacity
          style={[styles.lookUpButton, !typed.trim() && styles.lookUpButtonOff]}
          onPress={lookUpTyped}
          disabled={!typed.trim()}
          accessibilityRole="button"
        >
          <Text style={styles.lookUpText}>Look up</Text>
        </TouchableOpacity>
      </View>

      {condition && (
        <>
          <Text style={styles.heading}>Ask about {condition}</Text>
          <View style={styles.typeRow}>
            <TextInput
              style={styles.input}
              value={question}
              onChangeText={setQuestion}
              placeholder="Type your question"
              placeholderTextColor="#8E8E93"
              maxLength={300}
              returnKeyType="send"
              onSubmitEditing={() => askQuestion()}
              accessibilityLabel="Type a question about this condition"
            />
            <TouchableOpacity
              style={[styles.lookUpButton, (!question.trim() || asking) && styles.lookUpButtonOff]}
              onPress={() => askQuestion()}
              disabled={!question.trim() || asking}
              accessibilityRole="button"
            >
              <Text style={styles.lookUpText}>{asking ? 'Asking…' : 'Ask'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chips}>
            {SUGGESTED_QUESTIONS.map((suggested) => (
              <TouchableOpacity
                key={suggested}
                style={[styles.chip, asking && styles.lookUpButtonOff]}
                onPress={() => askQuestion(suggested)}
                disabled={asking}
                accessibilityRole="button"
              >
                <Text style={styles.chipText}>{suggested}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {asking && <ActivityIndicator style={styles.loading} color="#007AFF" />}

          {currentAnswer?.text ? (
            <View style={styles.answerCard}>
              <Text style={styles.answerLabel}>ANSWER</Text>
              <Text style={styles.answerText}>{currentAnswer.text}</Text>
              <Text style={styles.answerNote}>From the health assistant. General information, not medical advice.</Text>
            </View>
          ) : null}
          {currentAnswer?.error ? <Text style={styles.askError}>{currentAnswer.error}</Text> : null}

          <Text style={styles.sectionLabel}>TRUSTED PAGES</Text>

          {loading && <ActivityIndicator style={styles.loading} color="#007AFF" />}

          {current?.error ? <Text style={styles.error}>{current.error}</Text> : null}

          {current?.topics && current.topics.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                We didn’t find an exact match for “{condition}” on MedlinePlus. Ask your doctor for reliable sources.
              </Text>
            </View>
          )}

          {current?.topics && current.topics.length > 0 && (
            <>
              <View style={styles.list}>
                {current.topics.map((topic, index) => (
                  <TouchableOpacity
                    key={topic.url}
                    style={[styles.row, index > 0 && styles.rowBorder]}
                    onPress={() => Linking.openURL(topic.url).catch(() => undefined)}
                    accessibilityRole="link"
                  >
                    <Text style={styles.rowTitle}>{topic.title}</Text>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.source}>Source: MedlinePlus, from the U.S. National Library of Medicine</Text>
            </>
          )}
        </>
      )}

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>General information, not medical advice</Text>
        <Text style={styles.noticeText}>
          These pages explain a condition in general. They don’t diagnose you or recommend treatment. Your doctor can tell you what applies to you.
        </Text>
      </View>

      <View style={styles.emergency}>
        <Text style={styles.emergencyTitle}>Severe or sudden symptoms?</Text>
        <Text style={styles.emergencyText}>Call 911 or go to the nearest emergency room. Don’t wait to read about it.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16 },
  title: { fontSize: 28, fontWeight: '700', color: '#000', marginBottom: 8, paddingHorizontal: 4 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#8E8E93', letterSpacing: 0.5, marginTop: 18, marginBottom: 8, paddingHorizontal: 4 },
  heading: { fontSize: 20, fontWeight: '600', color: '#000', marginTop: 22, marginBottom: 10, paddingHorizontal: 4 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  input: { flex: 1, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D1D1D6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: '#000' },
  lookUpButton: { backgroundColor: '#007AFF', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11 },
  lookUpButtonOff: { opacity: 0.4 },
  lookUpText: { fontSize: 15, color: '#FFF', fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 2, marginTop: 10 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: '#D1D1D6', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FFF' },
  chipOn: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  chipText: { fontSize: 15, color: '#000' },
  chipTextOn: { color: '#FFF', fontWeight: '600' },
  loading: { marginVertical: 20 },
  answerCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 18, marginTop: 14, gap: 8 },
  answerLabel: { fontSize: 12, fontWeight: '600', color: '#8E8E93', letterSpacing: 0.5 },
  answerText: { fontSize: 16, color: '#000', lineHeight: 23 },
  answerNote: { fontSize: 13, color: '#8E8E93', lineHeight: 18 },
  askError: { fontSize: 15, color: '#B42318', lineHeight: 21, marginTop: 12, paddingHorizontal: 4 },
  list: { backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E5EA' },
  rowTitle: { flex: 1, fontSize: 16, color: '#000', paddingRight: 8 },
  chevron: { fontSize: 22, color: '#8E8E93' },
  error: { fontSize: 15, color: '#B42318', textAlign: 'center', marginTop: 12, paddingHorizontal: 20, lineHeight: 21 },
  source: { fontSize: 13, color: '#8E8E93', textAlign: 'center', marginTop: 10, marginBottom: 8 },
  notice: { backgroundColor: '#FFF9E6', borderRadius: 14, padding: 16, marginTop: 22, gap: 6 },
  noticeTitle: { fontSize: 15, fontWeight: '600', color: '#5C4700' },
  noticeText: { fontSize: 14, color: '#5C4700', lineHeight: 20 },
  emptyCard: { backgroundColor: '#F2F2F7', borderRadius: 14, padding: 18, marginTop: 16, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#000' },
  emptyText: { fontSize: 15, color: '#3C3C43', lineHeight: 22, textAlign: 'center' },
  emergency: { backgroundColor: '#FDECEA', borderRadius: 14, padding: 16, marginTop: 22, gap: 6 },
  emergencyTitle: { fontSize: 15, fontWeight: '600', color: '#B42318' },
  emergencyText: { fontSize: 14, color: '#7A271A', lineHeight: 20 },
});
