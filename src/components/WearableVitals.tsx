// The "Connect wearable device" row under Blood Type. Tapping it opens the wearable details page.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import WearableDetailScreen from '@/components/WearableDetailScreen';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { rowIconSize } from '@/components/rowIcons';

export default function WearableVitals() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity style={styles.row} onPress={() => setOpen(true)}>
        <MaterialCommunityIcons name="watch-variant" size={rowIconSize("watch-variant")} color="#666" style={styles.icon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Connect wearable device</Text>
          <Text style={styles.sub}>Tap to see your metrics</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color="#C7C7CC" style={styles.chevron} />
      </TouchableOpacity>

      <WearableDetailScreen visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  icon: {
    width: 22,
    marginRight: 12,
  },
  sub: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  chevron: {
    marginLeft: 8,
  },
});
