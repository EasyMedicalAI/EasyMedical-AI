// Find a doctor: pick a specialty and enter a ZIP code. In-network doctors show first; the rest are marked as not confirmed.
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Linking, StyleSheet, Alert } from 'react-native';
import { Section, ListCard, Divider } from '@/components/ScreenKit';
import { searchProviders, SPECIALTIES, ProviderResult } from '@/services/providerSearch';
import { networkStatuses, hasDirectory, NetworkStatus } from '@/services/insuranceNetwork';
import { zipLocation, milesBetween } from '@/services/zipLocation';

type Found = ProviderResult & { miles?: number };

const MAX_MILES = 20;

const STATUS_LABEL: Record<NetworkStatus, string> = {
  in: 'In network',
  'not-listed': 'Not listed',
  unknown: 'Not confirmed',
};

export default function FindDoctor({ plan, planName, payerPhone }: { plan?: string; planName?: string; payerPhone?: string }) {
  const [specialty, setSpecialty] = useState('');
  const [zip, setZip] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<Found[]>([]);
  const [statuses, setStatuses] = useState<Record<string, NetworkStatus>>({});

  const canSearch = !!specialty && /^\d{5}$/.test(zip) && !loading;
  const directoryAvailable = !!plan && hasDirectory(plan);

  const search = async () => {
    if (!canSearch) return;
    setLoading(true);
    try {
      const found = await searchProviders(specialty, zip);
      const known = plan ? await networkStatuses(plan, found) : {};
      // Distance from the searched ZIP code, nearest first. Doctors without a known distance go last.
      const origin = await zipLocation(zip);
      const zips = [...new Set(found.map((p) => p.zip))];
      const locations = await Promise.all(zips.map((z) => zipLocation(z)));
      const locationByZip = new Map(zips.map((z, i) => [z, locations[i]]));
      const withDistance: Found[] = found.map((p) => {
        const here = locationByZip.get(p.zip);
        return { ...p, miles: origin && here ? milesBetween(origin, here) : undefined };
      });
      // Doctors more than 20 miles away are left out. Doctors with no known distance are kept, at the end.
      const nearby = withDistance.filter((p) => p.miles === undefined || p.miles <= MAX_MILES);
      nearby.sort((a, b) => (a.miles ?? Number.MAX_SAFE_INTEGER) - (b.miles ?? Number.MAX_SAFE_INTEGER));
      setResults(nearby);
      setStatuses(known);
      setSearched(true);
    } catch (error) {
      Alert.alert('Could not search', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const statusOf = (provider: ProviderResult): NetworkStatus => statuses[provider.npi] || 'unknown';
  const inNetwork = results.filter((p) => statusOf(p) === 'in');
  const others = results.filter((p) => statusOf(p) !== 'in');

  const renderDoctor = (provider: Found) => {
    const status = statusOf(provider);
    return (
      <View key={provider.npi} style={styles.doctor}>
        <View style={styles.doctorTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.doctorName}>{provider.name}</Text>
            <Text style={styles.doctorMeta}>{provider.miles !== undefined ? `${provider.specialty} · ${provider.miles.toFixed(1)} mi` : provider.specialty}</Text>
            {provider.address ? <Text style={styles.doctorMeta}>{provider.address}</Text> : null}
          </View>
          <Text style={[styles.pill, status === 'in' ? styles.pillIn : styles.pillOther]}>{STATUS_LABEL[status]}</Text>
        </View>
        {provider.phone ? (
          <TouchableOpacity style={styles.callButton} onPress={() => Linking.openURL(`tel:${provider.phone!.replace(/\D/g, '')}`)}>
            <Text style={styles.callText}>Call</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  return (
    <>
      <Section title="Your plan">
        <ListCard>
          <View style={styles.padded}>
            {plan ? (
              <>
                <Text style={styles.planName}>{planName ? `${plan} · ${planName}` : plan}</Text>
                {!directoryAvailable && (
                  <Text style={styles.hint}>We can't check network status for this plan yet. Confirm with your insurer before booking.</Text>
                )}
                {payerPhone ? (
                  <TouchableOpacity style={styles.callButton} onPress={() => Linking.openURL(`tel:${payerPhone.replace(/\D/g, '')}`)}>
                    <Text style={styles.callText}>Call {plan} to confirm network status</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            ) : (
              <Text style={styles.hint}>Add your insurance under Insurance on the Home screen to see network status.</Text>
            )}
          </View>
        </ListCard>
      </Section>

      <Section title="Search">
        <ListCard>
          <View style={styles.padded}>
            <Text style={styles.label}>SPECIALTY</Text>
            <View style={styles.chips}>
              {SPECIALTIES.map((option) => {
                const selected = specialty === option.label;
                return (
                  <TouchableOpacity key={option.label} style={[styles.chip, selected && styles.chipOn]} onPress={() => setSpecialty(option.label)}>
                    <Text style={[styles.chipText, selected && styles.chipTextOn]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

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

      {searched && results.length === 0 && (
        <Text style={styles.empty}>No doctors found for that specialty and ZIP code. Try a nearby ZIP code.</Text>
      )}

      {inNetwork.length > 0 && (
        <Section title="In network">
          <ListCard>
            {inNetwork.map((provider, index) => (
              <React.Fragment key={provider.npi}>
                {index > 0 && <Divider />}
                {renderDoctor(provider)}
              </React.Fragment>
            ))}
          </ListCard>
        </Section>
      )}

      {results.length > 0 && (
        <Text style={styles.disclaimer}>Doctor details come from public provider directories and may be out of date. Confirm network status with your insurer before booking.</Text>
      )}

      {others.length > 0 && (
        <Section title={inNetwork.length > 0 ? 'Not confirmed in network' : 'Doctors near you'}>
          {!directoryAvailable && (
            <Text style={styles.noteBox}>We couldn't confirm network status for these doctors. Call your insurer before booking.</Text>
          )}
          <ListCard>
            {others.map((provider, index) => (
              <React.Fragment key={provider.npi}>
                {index > 0 && <Divider />}
                {renderDoctor(provider)}
              </React.Fragment>
            ))}
          </ListCard>
        </Section>
      )}

      {/* Room below the results, so they can be scrolled into view while the keyboard is up */}
      <View style={styles.keyboardSpace} />
    </>
  );
}

const styles = StyleSheet.create({
  padded: { padding: 14 },
  keyboardSpace: { height: 340 },
  planName: { fontSize: 17, color: '#000', fontWeight: '500' },
  hint: { fontSize: 13, color: '#8E8E93', marginTop: 6 },
  label: { fontSize: 12, fontWeight: '600', color: '#8E8E93', letterSpacing: 0.5, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#D0D0D5', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFF' },
  chipOn: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  chipText: { fontSize: 14, color: '#000', fontWeight: '500' },
  chipTextOn: { color: '#FFF' },
  input: { backgroundColor: '#F2F2F7', borderRadius: 12, paddingHorizontal: 14, minHeight: 50, fontSize: 17, color: '#000' },
  searchButton: { backgroundColor: '#007AFF', borderRadius: 12, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 24, marginBottom: 12 },
  searchDisabled: { backgroundColor: '#A9CFFF' },
  searchText: { color: '#FFF', fontSize: 17, fontWeight: '600' },
  empty: { fontSize: 14, color: '#8E8E93', textAlign: 'center', marginTop: 16, paddingHorizontal: 20 },
  noteBox: { fontSize: 13, color: '#555', backgroundColor: '#FFF9E6', borderRadius: 10, padding: 10, marginBottom: 8 },
  doctor: { padding: 14 },
  doctorTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  doctorName: { fontSize: 16, fontWeight: '600', color: '#000' },
  doctorMeta: { fontSize: 13, color: '#555', marginTop: 2 },
  pill: { fontSize: 12, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  pillIn: { backgroundColor: '#E8F8EE', color: '#1F7A3A' },
  pillOther: { backgroundColor: '#FFF4DB', color: '#7A5A00' },
  callButton: { alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: '#E5F0FF' },
  callText: { fontSize: 14, color: '#007AFF', fontWeight: '600' },
  disclaimer: { fontSize: 12, color: '#8E8E93', textAlign: 'center', marginTop: 16, paddingHorizontal: 20 },
});
