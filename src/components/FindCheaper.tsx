// Find medications cheaper: type any medication, pick the generic version, then check prices near a ZIP code.
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Linking, StyleSheet } from 'react-native';
import { Section, ListCard, Divider } from '@/components/ScreenKit';
import { searchMedicines, genericOptions, MedicineMatch, GenericOptions } from '@/services/medicineLookup';
import { cashPrices, PriceLookup } from '@/services/cashPrices';
import { searchPharmacies, ProviderResult } from '@/services/providerSearch';
import { zipLocation, milesBetween } from '@/services/zipLocation';

type Pharmacy = ProviderResult & { miles?: number };

const MAX_MILES = 20;
const MAX_PHARMACIES = 15;

// Pharmacies near a ZIP code, nearest first, so the user can call for a cash price
async function nearbyPharmacies(zip: string): Promise<Pharmacy[]> {
  const found = await searchPharmacies(zip);
  const origin = await zipLocation(zip);
  const zips = [...new Set(found.map((p) => p.zip))];
  const locations = await Promise.all(zips.map((z) => zipLocation(z)));
  const locationByZip = new Map(zips.map((z, i) => [z, locations[i]]));
  const withDistance: Pharmacy[] = found.map((p) => {
    const here = locationByZip.get(p.zip);
    return { ...p, miles: origin && here ? milesBetween(origin, here) : undefined };
  });
  // Pharmacies more than 20 miles away are left out. Pharmacies with no known distance are kept, at the end.
  return withDistance
    .filter((p) => p.miles === undefined || p.miles <= MAX_MILES)
    .sort((a, b) => (a.miles ?? Number.MAX_SAFE_INTEGER) - (b.miles ?? Number.MAX_SAFE_INTEGER))
    .slice(0, MAX_PHARMACIES);
}

