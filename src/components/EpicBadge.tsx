// The small "From Epic" tag shown beside any item imported from Epic. It uses a generic icon, not Epic's logo.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function EpicBadge() {
  return (
    <View style={styles.badge}>
      <MaterialCommunityIcons name="cloud-download-outline" size={12} color="#007AFF" />
      <Text style={styles.text}>From Epic</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'center',
    backgroundColor: '#E5F1FF',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: { fontSize: 11, fontWeight: '600', color: '#007AFF' },
});
