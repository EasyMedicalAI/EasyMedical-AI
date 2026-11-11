// AI-pinion (personal use, development builds only): a chat that works out the most likely causes of how a person
// feels, and gives a top three to talk through with a clinician. It is shown only after the person agrees that
// it is a computer, not a doctor. The agreement is asked again each time the screen opens.
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Keyboard,
  Linking,
  StyleSheet,
} from 'react-native';
import { aiPinionTurn, AiPinionResult, AiPinionTurnResponse, ChatTurn } from '@/services/aiPinionService';

const GREETING = 'Tell me what has been going on, in your own words. I will ask a few questions, then give you three possibilities to talk through with a clinician.';

interface Shown {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  emergency?: boolean;
}

export default function AiPinion({ onLeave }: { onLeave?: () => void }) {
  const [agreed, setAgreed] = useState(false);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [shown, setShown] = useState<Shown[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AiPinionResult | null>(null);
  const [stopped, setStopped] = useState(false);
  // Tappable answers for the question on screen (empty for an open question)
  const [options, setOptions] = useState<string[]>([]);
  const nextId = useRef(1);

  const reset = () => {
    setHistory([]);
    setShown([]);
    setInput('');
    setError('');
    setOptions([]);
    setResult(null);
    setStopped(false);
  };

  // Sends what is typed, or a tapped answer when one is passed in
  const send = async (tapped?: string) => {
    const text = (tapped ?? input).trim();
    if (!text || sending || result || stopped) return;
    Keyboard.dismiss();
    const previousOptions = options;
    const nextHistory: ChatTurn[] = [...history, { role: 'user', content: text }];
    setHistory(nextHistory);
    setShown((prev) => [...prev, { id: nextId.current++, role: 'user', text }]);
    setInput('');
    setError('');
    setOptions([]);
    setSending(true);
    try {
      const turn: AiPinionTurnResponse = await aiPinionTurn(nextHistory);
      if (turn.type === 'question') {
        setHistory([...nextHistory, { role: 'assistant', content: turn.text }]);
        setShown((prev) => [...prev, { id: nextId.current++, role: 'assistant', text: turn.text }]);
        setOptions(turn.options || []);
      } else if (turn.type === 'emergency') {
        setShown((prev) => [...prev, { id: nextId.current++, role: 'assistant', text: turn.text, emergency: true }]);
        setStopped(true);
      } else {
        const { type: _type, ...found } = turn;
        setResult(found);
      }
    } catch (e) {
      // Put the message back so the person can try again
      setHistory(history);
      setShown((prev) => prev.slice(0, -1));
      setOptions(previousOptions);
      setInput(text);
      setError(e instanceof Error ? e.message : 'AI-pinion could not respond right now. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (!agreed) {
    return (
      <View style={styles.container}>
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerTitle}>Before you start</Text>
          <Text style={styles.disclaimerLead}>AI-pinion is a computer program. It is not a doctor.</Text>
          <Bullet>It is not medical advice, and it cannot diagnose you.</Bullet>
          <Bullet>It can be wrong. It can misread what you tell it, and its sources are research articles, not your own records.</Bullet>
          <Bullet>Use it only to prepare for a talk with a clinician. Do not start, stop or change any treatment because of it.</Bullet>
          <Bullet>If you feel very sick, or symptoms are sudden or severe, call 911 or go to the nearest emergency room. Do not wait for AI-pinion.</Bullet>
        </View>
        <TouchableOpacity style={styles.primaryButton} onPress={() => setAgreed(true)} accessibilityRole="button">
          <Text style={styles.primaryButtonText}>I agree: this is a computer, not a doctor</Text>
        </TouchableOpacity>
        {onLeave && (
          <TouchableOpacity style={styles.secondaryButton} onPress={onLeave} accessibilityRole="button">
            <Text style={styles.secondaryButtonText}>Go back</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const canType = !sending && !result && !stopped;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Bubble role="assistant" text={GREETING} />
        {shown.map((m) => (
          <Bubble key={m.id} role={m.role} text={m.text} emergency={m.emergency} />
        ))}
        {sending && (
          <View style={styles.thinking}>
            <ActivityIndicator color="#007AFF" />
            <Text style={styles.thinkingText}>Thinking…</Text>
          </View>
        )}
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {result && <ResultView result={result} />}
        {(result || stopped) && (
          <TouchableOpacity style={styles.secondaryButton} onPress={reset} accessibilityRole="button">
            <Text style={styles.secondaryButtonText}>Start over</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.footer}>Only what you type is sent. Nothing is saved on the server.</Text>
      </ScrollView>

      {canType && options.length > 0 && (
        <View style={styles.optionBlock}>
          <Text style={styles.optionHint}>Tap an answer, or type your own below.</Text>
          <View style={styles.optionRow}>
            {options.map((o) => (
              <TouchableOpacity key={o} style={styles.optionChip} onPress={() => send(o)} accessibilityRole="button">
                <Text style={styles.optionText}>{o}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {canType && (
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Type here"
            placeholderTextColor="#8E8E93"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={1500}
          />
          <TouchableOpacity
            style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
            onPress={() => send()}
            disabled={!input.trim()}
            accessibilityRole="button"
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

function Bubble({ role, text, emergency }: { role: 'user' | 'assistant'; text: string; emergency?: boolean }) {
  const mine = role === 'user';
  return (
    <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther, emergency && styles.bubbleEmergency]}>
        <Text style={[styles.bubbleText, mine && styles.bubbleTextMine, emergency && styles.bubbleTextEmergency]}>{text}</Text>
      </View>
    </View>
  );
}

function ResultView({ result }: { result: AiPinionResult }) {
  return (
    <View style={styles.result}>
      <Text style={styles.resultTitle}>Three possibilities to talk through</Text>
      <Text style={styles.resultSummary}>{result.summary}</Text>

      {result.candidates.map((c) => (
        <View key={c.rank} style={styles.candidate}>
          <View style={styles.candidateHeader}>
            <Text style={styles.rank}>{c.rank}</Text>
            <Text style={styles.candidateName}>{c.name}</Text>
          </View>
          <Text style={styles.label}>WHY IT MAY FIT</Text>
          <Text style={styles.bodyText}>{c.why}</Text>

          {c.limitedEvidence ? (
            <Text style={styles.limited}>We found few recent articles on this one, so treat it as less certain.</Text>
          ) : (
            <>
              <Text style={styles.label}>WHAT RECENT ARTICLES SAY</Text>
              {c.articlesSay.map((p, i) => (
                <View key={i} style={styles.paragraph}>
                  <Text style={styles.bodyText}>{p.text}</Text>
                  <Text style={styles.citation}>{p.sources.map((s) => `[${s.id}]`).join(' ')}</Text>
                </View>
              ))}
            </>
          )}

          {c.askClinician.length > 0 && (
            <>
              <Text style={styles.label}>ASK YOUR CLINICIAN</Text>
              {c.askClinician.map((q, i) => (
                <Text key={i} style={styles.bodyText}>{`• ${q}`}</Text>
              ))}
            </>
          )}
        </View>
      ))}

      {result.sources.length > 0 && (
        <View style={styles.sources}>
          <Text style={styles.label}>ARTICLES USED</Text>
          {result.sources.map((s) => (
            <TouchableOpacity key={s.pmid} style={styles.sourceRow} onPress={() => Linking.openURL(s.url).catch(() => undefined)}>
              <Text style={styles.sourceId}>{s.id}</Text>
              <View style={styles.sourceText}>
                <Text style={styles.sourceTitle}>{s.title}</Text>
                <Text style={styles.sourceMeta}>{[s.journal, s.year].filter(Boolean).join(', ')}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.safety}>{result.safetyNote}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7', padding: 16, gap: 12 },
  scroll: { flex: 1 },
  scrollContent: { gap: 10, paddingBottom: 16 },
  disclaimer: { backgroundColor: '#FFF9E6', borderRadius: 16, padding: 18, gap: 10 },
  disclaimerTitle: { fontSize: 20, fontWeight: '700', color: '#5C4700' },
  disclaimerLead: { fontSize: 16, fontWeight: '600', color: '#5C4700' },
  bulletRow: { flexDirection: 'row', gap: 8 },
  bulletDot: { fontSize: 15, color: '#5C4700' },
  bulletText: { flex: 1, fontSize: 15, lineHeight: 21, color: '#5C4700' },
  primaryButton: { backgroundColor: '#007AFF', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primaryButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  secondaryButton: { borderRadius: 14, paddingVertical: 13, alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D1D1D6' },
  secondaryButtonText: { color: '#007AFF', fontSize: 15, fontWeight: '600' },
  bubbleRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '85%', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14 },
  bubbleOther: { backgroundColor: '#FFF' },
  bubbleMine: { backgroundColor: '#007AFF' },
  bubbleEmergency: { backgroundColor: '#FDECEA' },
  bubbleText: { fontSize: 16, lineHeight: 22, color: '#000' },
  bubbleTextMine: { color: '#FFF' },
  bubbleTextEmergency: { color: '#B42318', fontWeight: '600' },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thinkingText: { fontSize: 14, color: '#6C6C70' },
  errorCard: { backgroundColor: '#FDECEA', borderRadius: 14, padding: 12 },
  errorText: { fontSize: 14, color: '#B42318' },
  result: { backgroundColor: '#FFF', borderRadius: 16, padding: 18, gap: 14 },
  resultTitle: { fontSize: 20, fontWeight: '700', color: '#000' },
  resultSummary: { fontSize: 15, lineHeight: 21, color: '#3C3C43' },
  candidate: { backgroundColor: '#F2F2F7', borderRadius: 14, padding: 14, gap: 6 },
  candidateHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rank: { fontSize: 22, fontWeight: '700', color: '#007AFF', width: 26 },
  candidateName: { flex: 1, fontSize: 18, fontWeight: '600', color: '#000' },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, color: '#6C6C70', marginTop: 6 },
  bodyText: { fontSize: 15, lineHeight: 21, color: '#000' },
  paragraph: { gap: 2 },
  citation: { fontSize: 12, color: '#007AFF' },
  limited: { fontSize: 14, lineHeight: 20, color: '#5C4700', backgroundColor: '#FFF9E6', borderRadius: 10, padding: 10 },
  sources: { gap: 6 },
  sourceRow: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  sourceId: { fontSize: 13, fontWeight: '600', color: '#007AFF', width: 26 },
  sourceText: { flex: 1, gap: 2 },
  sourceTitle: { fontSize: 14, color: '#000' },
  sourceMeta: { fontSize: 12, color: '#6C6C70' },
  safety: { fontSize: 13, lineHeight: 18, color: '#6C6C70' },
  optionBlock: { gap: 8 },
  optionHint: { fontSize: 13, color: '#6C6C70' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#007AFF' },
  optionText: { fontSize: 15, color: '#007AFF', fontWeight: '500' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    backgroundColor: '#FFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#000',
  },
  sendButton: { backgroundColor: '#007AFF', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18 },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  footer: { fontSize: 12, color: '#8E8E93', textAlign: 'center', marginTop: 8 },
});
