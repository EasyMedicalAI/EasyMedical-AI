// Clinical trials: recruiting studies near a ZIP code that may fit the conditions in your records.
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Linking, Share, StyleSheet } from 'react-native';
import { Section, ListCard, Divider } from '@/components/ScreenKit';
import { zipLocation } from '@/services/zipLocation';
import { findTrials, Trial, TrialSite } from '@/services/clinicalTrials';
import ConditionPicker from '@/components/ConditionPicker';

function distanceLabel(site: TrialSite | null): string {
  return site && site.miles !== undefined ? `${site.miles.toFixed(1)} mi` : '';
}

function siteLabel(site: TrialSite | null): string {
  return site ? [site.facility, site.city, site.state].filter(Boolean).join(', ') : '';
}

export default function ClinicalTrials({ conditions }: { conditions: string[] }) {
  const [zip, setZip] = useState('');
  const [searching, setSearching] = useState(false);
  const [trials, setTrials] = useState<Trial[] | null>(null);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState<Trial | null>(null);

  // The condition to search for. Starts with the first one in your records, or one searched for outside them.
  const [chosen, setChosen] = useState<string | null>(null);
  const [otherSearch, setOtherSearch] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const condition = otherSearch ?? (chosen && conditions.includes(chosen) ? chosen : (conditions[0] ?? null));
  const inRecords = condition !== null && conditions.includes(condition);
  const chipNames = otherSearch ? [...conditions, otherSearch] : conditions;
  const canSearch = /^\d{5}$/.test(zip) && condition !== null && !searching;

  const chooseCondition = (name: string) => {
    setChosen(name);
    setOtherSearch(null);
    setTrials(null);
    setError('');
  };

  const pickOther = (name: string) => {
    setShowPicker(false);
    if (conditions.includes(name)) {
      chooseCondition(name);
    } else {
      setOtherSearch(name);
      setTrials(null);
      setError('');
    }
  };

  const changeZip = (value: string) => {
    setZip(value.replace(/\D/g, '').slice(0, 5));
    setTrials(null);
    setError('');
  };

  const search = async () => {
    if (!canSearch || !condition) return;
    setSearching(true);
    setError('');
    setTrials(null);
    try {
      const origin = await zipLocation(zip);
      if (!origin) {
        setError("That ZIP code couldn't be found.");
        return;
      }
      setTrials(await findTrials([condition], origin));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  if (picked) return <TrialDetail trial={picked} fromRecords={inRecords} onBack={() => setPicked(null)} />;

  return (
    <>
      <Section title="Find trials">
        <ListCard>
          <View style={styles.padded}>
            <Text style={styles.label}>ZIP CODE</Text>
            <TextInput
              style={styles.input}
              value={zip}
              onChangeText={changeZip}
              onSubmitEditing={search}
              keyboardType="number-pad"
              placeholder="e.g. 08108"
              placeholderTextColor="#8E8E93"
            />
            <View style={styles.section}>
              <Text style={styles.label}>CONDITION</Text>
              <View style={styles.chips}>
                  {chipNames.map((name) => {
                    const isOn = name === condition;
                    return (
                      <TouchableOpacity
                        key={name}
                        style={[styles.chip, isOn && styles.chipOn]}
                        onPress={() => chooseCondition(name)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isOn }}
                      >
                        <Text style={[styles.chipText, isOn && styles.chipTextOn]}>
                          {name === otherSearch ? `${name} (not in records)` : name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={styles.chipAdd}
                    onPress={() => setShowPicker((shown) => !shown)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: showPicker }}
                  >
                    <Text style={styles.chipAddText}>+ Search another</Text>
                  </TouchableOpacity>
              </View>
              {chipNames.length === 0 && (
                <Text style={styles.hint}>Add a condition to your records, or search for one.</Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, !canSearch && styles.disabled]}
              onPress={search}
              disabled={!canSearch}
              accessibilityRole="button"
            >
              {searching ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Find trials</Text>}
            </TouchableOpacity>
          </View>
        </ListCard>
      </Section>

      {showPicker && (
        <Section title="Search another condition">
          <ConditionPicker
            actionLabel="Search this condition"
            hintText="Pick a condition from the list. Only listed conditions can be searched."
            onSave={pickOther}
            onCancel={() => setShowPicker(false)}
          />
          {/* Room below the picker, so the page can scroll it above the keyboard */}
          <View style={styles.keyboardSpace} />
        </Section>
      )}


      {error ? <Text style={styles.error}>{error}</Text> : null}

      {trials && trials.length === 0 && (
        <Text style={styles.empty}>No recruiting studies found within 25 miles of {zip}.</Text>
      )}

      {trials && trials.length > 0 && (
        <Section title={`${trials.length} studies for ${condition} near ${zip}`}>
          <ListCard>
            {trials.map((trial, index) => (
              <React.Fragment key={trial.nctId}>
                {index > 0 && <Divider />}
                <TouchableOpacity style={styles.trial} onPress={() => setPicked(trial)} accessibilityRole="button">
                  <Text style={styles.trialMeta}>
                    {[trial.phases.join(' / '), distanceLabel(trial.nearestSite)].filter(Boolean).join(' · ')}
                  </Text>
                  <Text style={styles.trialTitle}>{trial.title}</Text>
                  {trial.nearestSite && <Text style={styles.trialSite}>{trial.nearestSite.facility}</Text>}
                  <Text style={styles.match}>
                    {inRecords
                      ? `May fit: matches ${trial.matchedCondition} in your records.`
                      : `Search result for ${trial.matchedCondition}. Not in your records.`}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </ListCard>
        </Section>
      )}

      <Text style={styles.disclaimer}>
        {"Studies come from ClinicalTrials.gov. Being listed doesn't mean you're eligible. The study team decides."}
      </Text>
    </>
  );
}

function TrialDetail({ trial, fromRecords, onBack }: { trial: Trial; fromRecords: boolean; onBack: () => void }) {
  const [showAllCriteria, setShowAllCriteria] = useState(false);
  const site = trial.nearestSite;
  const minAge = ageNumber(trial.minimumAge);
  const maxAge = ageNumber(trial.maximumAge);
  const ageValue = minAge && maxAge ? `${minAge} to ${maxAge}` : minAge ? `${minAge} and up` : 'Any age';
  const sex = trial.sex === 'FEMALE' ? 'Women only' : trial.sex === 'MALE' ? 'Men only' : '';
  const tiles = [
    { label: 'Phase', value: trial.phases.join(' / ') || 'Not listed', highlight: false },
    { label: 'Ages', value: ageValue, highlight: false },
    { label: 'Status', value: 'Recruiting', highlight: true },
    { label: 'Distance', value: distanceLabel(site) || 'Not listed', highlight: false },
  ];

  // The user chooses who receives this in the share sheet. Nothing is sent from the app.
  const shareSummary = () => {
    const lines = [
      `Clinical trial: ${trial.title}`,
      `ClinicalTrials.gov ID: ${trial.nctId}`,
      site ? `Nearest site: ${siteLabel(site)}` : '',
      `Matched condition: ${trial.matchedCondition}`,
      `Details: https://clinicaltrials.gov/study/${trial.nctId}`,
    ].filter(Boolean);
    Share.share({ message: lines.join('\n') }).catch(() => undefined);
  };

  return (
    <View style={styles.detail}>
      <TouchableOpacity onPress={onBack} accessibilityRole="button" style={styles.backButton}>
        <Text style={styles.linkText}>Back to trials</Text>
      </TouchableOpacity>

      <Text style={styles.detailTitle}>{trial.title}</Text>
      <Text style={styles.hint}>{siteLabel(site) || 'Location not listed'}</Text>

      <View style={styles.tiles}>
        {tiles.map((tile) => (
          <View key={tile.label} style={styles.tile}>
            <Text style={styles.tileLabel}>{tile.label}</Text>
            <Text style={[styles.tileValue, tile.highlight && styles.tileHighlight]}>{tile.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.noteBox}>
        <Text style={styles.noteText}>
          {fromRecords
            ? `Your records list ${trial.matchedCondition}. Check with your doctor before you contact the study team.`
            : `You searched for ${trial.matchedCondition}, which isn't in your records. Check with your doctor before you contact the study team.`}
        </Text>
      </View>

      <Text style={styles.subhead}>ABOUT THIS STUDY</Text>
      <Text style={styles.body}>{trial.summary || 'No summary provided.'}</Text>

      <Text style={styles.subhead}>ELIGIBILITY</Text>
      {sex !== '' && <Text style={styles.body}>{sex}</Text>}
      <Eligibility text={trial.eligibility} limit={showAllCriteria ? undefined : PREVIEW_CRITERIA} />
      {criteriaLines(trial.eligibility).length > PREVIEW_CRITERIA && (
        <TouchableOpacity
          onPress={() => setShowAllCriteria((shown) => !shown)}
          accessibilityRole="button"
          style={styles.textButton}
        >
          <Text style={styles.linkText}>{showAllCriteria ? 'Show fewer criteria' : 'Show all criteria'}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.primaryButton} onPress={shareSummary} accessibilityRole="button">
        <Text style={styles.primaryText}>Share summary for my doctor</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => Linking.openURL(`https://clinicaltrials.gov/study/${trial.nctId}`).catch(() => undefined)}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryText}>View on ClinicalTrials.gov</Text>
      </TouchableOpacity>

      <Text style={styles.disclaimer}>{"Choosing a study doesn't enroll you. The study team checks eligibility before you join."}</Text>
    </View>
  );
}

// "18 Years" → "18"
function ageNumber(age?: string): string {
  return (age || '').replace(/\s*years?$/i, '');
}

// How many criteria lines show before "Show all criteria"
const PREVIEW_CRITERIA = 4;

function criteriaLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

// Eligibility criteria as ClinicalTrials.gov lists them: headings in bold, list items with a bullet
function Eligibility({ text, limit }: { text: string; limit?: number }) {
  const lines = criteriaLines(text).slice(0, limit);
  if (lines.length === 0) return <Text style={styles.body}>No eligibility criteria listed.</Text>;
  return (
    <View style={styles.criteria}>
      {lines.map((line, index) => {
        if (line.startsWith('*')) {
          return (
            <View key={index} style={styles.criterion}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.criterionText}>{line.replace(/^\*\s*/, '')}</Text>
            </View>
          );
        }
        if (line.endsWith(':')) return <Text key={index} style={styles.criteriaHeading}>{line}</Text>;
        return <Text key={index} style={styles.body}>{line}</Text>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  detail: { paddingHorizontal: 16, paddingBottom: 16 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginTop: 14 },
  tile: { width: '48%', backgroundColor: '#F2F2F7', borderRadius: 12, padding: 12 },
  tileLabel: { fontSize: 12, color: '#8E8E93' },
  tileValue: { fontSize: 16, fontWeight: '500', color: '#000', marginTop: 2 },
  tileHighlight: { color: '#0F5E58' },
  textButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: 4 },
  criteria: { gap: 6 },
  criterion: { flexDirection: 'row', gap: 8, paddingLeft: 4 },
  bullet: { fontSize: 15, color: '#8E8E93', lineHeight: 22 },
  criterionText: { flex: 1, fontSize: 15, color: '#000', lineHeight: 22 },
  criteriaHeading: { fontSize: 15, fontWeight: '600', color: '#000', marginTop: 8, lineHeight: 22 },
  padded: { padding: 14 },
  section: { marginTop: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: '#D1D1D6', paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#FFF' },
  chipOn: { backgroundColor: '#E5F0FF', borderColor: '#007AFF' },
  chipAdd: { borderRadius: 999, borderWidth: 1, borderStyle: 'dashed', borderColor: '#007AFF', paddingHorizontal: 12, paddingVertical: 7 },
  chipAddText: { fontSize: 14, color: '#007AFF' },
  keyboardSpace: { height: 340 },
  chipText: { fontSize: 14, color: '#000' },
  chipTextOn: { color: '#007AFF', fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '600', color: '#8E8E93', letterSpacing: 0.5, marginBottom: 6 },
  input: { backgroundColor: '#F2F2F7', borderRadius: 12, paddingHorizontal: 14, minHeight: 50, fontSize: 17, color: '#000' },
  hint: { fontSize: 13, color: '#8E8E93', marginTop: 6, paddingHorizontal: 2 },
  primaryButton: { backgroundColor: '#007AFF', borderRadius: 12, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 16, paddingHorizontal: 14 },
  primaryText: { color: '#FFF', fontSize: 17, fontWeight: '600' },
  secondaryButton: { borderRadius: 12, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 10, borderWidth: 1, borderColor: '#007AFF' },
  secondaryText: { color: '#007AFF', fontSize: 17, fontWeight: '600' },
  disabled: { backgroundColor: '#A9CFFF' },
  error: { fontSize: 14, color: '#B42318', textAlign: 'center', marginTop: 12, paddingHorizontal: 20 },
  empty: { fontSize: 14, color: '#8E8E93', textAlign: 'center', marginTop: 16, paddingHorizontal: 20 },
  trial: { padding: 14 },
  trialMeta: { fontSize: 12, fontWeight: '500', color: '#007AFF' },
  trialTitle: { fontSize: 17, fontWeight: '500', color: '#000', marginTop: 6, lineHeight: 22 },
  trialSite: { fontSize: 14, color: '#8E8E93', marginTop: 4 },
  match: { fontSize: 14, color: '#333', marginTop: 10, backgroundColor: '#F2F8F7', borderRadius: 10, padding: 10, lineHeight: 19 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8 },
  linkText: { fontSize: 15, color: '#007AFF', fontWeight: '600' },
  badge: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '500', color: '#0F5E58', backgroundColor: '#E6F4F2', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, overflow: 'hidden' },
  detailTitle: { fontSize: 22, fontWeight: '500', color: '#000', marginTop: 12, lineHeight: 28 },
  noteBox: { backgroundColor: '#F2F8F7', borderRadius: 12, padding: 14, marginTop: 14 },
  noteText: { fontSize: 14, color: '#333', lineHeight: 20 },
  subhead: { fontSize: 13, fontWeight: '600', color: '#8E8E93', marginTop: 20, marginBottom: 6, letterSpacing: 0.5 },
  body: { fontSize: 15, color: '#000', lineHeight: 22 },
  disclaimer: { fontSize: 12, color: '#8E8E93', textAlign: 'center', marginTop: 16, paddingHorizontal: 20 },
});
