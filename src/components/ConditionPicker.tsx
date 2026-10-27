// Add a condition by picking it from a list. Typing shows matching conditions, and only a listed one can be saved,
// so a misspelled condition can't be added.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ListCard, Divider } from '@/components/ScreenKit';
import { searchConditionNames, ConditionName, MIN_CHARACTERS } from '@/services/conditionNames';

// Waits this long after the last keystroke before searching
const SEARCH_DELAY_MS = 300;

export default function ConditionPicker({
  onSave,
  onCancel,
  actionLabel = 'Add condition',
  hintText = 'Pick a condition from the list. Only listed conditions can be added.',
}: {
  onSave: (name: string) => void;
  onCancel: () => void;
  actionLabel?: string;
  hintText?: string;
}) {
  const [query, setQuery] = useState('');
  // Set only when a suggestion is tapped. Typing again clears it.
  const [selected, setSelected] = useState<ConditionName | null>(null);
  const [suggestions, setSuggestions] = useState<ConditionName[]>([]);
  // The search text the current suggestions belong to
  const [searchedFor, setSearchedFor] = useState('');
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The search text most recently typed. Results for older text are ignored.
  const latestTerm = useRef('');

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const search = (text: string) => {
    if (timer.current) clearTimeout(timer.current);
    const term = text.trim();
    latestTerm.current = term;
    if (term.length < MIN_CHARACTERS) {
      setSuggestions([]);
      setSearchedFor('');
      setLoading(false);
      setFailed(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(() => {
      searchConditionNames(term)
        .then((results) => {
          if (latestTerm.current !== term) return;
          setSuggestions(results);
          setSearchedFor(term);
          setFailed(false);
        })
        .catch(() => {
          if (latestTerm.current !== term) return;
          setSuggestions([]);
          setSearchedFor(term);
          setFailed(true);
        })
        .finally(() => {
          if (latestTerm.current === term) setLoading(false);
        });
    }, SEARCH_DELAY_MS);
  };

  const changeQuery = (text: string) => {
    setQuery(text);
    setSelected(null);
    search(text);
  };

  // Picking a suggestion keeps the list as it is, so the choice stays visible
  const pick = (condition: ConditionName) => {
    setSelected(condition);
    setQuery(condition.name);
  };

  const showNoMatch = !loading && !failed && query.trim().length >= MIN_CHARACTERS && searchedFor === query.trim() && suggestions.length === 0;

  return (
    <View>
      <ListCard>
        <View style={styles.padded}>
          <Text style={styles.label}>CONDITION</Text>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={changeQuery}
            placeholder="Start typing, e.g. psoriatic"
            placeholderTextColor="#8E8E93"
            autoCorrect={false}
            autoFocus
          />
          <Text style={styles.hint}>{hintText}</Text>
        </View>

        {loading && (
          <View style={styles.status}>
            <ActivityIndicator />
          </View>
        )}

        {failed && <Text style={styles.status}>Couldn&apos;t load suggestions. Check your connection and try again.</Text>}

        {showNoMatch && (
          <Text style={styles.status}>No matching conditions. Check the spelling, or try a shorter word.</Text>
        )}

        {!loading &&
          suggestions.map((condition, index) => {
            const isSelected = selected?.name === condition.name;
            return (
              <React.Fragment key={condition.name}>
                <Divider />
                <TouchableOpacity style={styles.suggestion} onPress={() => pick(condition)} accessibilityRole="button">
                  <View style={styles.suggestionText}>
                    <Text style={styles.suggestionName}>{condition.name}</Text>
                    {condition.plainName && <Text style={styles.suggestionPlain}>{condition.plainName}</Text>}
                  </View>
                  {isSelected && <MaterialCommunityIcons name="check" size={20} color="#007AFF" />}
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
      </ListCard>

      <View style={styles.buttons}>
        <TouchableOpacity onPress={onCancel} accessibilityRole="button" style={styles.cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.save, !selected && styles.disabled]}
          onPress={() => selected && onSave(selected.name)}
          disabled={!selected}
          accessibilityRole="button"
        >
          <Text style={styles.saveText}>{actionLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  padded: { padding: 14 },
  label: { fontSize: 12, fontWeight: '600', color: '#8E8E93', letterSpacing: 0.5, marginBottom: 6 },
  input: { backgroundColor: '#F2F2F7', borderRadius: 12, paddingHorizontal: 14, minHeight: 50, fontSize: 17, color: '#000' },
  hint: { fontSize: 13, color: '#8E8E93', marginTop: 8, lineHeight: 18 },
  status: { fontSize: 14, color: '#8E8E93', textAlign: 'center', padding: 14, lineHeight: 20 },
  suggestion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 44 },
  suggestionText: { flex: 1 },
  suggestionName: { fontSize: 16, fontWeight: '500', color: '#000' },
  suggestionPlain: { fontSize: 13, color: '#8E8E93', marginTop: 2 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 12 },
  cancel: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  cancelText: { fontSize: 16, color: '#007AFF' },
  save: { backgroundColor: '#007AFF', borderRadius: 12, minHeight: 44, justifyContent: 'center', paddingHorizontal: 18 },
  disabled: { backgroundColor: '#A9CFFF' },
  saveText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