export default function FindCheaper() {
  const [term, setTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<MedicineMatch[] | null>(null);
  const [error, setError] = useState('');

  const [picked, setPicked] = useState<MedicineMatch | null>(null);
  const [options, setOptions] = useState<GenericOptions | null>(null);
  const [product, setProduct] = useState<MedicineMatch | null>(null);

  const [zip, setZip] = useState('');
  const [checking, setChecking] = useState(false);
  const [priceResult, setPriceResult] = useState<PriceLookup | null>(null);
  const [pharmacies, setPharmacies] = useState<Pharmacy[] | null>(null);
  const [pharmacyError, setPharmacyError] = useState('');

  const canSearch = term.trim().length > 0 && !searching;
  const canCheck = !!product && /^\d{5}$/.test(zip) && !checking;

  const search = async () => {
    if (!canSearch) return;
    setSearching(true);
    setError('');
    setPicked(null);
    setOptions(null);
    setProduct(null);
    setPriceResult(null);
    try {
      setMatches(await searchMedicines(term));
    } catch (e) {
      setMatches(null);
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const pickMedicine = async (match: MedicineMatch) => {
    setPicked(match);
    setOptions(null);
    setProduct(null);
    setPriceResult(null);
    setError('');
    try {
      setOptions(await genericOptions(match.rxcui));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const checkPrices = async () => {
    if (!canCheck || !product) return;
    setChecking(true);
    setPharmacyError('');
    try {
      setPriceResult(await cashPrices(product.name, zip));
      try {
        setPharmacies(await nearbyPharmacies(zip));
      } catch (e) {
        setPharmacies(null);
        setPharmacyError(e instanceof Error ? e.message : 'Could not find pharmacies. Please try again.');
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <Section title="Medication">
        <ListCard>
          <View style={styles.padded}>
            <Text style={styles.label}>MEDICATION NAME</Text>
            <TextInput
              style={styles.input}
              value={term}
              onChangeText={setTerm}
              onSubmitEditing={search}
              placeholder="e.g. Lipitor or atorvastatin"
              placeholderTextColor="#8E8E93"
              autoCorrect={false}
              returnKeyType="search"
            />
            <TouchableOpacity style={[styles.primaryButton, !canSearch && styles.disabled]} onPress={search} disabled={!canSearch}>
              {searching ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Search</Text>}
            </TouchableOpacity>
          </View>
        </ListCard>
      </Section>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {matches && matches.length === 0 && (
        <Text style={styles.empty}>No medication matched that name. Check the spelling, or try the generic name.</Text>
      )}

      {matches && matches.length > 0 && (
        <Section title="Matches">
          <ListCard>
            {matches.map((match, index) => (
              <React.Fragment key={match.rxcui}>
                {index > 0 && <Divider />}
                <TouchableOpacity style={styles.row} onPress={() => pickMedicine(match)}>
                  <Text style={[styles.rowText, picked?.rxcui === match.rxcui && styles.rowTextOn]}>{match.name}</Text>
                  {picked?.rxcui === match.rxcui && <Text style={styles.selected}>Selected</Text>}
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </ListCard>
        </Section>
      )}

      {picked && options && (
        <Section title="Generic version">
          <ListCard>
            <View style={styles.padded}>
              {options.genericName ? (
                <>
                  <Text style={styles.genericName}>{options.genericName}</Text>
                  <Text style={styles.hint}>Pick the strength and form on your prescription or bottle.</Text>
                </>
              ) : (
                <Text style={styles.hint}>No generic version of this medication was found. Ask your pharmacist about lower-cost options.</Text>
              )}
            </View>
            {options.products.map((p) => (
              <React.Fragment key={p.rxcui}>
                <Divider />
                <TouchableOpacity style={styles.row} onPress={() => setProduct(p)}>
                  <Text style={[styles.rowText, product?.rxcui === p.rxcui && styles.rowTextOn]}>{p.name}</Text>
                  {product?.rxcui === p.rxcui && <Text style={styles.selected}>Selected</Text>}
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </ListCard>
          {options.totalProducts > options.products.length && (
            <Text style={styles.hint}>
              Showing {options.products.length} of {options.totalProducts} generic products, sorted by name.
            </Text>
          )}
        </Section>
      )}

      {product && (
        <Section title="Prices near you">
          <ListCard>
            <View style={styles.padded}>
              <Text style={styles.label}>ZIP CODE</Text>
              <TextInput
                style={styles.input}
                value={zip}
                onChangeText={(value) => {
                  setZip(value.replace(/\D/g, '').slice(0, 5));
                  // Results are for the ZIP code they were searched with, so they clear when it changes
                  setPriceResult(null);
                  setPharmacies(null);
                }}
                placeholder="e.g. 08108"
                placeholderTextColor="#8E8E93"
                keyboardType="number-pad"
                maxLength={5}
              />
              <TouchableOpacity style={[styles.primaryButton, !canCheck && styles.disabled]} onPress={checkPrices} disabled={!canCheck}>
                {checking ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Check prices</Text>}
              </TouchableOpacity>
            </View>
          </ListCard>

          {priceResult?.status === 'not-connected' && (
            <View style={styles.noteBox}>
              <Text style={styles.noteTitle}>Prices aren&apos;t available yet</Text>
              <Text style={styles.noteText}>
                A price source for your ZIP code hasn&apos;t been connected to the app. You can check prices on these sites, or ask your pharmacy for the cash price.
              </Text>
              <TouchableOpacity style={styles.linkButton} onPress={() => Linking.openURL('https://www.goodrx.com')}>
                <Text style={styles.linkText}>Open GoodRx</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkButton} onPress={() => Linking.openURL('https://costplusdrugs.com')}>
                <Text style={styles.linkText}>Open Cost Plus Drugs</Text>
              </TouchableOpacity>
            </View>
          )}

          {priceResult?.status === 'ok' && priceResult.prices.length === 0 && (
            <Text style={styles.hint}>No prices were found near {zip}. Try a nearby ZIP code.</Text>
          )}

          {priceResult?.status === 'ok' && priceResult.prices.length > 0 && (
            <ListCard>
              {priceResult.prices.map((price, index) => (
                <React.Fragment key={`${price.pharmacy}-${index}`}>
                  {index > 0 && <Divider />}
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowText}>{price.pharmacy}</Text>
                      <Text style={styles.hint}>
                        {price.quantity} · as of {price.asOf}
                      </Text>
                    </View>
                    <Text style={styles.price}>${price.price.toFixed(2)}</Text>
                  </View>
                </React.Fragment>
              ))}
            </ListCard>
          )}

          {pharmacyError ? <Text style={styles.error}>{pharmacyError}</Text> : null}

          {pharmacies && pharmacies.length === 0 && (
            <Text style={styles.hint}>No pharmacies were found within {MAX_MILES} miles of {zip}.</Text>
          )}

          {pharmacies && pharmacies.length > 0 && (
            <>
              <Text style={styles.subhead}>Pharmacies near {zip}</Text>
              <ListCard>
                {pharmacies.map((pharmacy, index) => (
                  <React.Fragment key={pharmacy.npi}>
                    {index > 0 && <Divider />}
                    <View style={styles.pharmacy}>
                      <Text style={styles.rowText}>{pharmacy.name}</Text>
                      <Text style={styles.hint}>
                        {pharmacy.miles !== undefined ? `${pharmacy.miles.toFixed(1)} mi · ` : ''}
                        {pharmacy.address}
                      </Text>
                      {pharmacy.phone ? (
                        <TouchableOpacity
                          style={styles.linkButton}
                          onPress={() => Linking.openURL(`tel:${pharmacy.phone!.replace(/\D/g, '')}`)}
                        >
                          <Text style={styles.linkText}>Call for cash price</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </React.Fragment>
                ))}
              </ListCard>
              <Text style={styles.hint}>
                Ask for the cash price of {product.name}. Not every pharmacy lists cash prices by phone.
              </Text>
            </>
          )}
        </Section>
      )}

      <Text style={styles.disclaimer}>
        Medication names come from the National Library of Medicine&apos;s RxNorm database. Prices can change, and the generic version may not match your prescription. Ask your pharmacist before switching.
      </Text>

      {/* Room below the results, so they can be scrolled into view while the keyboard is up */}
      <View style={styles.keyboardSpace} />
    </>
  );
}

const styles = StyleSheet.create({
  padded: { padding: 14 },
  keyboardSpace: { height: 340 },
  label: { fontSize: 12, fontWeight: '600', color: '#8E8E93', letterSpacing: 0.5, marginBottom: 6 },
  input: { backgroundColor: '#F2F2F7', borderRadius: 12, paddingHorizontal: 14, minHeight: 50, fontSize: 17, color: '#000' },
  primaryButton: { backgroundColor: '#007AFF', borderRadius: 12, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  primaryText: { color: '#FFF', fontSize: 17, fontWeight: '600' },
  disabled: { backgroundColor: '#A9CFFF' },
  row: { paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowText: { flex: 1, fontSize: 16, color: '#000' },
  rowTextOn: { color: '#007AFF', fontWeight: '600' },
  selected: { fontSize: 13, color: '#007AFF', fontWeight: '600' },
  genericName: { fontSize: 17, fontWeight: '500', color: '#000' },
  hint: { fontSize: 13, color: '#8E8E93', marginTop: 6, paddingHorizontal: 2 },
  error: { fontSize: 14, color: '#B42318', textAlign: 'center', marginTop: 12, paddingHorizontal: 20 },
  empty: { fontSize: 14, color: '#8E8E93', textAlign: 'center', marginTop: 16, paddingHorizontal: 20 },
  noteBox: { backgroundColor: '#FFF9E6', borderRadius: 12, padding: 14, marginTop: 8 },
  noteTitle: { fontSize: 15, fontWeight: '600', color: '#000' },
  noteText: { fontSize: 13, color: '#555', marginTop: 4, lineHeight: 18 },
  linkButton: { alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: '#E5F0FF' },
  linkText: { fontSize: 14, color: '#007AFF', fontWeight: '600' },
  price: { fontSize: 17, fontWeight: '600', color: '#000' },
  subhead: { fontSize: 13, fontWeight: '600', color: '#8E8E93', marginTop: 16, marginBottom: 6, paddingHorizontal: 2 },
  pharmacy: { padding: 14 },
  disclaimer: { fontSize: 12, color: '#8E8E93', textAlign: 'center', marginTop: 16, paddingHorizontal: 20 },
});
