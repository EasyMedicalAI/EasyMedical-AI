import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import HomeScreen from '@/screens/HomeScreen';
import RecordsScreen from '@/screens/RecordsScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import ChatbotScreen from '@/screens/ChatbotScreen';

export default function TabLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState('home');

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return <HomeScreen />;
      case 'records':
        return <RecordsScreen />;
      case 'chatbot':
        return <ChatbotScreen />;
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
          icon="view-dashboard-outline"
          label="Home"
          active={activeTab === 'home'}
          onPress={() => setActiveTab('home')}
        />
        <TabButton
          icon="file-document-multiple-outline"
          label="Records"
          active={activeTab === 'records'}
          onPress={() => setActiveTab('records')}
        />
        <TabButton
          icon="robot-outline"
          label="Chatbot"
          active={activeTab === 'chatbot'}
          onPress={() => setActiveTab('chatbot')}
        />
        <TabButton
          icon="cog-outline"
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
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.tabButton, active && styles.activeTabButton]}
      onPress={onPress}
    >
      <MaterialCommunityIcons name={icon} size={24} color={active ? '#007AFF' : '#999'} style={styles.tabIcon} />
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
    height: 70,
    justifyContent: 'space-around',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  activeTabButton: {},
  tabIcon: {
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
  },
  activeTabLabel: {
    color: '#007AFF',
  },
});
