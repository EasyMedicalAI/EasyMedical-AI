// AI-pinion (personal use, development builds only): a chat that works out the most likely causes of how a person
// feels, and gives a top three to talk through with a clinician. It is shown only after the person agrees that
// it is a computer, not a doctor. The agreement is asked again each time the screen opens, but the chat itself is
// kept in memory, so closing the screen does not lose it. Results are saved only when the person taps Save, and
// they stay on this phone. Nothing is sent to the server for saving.
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Keyboard,
  Linking,
  StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  aiPinionArticles,
  aiPinionTurn,
  AiPinionOutline,
  AiPinionParagraph,
  AiPinionResult,
  ChatTurn,
} from '@/services/aiPinionService';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SpeechModule, speechAvailable, useSpeechEvent } from '@/services/speech';

const DESCRIPTION =
  'A computer program that helps you think through what might be going on, so you can talk it over with a doctor.';

const GREETING ='Tell me what has been going on, in your own words. I will ask a few questions, then give you three possibilities to talk through with a clinician.';

const SAVED_KEY = 'aipinion.saved.v1';

interface Shown {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  emergency?: boolean;
}

// A result the person chose to keep, with the conversation that led to it
interface SavedItem {
  id: string;
  savedAt: string;
  title: string;
  shown: { role: 'user' | 'assistant'; text: string; emergency: boolean }[];
  result: AiPinionResult;
}

interface ChatState {
  history: ChatTurn[];
  shown: Shown[];
  nextId: number;
  input: string;
  // Tappable answers for the question on screen (empty for an open question)
  options: string[];
  // 'asking': waiting for the next question. 'articles': looking up articles for the three possibilities.
  stage: 'idle' | 'asking' | 'articles';
  error: string;
  // The three possibilities, shown before their articles arrive
  pending: AiPinionOutline[] | null;
  result: AiPinionResult | null;
  stopped: boolean;
  // The id of the saved copy of this result, once it has been saved
  savedId: string | null;
}

const freshChat = (): ChatState => ({
  history: [],
  shown: [],
  nextId: 1,
  input: '',
  options: [],
  stage: 'idle',
  error: '',
  pending: null,
  result: null,
  stopped: false,
  savedId: null,
});

// The chat lives here, outside the component, so it survives closing the screen partway through a reply.
let savedChat: ChatState = freshChat();

// Saved results are read and written on this phone only. A failure is reported, not thrown.
async function loadSaved(): Promise<SavedItem[]> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_KEY);
    return raw ? (JSON.parse(raw) as SavedItem[]) : [];
  } catch {
    return [];
  }
}

