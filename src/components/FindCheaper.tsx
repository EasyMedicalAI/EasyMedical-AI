// Find medications cheaper: type any medication, pick the generic version, then check prices near a ZIP code.
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Linking, StyleSheet } from 'react-native';
import { Section, ListCard, Divider } from '@/components/ScreenKit';
import { searchMedicines, genericOptions, MedicineMatch, GenericOptions } from '@/services/medicineLookup';
import { cashPrices, CashPrice } from '@/services/cashPrices';
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
  const [prices, setPrices] = useState<CashPrice[] | null>(null);
  const [priceError, setPriceError] = useState('');
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [pharmacies, setPharmacies] = useState<Pharmacy[] | null>(null);
  const [pharmacyError, setPharmacyError] = useState('');

  const canSearch = term.trim().length > 0 && !searching;
  const canShowPharmacies = !!product && /^\d{5}$/.test(zip) && !checking;

  const search = async () => {
    if (!canSearch) return;
    setSearching(true);
    setError('');
    setPicked(null);
    setOptions(null);
    setProduct(null);
    setPrices(null);
    setPriceError('');
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
    setPrices(null);
    setPriceError('');
    setError('');
    try {
      setOptions(await genericOptions(match.rxcui));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    }
  };

  // Cost Plus prices don't depend on the ZIP code, so they load as soon as a form is picked
  const loadPrices = async (chosen: MedicineMatch) => {
    setLoadingPrices(true);
    setPrices(null);
    setPriceError('');
    try {
      setPrices(await cashPrices(chosen, options?.genericName ?? null));
    } catch (e) {
      setPriceError(e instanceof Error ? e.message : 'Prices could not be loaded. Please try again.');
    } finally {
      setLoadingPrices(false);
    }
  };

  const chooseProduct = (chosen: MedicineMatch) => {
    setProduct(chosen);
    setPharmacies(null);
    setPharmacyError('');
    loadPrices(chosen);
  };

  const showPharmacies = async () => {
    if (!canShowPharmacies) return;
    setChecking(true);
    setPharmacyError('');
    try {
      setPharmacies(await nearbyPharmacies(zip));
    } catch (e) {
      setPharmacies(null);
      setPharmacyError(e instanceof Error ? e.message : 'Could not find pharmacies. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <Section title="1. Medication">
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
        <Section title="2. Form">
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
                <TouchableOpacity style={styles.row} onPress={() => chooseProduct(p)}>
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
        <Section title="3. Prices">
          {loadingPrices && <ActivityIndicator style={styles.loading} />}

          {priceError ? <Text style={styles.error}>{priceError}</Text> : null}

          {prices && prices.length === 0 && (
            <Text style={styles.hint}>Cost Plus Drugs doesn&apos;t list this medication. Ask a pharmacy for the cash price.</Text>
          )}

          {prices && prices.length > 0 && (
            <>
              <ListCard>
                {prices.map((price, index) => (
                  <React.Fragment key={`${price.pharmacy}-${index}`}>
                    {index > 0 && <Divider />}
                    <TouchableOpacity
                      style={styles.row}
                      disabled={!price.url}
                      onPress={() => price.url && Linking.openURL(price.url)}
                      accessibilityRole="link"
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowText}>{price.pharmacy}</Text>
                        <Text style={styles.hint}>
                          {price.quantity} · as of {price.asOf}
                        </Text>
                      </View>
                      <Text style={styles.price}>${price.price.toFixed(2)}</Text>
                    </TouchableOpacity>
                  </React.Fragment>
                ))}
              </ListCard>
              <Text style={styles.hint}>
                Prices from Cost Plus Drugs, a mail-order pharmacy. Shipping is not included yet.
              </Text>
              <Text style={styles.hint}>No insurance needed. Cost Plus Drugs sells at cash prices.</Text>
            </>
          )}

          <ListCard>
            <View style={styles.padded}>
              <Text style={styles.label}>ZIP CODE FOR NEARBY PHARMACIES</Text>
              <TextInput
                style={styles.input}
                value={zip}
                onChangeText={(value) => {
                  setZip(value.replace(/\D/g, '').slice(0, 5));
                  // Pharmacies are for the ZIP code they were searched with, so they clear when it changes
                  setPharmacies(null);
                }}
                placeholder="e.g. 08108"
                placeholderTextColor="#8E8E93"
                keyboardType="number-pad"
                maxLength={5}
              />
              <TouchableOpacity
                style={[styles.primaryButton, !canShowPharmacies && styles.disabled]}
                onPress={showPharmacies}
                disabled={!canShowPharmacies}
              >
                {checking ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Show nearby pharmacies</Text>}
              </TouchableOpacity>
            </View>
          </ListCard>

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
  loading: { marginVertical: 12 },
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
