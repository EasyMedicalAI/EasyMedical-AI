// The screen shown before a health system's MyChart sign-in opens. It has to be read and continued, not skipped.
import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

const SECTIONS = [
  {
    label: 'WHAT WE ACCESS',
    body: 'Allergies, conditions, medications, appointments, and lab results. Only the types you approve on the MyChart screen.',
  },
  {
    label: 'HOW LONG WE KEEP IT',
    body: 'Until you delete it. You can stop sharing or delete it at any time in Settings.',
  },
  {
    label: 'WHERE IT IS STORED',
    body: 'On this phone. Uploaded documents are read by AI to pull out the details.',
  },
  {
    label: 'WHO SIGNS YOU IN',
    body: "Your health system's MyChart page. EasyMedical AI never sees your MyChart password.",
  },
];

export default function MyChartDisclosure({
  visible,
  onContinue,
  onClose,
  onDismiss,
}: {
  visible: boolean;
  onContinue: () => void;
  onClose: () => void;
  onDismiss?: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onDismiss={onDismiss}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Connect MyChart</Text>
          <View style={styles.spacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.heading}>Before you sign in</Text>
          <Text style={styles.intro}>Read this first. It explains what EasyMedical AI will do with your MyChart information.</Text>

          <View style={styles.card}>
            {SECTIONS.map((section, index) => (
              <View key={section.label} style={[styles.section, index < SECTIONS.length - 1 && styles.sectionDivider]}>
                <Text style={styles.label}>{section.label}</Text>
                <Text style={styles.body}>{section.body}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.primary} onPress={onContinue}>
            <Text style={styles.primaryText}>Continue to MyChart</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={onClose}>
            <Text style={styles.secondaryText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D1D1D6',
  },
  cancel: { fontSize: 17, color: '#007AFF' },
  title: { fontSize: 17, fontWeight: '600', color: '#000' },
  spacer: { width: 52 },
  content: { padding: 16, gap: 16 },
  heading: { fontSize: 28, fontWeight: '700', color: '#000' },
  intro: { fontSize: 15, lineHeight: 21, color: '#3C3C43' },
  card: { backgroundColor: '#FFF', borderRadius: 12, overflow: 'hidden' },
  section: { paddingHorizontal: 16, paddingVertical: 14 },
  sectionDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D1D1D6' },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4, color: '#8E8E93' },
  body: { fontSize: 16, lineHeight: 22, color: '#000', marginTop: 4 },
  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 34, gap: 8 },
  primary: { height: 52, borderRadius: 14, backgroundColor: '#007AFF', alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 17, fontWeight: '600', color: '#FFF' },
  secondary: { height: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 17, color: '#007AFF' },
});