async function writeSaved(items: SavedItem[]): Promise<boolean> {
  try {
    await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

const messageOf = (e: unknown) =>
  e instanceof Error ? e.message : 'AI-pinion could not respond right now. Please try again.';

const addBubble = (c: ChatState, role: 'user' | 'assistant', text: string, emergency = false): ChatState => ({
  ...c,
  nextId: c.nextId + 1,
  shown: [...c.shown, { id: c.nextId, role, text, emergency }],
});

export default function AiPinion({ onLeave }: { onLeave?: () => void }) {
  const [agreed, setAgreed] = useState(false);
  const [chat, setChat] = useState<ChatState>(savedChat);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [view, setView] = useState<'chat' | 'saved'>('chat');
  const [openSaved, setOpenSaved] = useState<SavedItem | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadSaved().then(setSaved);
  }, []);

  // Every change goes through here. Replies that arrive after the screen closed are still saved.
  const update = (change: (c: ChatState) => ChatState) => {
    savedChat = change(savedChat);
    setChat(savedChat);
  };

  // Looks up articles for the three possibilities. They stay on screen if the lookup fails, so it can be retried.
  const loadArticles = async (history: ChatTurn[], candidates: AiPinionOutline[]) => {
    update((c) => ({ ...c, stage: 'articles', error: '' }));
    try {
      const found = await aiPinionArticles(history, candidates.map((x) => x.name));
      if (found.type === 'emergency') {
        update((c) => ({ ...addBubble(c, 'assistant', found.text, true), stage: 'idle', pending: null, stopped: true }));
        return;
      }
      const result: AiPinionResult = {
        summary: found.summary,
        sources: found.sources,
        safetyNote: found.safetyNote,
        candidates: candidates.map((x) => {
          const articles = found.candidates.find((a) => a.name.toLowerCase() === x.name.toLowerCase());
          return {
            ...x,
            articlesSay: articles?.articlesSay ?? [],
            limitedEvidence: articles?.limitedEvidence ?? true,
          };
        }),
      };
      update((c) => ({ ...c, stage: 'idle', pending: null, result }));
    } catch (e) {
      update((c) => ({ ...c, stage: 'idle', error: messageOf(e) }));
    }
  };

  // Sends what is typed, or a tapped answer when one is passed in
  const send = async (tapped?: string) => {
    const current = savedChat;
    const text = (tapped ?? current.input).trim();
    if (!text || current.stage !== 'idle' || current.result || current.stopped || current.pending) return;
    Keyboard.dismiss();
    const history: ChatTurn[] = [...current.history, { role: 'user', content: text }];
    update((c) => ({ ...addBubble(c, 'user', text), history, input: '', error: '', options: [], stage: 'asking' }));

    const turn = await aiPinionTurn(history).catch((e: unknown) => {
      // Put the message back so the person can try again
      update((c) => ({
        ...c,
        history: current.history,
        shown: current.shown,
        nextId: current.nextId,
        options: current.options,
        input: text,
        stage: 'idle',
        error: messageOf(e),
      }));
      return null;
    });
    if (!turn) return;

    if (turn.type === 'question') {
      update((c) => ({
        ...addBubble(c, 'assistant', turn.text),
        history: [...history, { role: 'assistant', content: turn.text }],
        options: turn.options || [],
        stage: 'idle',
      }));
    } else if (turn.type === 'emergency') {
      update((c) => ({ ...addBubble(c, 'assistant', turn.text, true), stage: 'idle', stopped: true }));
    } else {
      // The three possibilities show at once, and their articles follow
      update((c) => ({ ...c, pending: turn.candidates, options: [], stage: 'idle' }));
      await loadArticles(history, turn.candidates);
    }
  };

  const startOver = () => update(() => freshChat());

  // Keeps the finished result and the conversation that led to it, on this phone only
  const saveResult = async () => {
    const current = savedChat;
    if (!current.result || current.savedId) return;
    const firstWords = current.history.find((m) => m.role === 'user')?.content ?? 'Saved result';
    const item: SavedItem = {
      id: String(Date.now()),
      savedAt: new Date().toISOString(),
      title: firstWords.slice(0, 80),
      shown: current.shown.map(({ role, text, emergency }) => ({ role, text, emergency: !!emergency })),
      result: current.result,
    };
    const next = [item, ...saved];
    setSaved(next);
    update((c) => ({ ...c, savedId: item.id }));
    if (!(await writeSaved(next))) {
      setSaved(saved);
      update((c) => ({ ...c, savedId: null }));
      Alert.alert('Could not save', 'This phone did not save the result. Please try again.');
    }
  };

  const deleteSaved = (item: SavedItem) => {
    Alert.alert('Delete this saved result?', 'It will be removed from this phone. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const next = saved.filter((s) => s.id !== item.id);
          setSaved(next);
          setOpenSaved(null);
          if (savedChat.savedId === item.id) update((c) => ({ ...c, savedId: null }));
          await writeSaved(next);
        },
      },
    ]);
  };

  const [listening, setListening] = useState(false);
  // Speech fills the box as the person talks. They check it, then tap Send.
  useSpeechEvent('start', () => setListening(true));
  useSpeechEvent('end', () => setListening(false));
  useSpeechEvent('result', (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) update((c) => ({ ...c, input: transcript }));
  });
  useSpeechEvent('error', (event) => {
    setListening(false);
    if (event.error !== 'aborted') {
      Alert.alert('Could not hear that', event.message || 'Please try again, or type it instead.');
    }
  });

  const toggleListening = async () => {
    if (!speechAvailable || !SpeechModule) {
      Alert.alert('Speaking needs an app update', 'This version of the app cannot listen yet. You can still type your message.');
      return;
    }
    if (listening) {
      SpeechModule.stop();
      return;
    }
    const permission = await SpeechModule.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microphone off', 'Turn on Microphone and Speech Recognition for EasyMedical in Settings to speak your answers.');
      return;
    }
    SpeechModule.start({ lang: 'en-US', interimResults: true, continuous: false });
  };

  if (!agreed) {
    return (
      <View style={[styles.container, styles.belowTitle]}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.intro}>
            <Text style={styles.introText}>{DESCRIPTION}</Text>
          </View>
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
        </ScrollView>
      </View>
    );
  }

  if (view === 'saved') {
    return (
      <SavedList
        saved={saved}
        openSaved={openSaved}
        onOpen={setOpenSaved}
        onCloseOpen={() => setOpenSaved(null)}
        onDelete={deleteSaved}
        onBack={() => {
          setOpenSaved(null);
          setView('chat');
        }}
      />
    );
  }

  const canType = chat.stage === 'idle' && !chat.result && !chat.stopped && !chat.pending;
  const showPossibilities = chat.pending !== null || chat.result !== null;

  return (
    <View style={[styles.container, styles.belowTitle]}>
      <View style={styles.intro}>
        <Text style={styles.introText}>{DESCRIPTION}</Text>
      </View>
      {saved.length > 0 && (
        <TouchableOpacity style={styles.savedChip} onPress={() => setView('saved')} accessibilityRole="button">
          <MaterialCommunityIcons name="bookmark-outline" size={16} color="#007AFF" />
          <Text style={styles.savedChipText}>Saved results ({saved.length})</Text>
        </TouchableOpacity>
      )}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          // Keeps the newest question and its answers in view, unless the results are showing
          if (!chat.result && !chat.pending) scrollRef.current?.scrollToEnd({ animated: true });
        }}
      >
        <Bubble role="assistant" text={GREETING} />
        {chat.shown.map((m) => (
          <Bubble key={m.id} role={m.role} text={m.text} emergency={m.emergency} />
        ))}
        {canType &&
          chat.options.map((o) => (
            <TouchableOpacity key={o} style={styles.optionButton} onPress={() => send(o)} accessibilityRole="button">
              <Text style={styles.optionText}>{o}</Text>
            </TouchableOpacity>
          ))}
        {chat.stage === 'asking' && (
          <View style={styles.thinking}>
            <ActivityIndicator color="#007AFF" />
            <Text style={styles.thinkingText}>Thinking…</Text>
          </View>
        )}
        {chat.error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{chat.error}</Text>
          </View>
        ) : null}
        {showPossibilities && (
          <Possibilities
            candidates={chat.result ? chat.result.candidates : chat.pending ?? []}
            result={chat.result}
            loading={chat.stage === 'articles'}
            onRetry={chat.pending && chat.stage === 'idle' ? () => loadArticles(savedChat.history, savedChat.pending ?? []) : undefined}
          />
        )}
        {chat.result && chat.stage === 'idle' && (
          chat.savedId ? (
            <Text style={styles.savedNote}>Saved on this phone.</Text>
          ) : (
            <TouchableOpacity style={styles.secondaryButton} onPress={saveResult} accessibilityRole="button">
              <Text style={styles.secondaryButtonText}>Save this result</Text>
            </TouchableOpacity>
          )
        )}
        {chat.stage === 'idle' && chat.history.length > 0 && (
          <TouchableOpacity style={styles.secondaryButton} onPress={startOver} accessibilityRole="button">
            <Text style={styles.secondaryButtonText}>Start over</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.footer}>Only what you type is sent. Nothing is saved on the server.</Text>
      </ScrollView>

      {canType && (
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder={listening ? 'Listening…' : 'Type, or tap the microphone to speak'}
            placeholderTextColor="#8E8E93"
            value={chat.input}
            onChangeText={(input) => update((c) => ({ ...c, input }))}
            multiline
            maxLength={1500}
          />
          <TouchableOpacity
            style={[styles.micButton, listening && styles.micButtonActive]}
            onPress={toggleListening}
            accessibilityRole="button"
            accessibilityLabel={listening ? 'Stop listening' : 'Speak your answer'}
          >
            <MaterialCommunityIcons name={listening ? 'stop' : 'microphone-outline'} size={20} color={listening ? '#FFF' : '#007AFF'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sendButton, !chat.input.trim() && styles.sendButtonDisabled]}
            onPress={() => send()}
            disabled={!chat.input.trim()}
            accessibilityRole="button"
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// The list of saved results, and one saved result opened in full
function SavedList({
  saved,
  openSaved,
  onOpen,
  onCloseOpen,
  onDelete,
  onBack,
}: {
  saved: SavedItem[];
  openSaved: SavedItem | null;
  onOpen: (item: SavedItem) => void;
  onCloseOpen: () => void;
  onDelete: (item: SavedItem) => void;
  onBack: () => void;
}) {
  return (
    <View style={[styles.container, styles.belowTitle]}>
      <TouchableOpacity style={styles.secondaryButton} onPress={onBack} accessibilityRole="button">
        <Text style={styles.secondaryButtonText}>Back to chat</Text>
      </TouchableOpacity>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {openSaved ? (
          <>
            <TouchableOpacity onPress={onCloseOpen} accessibilityRole="button">
              <Text style={styles.linkText}>All saved results</Text>
            </TouchableOpacity>
            {openSaved.shown.map((m, i) => (
              <Bubble key={i} role={m.role} text={m.text} emergency={m.emergency} />
            ))}
            <Possibilities candidates={openSaved.result.candidates} result={openSaved.result} loading={false} />
            <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(openSaved)} accessibilityRole="button">
              <Text style={styles.deleteButtonText}>Delete this saved result</Text>
            </TouchableOpacity>
          </>
        ) : saved.length === 0 ? (
          <Text style={styles.footer}>No saved results yet.</Text>
        ) : (
          saved.map((item) => (
            <TouchableOpacity key={item.id} style={styles.savedRow} onPress={() => onOpen(item)} accessibilityRole="button">
              <Text style={styles.savedTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.savedMeta}>
                {new Date(item.savedAt).toLocaleDateString()} · {item.result.candidates.map((c) => c.name).join(', ')}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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

// The three possibilities. Articles and their summaries are added when they arrive.
function Possibilities({
  candidates,
  result,
  loading,
  onRetry,
}: {
  candidates: AiPinionOutline[];
  result: AiPinionResult | null;
  loading: boolean;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.result}>
      <Text style={styles.resultTitle}>Three possibilities to talk through</Text>
      {result && <Text style={styles.resultSummary}>{result.summary}</Text>}

      {candidates.map((c) => {
        const found = result?.candidates.find((r) => r.rank === c.rank);
        return (
          <View key={c.rank} style={styles.candidate}>
            <View style={styles.candidateHeader}>
              <Text style={styles.rank}>{c.rank}</Text>
              <Text style={styles.candidateName}>{c.name}</Text>
            </View>
            <Text style={styles.label}>BASED ON WHAT YOU TOLD US</Text>
            <Text style={styles.bodyText}>{c.why}</Text>

            {found && found.limitedEvidence && (
              <Text style={styles.limited}>We found few recent articles on this one, so treat it as less certain.</Text>
            )}
            {found && !found.limitedEvidence && (
              <>
                <Text style={styles.label}>WHAT RECENT ARTICLES SAY</Text>
                {found.articlesSay.map((p: AiPinionParagraph, i: number) => (
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
        );
      })}

      {loading && (
        <View style={styles.thinking}>
          <ActivityIndicator color="#007AFF" />
          <Text style={styles.thinkingText}>Looking up recent articles for these three…</Text>
        </View>
      )}
      {onRetry && (
        <TouchableOpacity style={styles.secondaryButton} onPress={onRetry} accessibilityRole="button">
          <Text style={styles.secondaryButtonText}>Try the articles again</Text>
        </TouchableOpacity>
      )}

      {result && result.sources.length > 0 && (
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

      {result && <Text style={styles.safety}>{result.safetyNote}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  // Same colour as the page behind it (DetailModal in HomeScreen), so there is no band
  container: { flex: 1, backgroundColor: '#FAFAFA', padding: 16, gap: 12 },
  // The screens start right under the page title, so they have no top padding of their own
  belowTitle: { paddingTop: 0 },
  intro: { backgroundColor: '#FFF', borderRadius: 14, padding: 14 },
  introText: { fontSize: 14, lineHeight: 20, color: '#3C3C43' },
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
  optionButton: { backgroundColor: '#FFF', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: '#8E8E93' },
  optionText: { fontSize: 15, color: '#000' },
  savedNote: { fontSize: 14, color: '#3C3C43', textAlign: 'center' },
  savedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#FFF',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D1D6',
  },
  savedChipText: { fontSize: 14, color: '#007AFF', fontWeight: '600' },
  savedRow: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, gap: 4 },
  savedTitle: { fontSize: 15, fontWeight: '600', color: '#000' },
  savedMeta: { fontSize: 12, color: '#6C6C70' },
  linkText: { fontSize: 15, color: '#007AFF', fontWeight: '600' },
  deleteButton: { borderRadius: 14, paddingVertical: 13, alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#FF3B30' },
  deleteButtonText: { color: '#FF3B30', fontSize: 15, fontWeight: '600' },
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
  micButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D1D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonActive: { backgroundColor: '#FF3B30', borderColor: '#FF3B30' },
  sendButton: { backgroundColor: '#007AFF', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18 },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  footer: { fontSize: 12, color: '#8E8E93', textAlign: 'center', marginTop: 8 },
});
