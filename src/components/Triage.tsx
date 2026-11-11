// Triage (developer preview): a guided path from "what's hurting" to how soon to get care and which clinician to see.
// It never names a condition or recommends a treatment. Your records stay on your phone; only your answers are sent.
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Linking, Share, StyleSheet } from 'react-native';
import { useRecords } from '@/context/RecordsContext';
import { triage, TriageResponse } from '@/services/triage';

const WARNING_SIGNS = [
  'Chest pain or trouble breathing',
  'Fever with a hot, swollen joint',
  'A joint that suddenly won’t move',
  'Face drooping, arm weakness, or slurred speech',
  'Severe bleeding that won’t stop',
  'Thoughts of harming yourself',
];
const NONE = 'None of these';

const AREAS = ['Head or face', 'Chest or breathing', 'Stomach or digestion', 'Joints, muscles, or bones', 'Skin', 'Something else'];
const JOINT_PARTS = ['Hand or wrist', 'Elbow or shoulder', 'Hip', 'Knee', 'Ankle or foot', 'Leg (thigh or calf)', 'Arm', 'Back', 'Neck'];
const LIMB_OR_SPINE = ['Leg (thigh or calf)', 'Back', 'Neck', 'Arm'];

type Question = {
  key: string;
  title: string;
  options?: string[];
  multi?: boolean;
  text?: boolean;
};

type Answers = Record<string, string[]>;

// The fixed questions. Each area adds its own follow-ups, so the questions depend on what the person already said.
const AREA_QUESTION: Question = { key: 'areas', title: 'What’s hurting?', options: AREAS, multi: true };
const DURATION: Question = { key: 'duration', title: 'How long has it been going on?', options: ['Started today', 'A few days', 'A few weeks', 'Several months'] };
const SEVERITY: Question = { key: 'severity', title: 'How bad is it, from 0 to 10?', options: ['Mild (1 to 3)', 'Moderate (4 to 6)', 'Severe (7 to 10)'] };
const FEVER: Question = { key: 'fever', title: 'Have you had fever, chills, or feeling unwell?', options: ['No', 'Yes', 'Not sure'] };
const WORDS: Question = { key: 'words', title: 'Anything else, in your own words?', text: true };

// Follow-up questions for each area, chosen by the first area picked
const FOLLOW_UPS: Record<string, (answers: Answers) => Question[]> = {
  'Joints, muscles, or bones': (answers) => {
    const part = answers.part?.[0] ?? '';
    const questions: Question[] = [
      { key: 'part', title: 'Which part?', options: JOINT_PARTS },
      { key: 'swollen', title: 'Is it swollen?', options: ['No', 'Yes', 'Not sure'] },
      { key: 'stiffness', title: 'Is it stiff in the morning?', options: ['No', 'Under 1 hour', 'Over 1 hour'] },
    ];
    if (LIMB_OR_SPINE.includes(part)) {
      questions.push({ key: 'numbness', title: 'Any numbness or weakness?', options: ['No', 'Yes', 'Not sure'] });
    }
    return questions;
  },
  'Stomach or digestion': () => [
    { key: 'vomiting', title: 'Nausea or vomiting?', options: ['No', 'Nausea only', 'Vomiting'] },
    { key: 'stool', title: 'Any blood in your stool?', options: ['No', 'Yes', 'Not sure'] },
    { key: 'eating', title: 'Does it relate to eating?', options: ['No', 'Before eating', 'After eating'] },
  ],
  'Chest or breathing': () => [
    { key: 'when', title: 'When does it happen?', options: ['At rest', 'With activity', 'Both'] },
    { key: 'breath', title: 'Are you short of breath?', options: ['No', 'Yes, at rest', 'Yes, with activity'] },
  ],
  'Head or face': () => [
    { key: 'onset', title: 'How did it start?', options: ['Gradually', 'Suddenly'] },
    { key: 'neuro', title: 'Any change in vision, speech, or strength?', options: ['No', 'Yes', 'Not sure'] },
  ],
  Skin: () => [
    { key: 'spreading', title: 'Is it spreading?', options: ['No', 'Yes', 'Not sure'] },
    { key: 'new', title: 'Any new product, medication, or food recently?', options: ['No', 'Yes'] },
  ],
  'Something else': () => [{ key: 'trend', title: 'Is it getting better or worse?', options: ['Better', 'Same', 'Worse'] }],
};

