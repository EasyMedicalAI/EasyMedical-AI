import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import HomeScreen from '@/screens/HomeScreen';
import UploadScreen from '@/screens/UploadScreen';
import SpecialtiesScreen from '@/screens/SpecialtiesScreen';
import SettingsScreen from '@/screens/SettingsScreen';

export default function TabLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState('home');

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return <HomeScreen />;
      case 'upload':
        return <UploadScreen />;
      case 'specialties':
        return <SpecialtiesScreen />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <HomeScreen />;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {renderScreen()}
      </View>
      <View style={styles.tabBar}>
        <TabButton
          icon="📊"
          label="Home"
          active={activeTab === 'home'}
          onPress={() => setActiveTab('home')}
        />
        <TabButton
          icon="⊕"
          label="Upload"
          active={activeTab === 'upload'}
          onPress={() => setActiveTab('upload')}
        />
        <TabButton
          icon="🏥"
          label="Specialties"
          active={activeTab === 'specialties'}
          onPress={() => setActiveTab('specialties')}
        />
        <TabButton
          icon="⚙️"
          label="Settings"
          active={activeTab === 'settings'}
          onPress={() => setActiveTab('settings')}
        />
      </View>
    </View>
  );
}

function TabButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: string;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.tabButton, active && styles.activeTabButton]}
      onPress={onPress}
    >
      <Text style={styles.tabIcon}>{icon}</Text>
      <Text style={[styles.tabLabel, active && styles.activeTabLabel]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderTopColor: '#F0F0F0',
    borderTopWidth: 1,
    paddingBottom: 8,
    paddingTop: 8,
    height: 60,
    justifyContent: 'space-around',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  activeTabButton: {},
  tabIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  activeTabLabel: {
    color: '#007AFF',
  },
});
