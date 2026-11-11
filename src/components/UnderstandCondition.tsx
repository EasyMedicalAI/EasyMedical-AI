// Understand your condition: trusted, plain-language information on a condition, from MedlinePlus.
// It explains and points to sources. It does not diagnose or recommend treatment.
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Keyboard, Linking, StyleSheet } from 'react-native';
import { healthTopics, HealthTopic } from '@/services/medlinePlus';

interface Lookup {
  condition: string;
  topics?: HealthTopic[];
  error?: string;
}

export default function UnderstandCondition({ conditions }: { conditions: string[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [typed, setTyped] = useState('');

  // The first condition is shown when the screen opens
  const condition = selected ?? conditions[0] ?? null;

  // Looks up a condition the person typed, even if it is not in their records
  const lookUpTyped = () => {
    const name = typed.trim();
    if (!name) return;
    Keyboard.dismiss();
    setSelected(name);
    setTyped('');
  };

  const typeOwn = (
    <>
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
    </>
  );

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

  return (
    <View style={styles.wrap}>
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>General information, not medical advice</Text>
        <Text style={styles.noticeText}>
          These pages explain a condition in general. They don’t diagnose you or recommend treatment. Your doctor can tell you what applies to you.
        </Text>
      </View>

      {conditions.length === 0 ? (
        <>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No conditions yet</Text>
            <Text style={styles.emptyText}>Add a condition to your records, or type one below to find trusted information about it.</Text>
          </View>
          {typeOwn}
        </>
      ) : (
        <>
          <Text style={styles.sectionLabel}>CHOOSE A CONDITION</Text>
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
          {typeOwn}

          {condition && <Text style={styles.heading}>About {condition}</Text>}

          {loading && <ActivityIndicator style={styles.loading} color="#007AFF" />}

          {current?.error ? <Text style={styles.error}>{current.error}</Text> : null}

          {current?.topics && current.topics.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                We didn’t find an exact match for “{condition}” on MedlinePlus. Ask your doctor for reliable sources.
              </Text>
            </View>
          )}

          {current?.topics?.map((topic) => (
            <View key={topic.url} style={styles.card}>
              <Text style={styles.topicTitle}>{topic.title}</Text>
              {topic.summary ? <Text style={styles.topicSummary}>{topic.summary}</Text> : null}
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => Linking.openURL(topic.url).catch(() => undefined)}
                accessibilityRole="link"
              >
                <Text style={styles.linkText}>Read the full page on MedlinePlus</Text>
              </TouchableOpacity>
            </View>
          ))}

          {current?.topics && current.topics.length > 0 && (
            <Text style={styles.source}>Source: MedlinePlus, from the U.S. National Library of Medicine</Text>
          )}
        </>
      )}

      <View style={styles.emergency}>
        <Text style={styles.emergencyTitle}>Severe or sudden symptoms?</Text>
        <Text style={styles.emergencyText}>Call 911 or go to the nearest emergency room. Don’t wait to read about it.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  input: { flex: 1, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D1D1D6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: '#000' },
  lookUpButton: { backgroundColor: '#007AFF', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11 },
  lookUpButtonOff: { opacity: 0.4 },
  lookUpText: { fontSize: 15, color: '#FFF', fontWeight: '600' },
  notice: { backgroundColor: '#FFF9E6', borderRadius: 14, padding: 16, marginBottom: 18, gap: 6 },
  noticeTitle: { fontSize: 15, fontWeight: '600', color: '#5C4700' },
  noticeText: { fontSize: 14, color: '#5C4700', lineHeight: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#8E8E93', letterSpacing: 0.5, marginBottom: 8, paddingHorizontal: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 2 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: '#D1D1D6', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FFF' },
  chipOn: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  chipText: { fontSize: 15, color: '#000' },
  chipTextOn: { color: '#FFF', fontWeight: '600' },
  heading: { fontSize: 22, fontWeight: '600', color: '#000', marginTop: 22, marginBottom: 12, paddingHorizontal: 4 },
  loading: { marginVertical: 24 },
  error: { fontSize: 15, color: '#B42318', textAlign: 'center', marginTop: 12, paddingHorizontal: 20, lineHeight: 21 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: '#E5E5EA', gap: 10 },
  topicTitle: { fontSize: 18, fontWeight: '600', color: '#000' },
  topicSummary: { fontSize: 16, color: '#333', lineHeight: 24 },
  linkButton: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: '#E5F0FF' },
  linkText: { fontSize: 15, color: '#007AFF', fontWeight: '600' },
  source: { fontSize: 13, color: '#8E8E93', textAlign: 'center', marginTop: 4, marginBottom: 8 },
  emptyCard: { backgroundColor: '#F2F2F7', borderRadius: 14, padding: 18, marginTop: 16, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#000' },
  emptyText: { fontSize: 15, color: '#3C3C43', lineHeight: 22, textAlign: 'center' },
  emergency: { backgroundColor: '#FDECEA', borderRadius: 14, padding: 16, marginTop: 22, gap: 6 },
  emergencyTitle: { fontSize: 15, fontWeight: '600', color: '#B42318' },
  emergencyText: { fontSize: 14, color: '#7A271A', lineHeight: 20 },
});
