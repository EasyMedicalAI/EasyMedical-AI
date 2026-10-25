// Find a pharmacy: search by ZIP code. Results are sorted by distance, and a result can be saved as the preferred pharmacy.
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Linking, StyleSheet, Alert } from 'react-native';
import { Section, ListCard, Divider } from '@/components/ScreenKit';
import { searchPharmacies, ProviderResult } from '@/services/providerSearch';
import { zipLocation, milesBetween } from '@/services/zipLocation';

type Found = ProviderResult & { miles?: number };

const MAX_MILES = 20;

export default function FindPharmacy({ onUse }: { onUse: (pharmacy: ProviderResult) => void }) {
  const [zip, setZip] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<Found[]>([]);

  const canSearch = /^\d{5}$/.test(zip) && !loading;

  const search = async () => {
    if (!canSearch) return;
    setLoading(true);
    try {
      const found = await searchPharmacies(zip);
      // Distance from the searched ZIP code. Pharmacies more than 20 miles away are left out.
      const origin = await zipLocation(zip);
      const zips = [...new Set(found.map((p) => p.zip))];
      const locations = await Promise.all(zips.map((z) => zipLocation(z)));
      const locationByZip = new Map(zips.map((z, i) => [z, locations[i]]));
      const withDistance: Found[] = found.map((p) => {
        const here = locationByZip.get(p.zip);
        return { ...p, miles: origin && here ? milesBetween(origin, here) : undefined };
      });
      const nearby = withDistance.filter((p) => p.miles === undefined || p.miles <= MAX_MILES);
      nearby.sort((a, b) => (a.miles ?? Number.MAX_SAFE_INTEGER) - (b.miles ?? Number.MAX_SAFE_INTEGER));
      setResults(nearby);
      setSearched(true);
    } catch (error) {
      Alert.alert('Could not search', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const confirmUse = (pharmacy: Found) => {
    Alert.alert('Use this pharmacy?', pharmacy.name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Use', onPress: () => onUse(pharmacy) },
    ]);
  };

  return (
    <>
      <Section title="Find a pharmacy">
        <ListCard>
          <View style={styles.padded}>
            <Text style={styles.label}>ZIP CODE</Text>
            <TextInput
              style={styles.input}
              value={zip}
              onChangeText={(value) => setZip(value.replace(/\D/g, '').slice(0, 5))}
              placeholder="e.g. 10001"
              placeholderTextColor="#8E8E93"
              keyboardType="number-pad"
              maxLength={5}
            />
            <TouchableOpacity style={[styles.searchButton, !canSearch && styles.searchDisabled]} onPress={search} disabled={!canSearch}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.searchText}>Search</Text>}
            </TouchableOpacity>
          </View>
        </ListCard>
      </Section>

      {searched && results.length === 0 && <Text style={styles.empty}>No pharmacies found near that ZIP code. Try a nearby ZIP code.</Text>}

      {results.length > 0 && (
        <Section title="Nearby">
          <ListCard>
            {results.map((pharmacy, index) => (
              <React.Fragment key={pharmacy.npi}>
                {index > 0 && <Divider />}
                <View style={styles.row}>
                  <Text style={styles.name}>{pharmacy.name}</Text>
                  <Text style={styles.meta}>
                    {pharmacy.address}
                    {pharmacy.miles !== undefined ? ` · ${pharmacy.miles.toFixed(1)} mi` : ''}
                  </Text>
                  <View style={styles.actions}>
                    {pharmacy.phone ? (
                      <TouchableOpacity onPress={() => Linking.openURL(`tel:${pharmacy.phone!.replace(/\D/g, '')}`)}>
                        <Text style={styles.link}>Call</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity onPress={() => confirmUse(pharmacy)}>
                      <Text style={styles.useLink}>Use this pharmacy</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </React.Fragment>
            ))}
          </ListCard>
          <Text style={styles.disclaimer}>Confirm your insurance accepts this pharmacy before you fill a prescription.</Text>
        </Section>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  padded: { padding: 14 },
  label: { fontSize: 12, fontWeight: '600', color: '#8E8E93', letterSpacing: 0.5, marginBottom: 6 },
  input: { backgroundColor: '#F2F2F7', borderRadius: 12, paddingHorizontal: 14, minHeight: 50, fontSize: 17, color: '#000' },
  searchButton: { backgroundColor: '#007AFF', borderRadius: 12, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  searchDisabled: { backgroundColor: '#A9CFFF' },
  searchText: { color: '#FFF', fontSize: 17, fontWeight: '600' },
  empty: { fontSize: 14, color: '#8E8E93', textAlign: 'center', marginTop: 16, paddingHorizontal: 20 },
  row: { padding: 14 },
  name: { fontSize: 16, fontWeight: '600', color: '#000' },
  meta: { fontSize: 13, color: '#555', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 10 },
  link: { fontSize: 14, color: '#007AFF', fontWeight: '600' },
  useLink: { fontSize: 14, color: '#007AFF', fontWeight: '600' },
  disclaimer: { fontSize: 12, color: '#8E8E93', textAlign: 'center', marginTop: 12, paddingHorizontal: 20 },
});