// Every question to ask, in order, given the answers so far
function questionsFor(answers: Answers): Question[] {
  const area = answers.areas?.[0];
  const followUps = area && FOLLOW_UPS[area] ? FOLLOW_UPS[area](answers) : [];
  return [AREA_QUESTION, ...followUps, DURATION, SEVERITY, FEVER, WORDS];
}

const PLACE_LABEL: Record<string, string> = {
  emergency_room: 'Emergency room',
  urgent_care: 'Urgent care',
  primary_care: 'Primary care doctor',
  cardiology: 'Heart doctor (cardiology)',
  dermatology: 'Skin doctor (dermatology)',
  gastroenterology: 'Stomach doctor (gastroenterology)',
  neurology: 'Brain and nerve doctor (neurology)',
  ob_gyn: 'Women’s health (OB-GYN)',
  ophthalmology: 'Eye doctor (ophthalmology)',
  ent: 'Ear, nose, and throat doctor',
  orthopedics: 'Bone and joint doctor (orthopedics)',
  psychiatry: 'Mental health doctor (psychiatry)',
  rheumatology: 'Joint and immune doctor (rheumatology)',
  pediatrics: 'Children’s doctor (pediatrics)',
  other_specialist: 'Another specialist',
};

const URGENCY_LABEL: Record<string, string> = {
  urgent_care_today: 'Get care today',
  see_doctor_this_week: 'See a doctor this week',
  routine: 'Routine visit',
  emergency: 'Emergency now',
};

type Step = 'safety' | 'intake' | 'summary' | 'suggestion' | 'packet' | 'emergency';

export default function Triage() {
  const { userData } = useRecords();
  const [step, setStep] = useState<Step>('safety');
  const [signs, setSigns] = useState<string[]>([]);
  const [question, setQuestion] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [words, setWords] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [response, setResponse] = useState<TriageResponse | null>(null);
  const [extraConditions, setExtraConditions] = useState<string[]>([]);
  const [extraMedications, setExtraMedications] = useState<string[]>([]);
  const [newCondition, setNewCondition] = useState('');
  const [newMedication, setNewMedication] = useState('');

  const conditionNames = (userData.conditions || []).slice(0, 8);
  const medicationNames = (userData.medications || []).slice(0, 8);
  const allergyNames = (userData.allergies || []).slice(0, 8);

  const questions = questionsFor(answers);
  const current = questions[Math.min(question, questions.length - 1)];
  const answered = (q: Question) => q.text || (answers[q.key] || []).length > 0;

  // Adds an item the person typed, if it's new and not empty. Stays on the phone.
  const addItem = (text: string, list: string[], set: (next: string[]) => void, clear: () => void) => {
    const clean = text.trim().slice(0, 100);
    if (clean && !list.some((item) => item.toLowerCase() === clean.toLowerCase()) && list.length < 20) {
      set([...list, clean]);
    }
    clear();
  };

  // Adds or removes one warning sign, without keeping "None of these"
  const toggleSign = (sign: string) => {
    setSigns((list) => {
      const without = list.filter((s) => s !== NONE);
      return without.includes(sign) ? without.filter((s) => s !== sign) : [...without, sign];
    });
  };

  const continueSafety = () => {
    setStep(signs.some((s) => s !== NONE) ? 'emergency' : 'intake');
  };

  const pick = (q: Question, option: string) => {
    setAnswers((existing) => {
      const chosen = existing[q.key] || [];
      if (q.multi) {
        return { ...existing, [q.key]: chosen.includes(option) ? chosen.filter((x) => x !== option) : [...chosen, option] };
      }
      return { ...existing, [q.key]: [option] };
    });
  };

  // The answers as plain text, for the model and the packet. Only questions that are asked now are included.
  const answerLines = () =>
    questions
      .filter((q) => !q.text && (answers[q.key] || []).length > 0)
      .map((q) => `${q.title} ${(answers[q.key] || []).join(', ')}`);

  const seeSuggestion = async () => {
    setLoading(true);
    setError('');
    setStep('suggestion');
    setResponse(null);
    try {
      const details = [...answerLines(), words.trim() ? `In their words: ${words.trim()}` : ''].filter(Boolean).join(' ');
      const result = await triage(details || 'Describe what is hurting.', answers.areas || []);
      setResponse(result);
      if (result.emergency) setStep('emergency');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not work that out right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const result = response && !response.emergency ? response.result : null;

  const sharePacket = () => {
    if (!result) return;
    const lines = [
      'Symptom summary for my doctor (not a diagnosis)',
      ...answerLines(),
      ...(words.trim() ? [`In my words: ${words.trim()}`] : []),
      `Suggested: ${URGENCY_LABEL[result.urgency] ?? result.urgency}, ${PLACE_LABEL[result.where_to_go] ?? result.where_to_go}`,
      ...(result.questions_for_clinician.length ? ['Questions to ask:', ...result.questions_for_clinician.map((q) => `- ${q}`)] : []),
      ...(extraConditions.length ? [`Conditions I added: ${extraConditions.join(', ')}`] : []),
      ...(extraMedications.length ? [`Medications I added: ${extraMedications.join(', ')}`] : []),
      ...(conditionNames.length ? [`Conditions in my records: ${conditionNames.join(', ')}`] : []),
      ...(medicationNames.length ? [`Medications in my records: ${medicationNames.join(', ')}`] : []),
      ...(allergyNames.length ? [`Allergies in my records: ${allergyNames.join(', ')}`] : []),
    ];
    Share.share({ message: lines.join('\n') }).catch(() => undefined);
  };

  return (
    <View style={styles.wrap}>
      {step === 'safety' && (
        <>
          <Text style={styles.step}>1 · SAFETY CHECK</Text>
          <Text style={styles.title}>Are you having any of these right now?</Text>
          {[...WARNING_SIGNS, NONE].map((sign) => {
            const on = signs.includes(sign);
            return (
              <TouchableOpacity
                key={sign}
                style={[styles.option, on && styles.optionOn]}
                onPress={() => (sign === NONE ? setSigns(on ? [] : [NONE]) : toggleSign(sign))}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
              >
                <Text style={[styles.optionText, on && styles.optionTextOn]}>{sign}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={[styles.primary, signs.length === 0 && styles.disabled]} onPress={continueSafety} disabled={signs.length === 0}>
            <Text style={styles.primaryText}>Continue</Text>
          </TouchableOpacity>
          <Text style={styles.note}>If you picked any of these, we’ll tell you what to do now.</Text>
        </>
      )}

      {step === 'emergency' && (
        <View style={styles.emergency}>
          <Text style={styles.emergencyTitle}>Call 911 or go to the nearest emergency room now.</Text>
          <Text style={styles.emergencyText}>
            What you described can need emergency care. Don’t wait for an appointment. This tool can’t judge emergencies.
          </Text>
        </View>
      )}

      {step === 'intake' && (
        <>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${((question + 1) / questions.length) * 100}%` }]} />
          </View>
          <Text style={styles.step}>2 · YOUR SYMPTOMS · QUESTION {question + 1} OF {questions.length}</Text>
          <Text style={styles.title}>{current.title}</Text>
          {current.options?.map((option) => {
            const on = (answers[current.key] || []).includes(option);
            return (
              <TouchableOpacity
                key={option}
                style={[styles.option, on && styles.optionOn]}
                onPress={() => pick(current, option)}
                accessibilityRole={current.multi ? 'checkbox' : 'radio'}
                accessibilityState={{ selected: on, checked: on }}
              >
                <Text style={[styles.optionText, on && styles.optionTextOn]}>{option}</Text>
              </TouchableOpacity>
            );
          })}
          {current.text && (
            <TextInput
              style={styles.input}
              value={words}
              onChangeText={setWords}
              placeholder="Anything else that matters to you"
              placeholderTextColor="#8E8E93"
              multiline
            />
          )}
          <View style={styles.row}>
            {question > 0 && (
              <TouchableOpacity style={styles.secondary} onPress={() => setQuestion(question - 1)}>
                <Text style={styles.secondaryText}>Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.primary, styles.grow, !answered(current) && styles.disabled]}
              disabled={!answered(current)}
              onPress={() => (question < questions.length - 1 ? setQuestion(question + 1) : setStep('summary'))}
            >
              <Text style={styles.primaryText}>{question < questions.length - 1 ? 'Next' : 'Review'}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {step === 'summary' && (
        <>
          <Text style={styles.step}>3 · YOUR CASE SUMMARY</Text>
          <Text style={styles.title}>What we have so far</Text>
          <View style={styles.card}>
            <Text style={styles.label}>FROM YOUR ANSWERS</Text>
            {answerLines().map((line) => (
              <Text key={line} style={styles.line}>{line}</Text>
            ))}
            {words.trim() ? <Text style={styles.line}>In your words: {words.trim()}</Text> : null}
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>FROM YOUR RECORDS (STAYS ON YOUR PHONE)</Text>
            <Text style={styles.line}>Conditions: {conditionNames.join(', ') || 'none listed'}</Text>
            <Text style={styles.line}>Medications: {medicationNames.join(', ') || 'none listed'}</Text>
            <Text style={styles.line}>Allergies: {allergyNames.join(', ') || 'none listed'}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>ADDED BY YOU</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.inputSmall, styles.grow]}
                value={newCondition}
                onChangeText={setNewCondition}
                onSubmitEditing={() => addItem(newCondition, extraConditions, setExtraConditions, () => setNewCondition(''))}
                placeholder="Add a condition"
                placeholderTextColor="#8E8E93"
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[styles.addButton, !newCondition.trim() && styles.disabled]}
                disabled={!newCondition.trim()}
                onPress={() => addItem(newCondition, extraConditions, setExtraConditions, () => setNewCondition(''))}
              >
                <Text style={styles.addText}>Add</Text>
              </TouchableOpacity>
            </View>
            {extraConditions.map((item) => (
              <TouchableOpacity key={item} onPress={() => setExtraConditions(extraConditions.filter((x) => x !== item))} accessibilityLabel={`Remove ${item}`}>
                <Text style={styles.line}>{item}  ✕</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.row}>
              <TextInput
                style={[styles.inputSmall, styles.grow]}
                value={newMedication}
                onChangeText={setNewMedication}
                onSubmitEditing={() => addItem(newMedication, extraMedications, setExtraMedications, () => setNewMedication(''))}
                placeholder="Add a medication"
                placeholderTextColor="#8E8E93"
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[styles.addButton, !newMedication.trim() && styles.disabled]}
                disabled={!newMedication.trim()}
                onPress={() => addItem(newMedication, extraMedications, setExtraMedications, () => setNewMedication(''))}
              >
                <Text style={styles.addText}>Add</Text>
              </TouchableOpacity>
            </View>
            {extraMedications.map((item) => (
              <TouchableOpacity key={item} onPress={() => setExtraMedications(extraMedications.filter((x) => x !== item))} accessibilityLabel={`Remove ${item}`}>
                <Text style={styles.line}>{item}  ✕</Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.note}>Tap an item to remove it.</Text>
          </View>
          <Text style={styles.note}>Only your answers are sent for the suggestion. Your records are not.</Text>
          <TouchableOpacity style={styles.primary} onPress={seeSuggestion}>
            <Text style={styles.primaryText}>See suggestion</Text>
          </TouchableOpacity>
        </>
      )}

      {step === 'suggestion' && (
        <>
          <Text style={styles.step}>4 · SUGGESTED NEXT STEP</Text>
          {loading && <ActivityIndicator style={styles.loading} color="#007AFF" />}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {result && (
            <>
              <View style={styles.suggestion}>
                <Text style={styles.tag}>{URGENCY_LABEL[result.urgency] ?? result.urgency}</Text>
                <Text style={styles.suggestionTitle}>{PLACE_LABEL[result.where_to_go] ?? result.where_to_go}</Text>
                <Text style={styles.suggestionText}>This fits what you described. It is not a diagnosis.</Text>
              </View>
              {result.reasons.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.label}>WHY</Text>
                  {result.reasons.map((reason, i) => (
                    <Text key={i} style={styles.bullet}>• {reason}</Text>
                  ))}
                </View>
              )}
              {result.questions_for_clinician.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.label}>QUESTIONS TO ASK</Text>
                  {result.questions_for_clinician.map((q, i) => (
                    <Text key={i} style={styles.bullet}>• {q}</Text>
                  ))}
                </View>
              )}
              {result.sources && result.sources.length > 0 && (
                <View style={styles.sources}>
                  <Text style={styles.sourcesLabel}>Sources</Text>
                  {result.sources.map((source) => (
                    <TouchableOpacity
                      key={source.url}
                      onPress={() => Linking.openURL(source.url).catch(() => undefined)}
                      accessibilityRole="link"
                    >
                      <Text style={styles.sourceLink}>{source.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <TouchableOpacity style={styles.primary} onPress={() => setStep('packet')}>
                <Text style={styles.primaryText}>Build my referral packet</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}

      {step === 'packet' && result && (
        <>
          <Text style={styles.step}>5 · REFERRAL PACKET</Text>
          <Text style={styles.title}>For your doctor</Text>
          <View style={styles.card}>
            {answerLines().map((line) => (
              <Text key={line} style={styles.line}>{line}</Text>
            ))}
            <Text style={styles.line}>Suggested: {PLACE_LABEL[result.where_to_go] ?? result.where_to_go}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>QUESTIONS TO ASK</Text>
            {result.questions_for_clinician.length ? (
              result.questions_for_clinician.map((q, i) => (
                <Text key={i} style={styles.bullet}>• {q}</Text>
              ))
            ) : (
              <Text style={styles.line}>None suggested</Text>
            )}
          </View>
          <TouchableOpacity style={styles.primary} onPress={sharePacket}>
            <Text style={styles.primaryText}>Share with my doctor</Text>
          </TouchableOpacity>
          <Text style={styles.note}>You choose who receives it. Nothing is sent without your action.</Text>
        </>
      )}

      <Text style={styles.disclaimer}>
        This is not a diagnosis. It helps you decide how soon to get care and which clinician to see. A clinician has to evaluate you. If your symptoms get worse, call 911 or go to the nearest emergency room.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },
  step: { fontSize: 12, fontWeight: '600', color: '#8E8E93', letterSpacing: 0.5 },
  title: { fontSize: 22, fontWeight: '600', color: '#000', lineHeight: 28 },
  option: { borderWidth: 1, borderColor: '#D1D1D6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#FFF' },
  optionOn: { borderColor: '#007AFF', backgroundColor: '#E5F0FF' },
  optionText: { fontSize: 16, color: '#000' },
  optionTextOn: { color: '#007AFF', fontWeight: '600' },
  primary: { backgroundColor: '#007AFF', borderRadius: 12, minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryText: { color: '#FFF', fontSize: 17, fontWeight: '600' },
  secondary: { borderWidth: 1, borderColor: '#007AFF', borderRadius: 12, minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  secondaryText: { color: '#007AFF', fontSize: 17, fontWeight: '600' },
  grow: { flex: 1 },
  row: { flexDirection: 'row', gap: 10, marginTop: 6 },
  disabled: { backgroundColor: '#A9CFFF' },
  note: { fontSize: 13, color: '#8E8E93', lineHeight: 18 },
  bar: { height: 6, backgroundColor: '#E5E5EA', borderRadius: 999, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: '#0F766E' },
  input: { backgroundColor: '#F2F2F7', borderRadius: 12, padding: 14, minHeight: 120, fontSize: 16, color: '#000', textAlignVertical: 'top' },
  card: { backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#E5E5EA', padding: 14, gap: 6 },
  label: { fontSize: 12, fontWeight: '600', color: '#8E8E93', letterSpacing: 0.5, marginBottom: 2 },
  line: { fontSize: 15, color: '#000', lineHeight: 21 },
  bullet: { fontSize: 15, color: '#000', lineHeight: 21 },
  suggestion: { backgroundColor: '#F0FAF8', borderWidth: 2, borderColor: '#0F766E', borderRadius: 14, padding: 16, gap: 6 },
  tag: { fontSize: 12, fontWeight: '600', color: '#0F766E', letterSpacing: 0.5, textTransform: 'uppercase' },
  suggestionTitle: { fontSize: 20, fontWeight: '600', color: '#000' },
  suggestionText: { fontSize: 14, color: '#3C3C43', lineHeight: 20 },
  loading: { marginVertical: 24 },
  error: { fontSize: 15, color: '#B42318', lineHeight: 21 },
  emergency: { backgroundColor: '#B42318', borderRadius: 14, padding: 18, gap: 8 },
  emergencyTitle: { color: '#FFF', fontSize: 19, fontWeight: '600', lineHeight: 25 },
  emergencyText: { color: '#FFE4E1', fontSize: 15, lineHeight: 21 },
  inputSmall: { backgroundColor: '#F2F2F7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#000' },
  addButton: { backgroundColor: '#007AFF', borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  addText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  disclaimer: { fontSize: 12, color: '#8E8E93', textAlign: 'center', lineHeight: 18, marginTop: 10 },
  sources: { gap: 4, paddingHorizontal: 4, marginTop: 4 },
  sourcesLabel: { fontSize: 12, color: '#8E8E93', fontWeight: '600', letterSpacing: 0.5 },
  sourceLink: { fontSize: 13, color: '#8E8E93', textDecorationLine: 'underline', lineHeight: 18 },
});
