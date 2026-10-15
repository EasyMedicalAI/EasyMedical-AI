import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ehrService } from '@/services/ehrService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACKNOWLEDGED_KEY = 'expired_connections_acknowledged';
import HomeScreen from '@/screens/HomeScreen';
import RecordsScreen from '@/screens/RecordsScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import ChatbotScreen from '@/screens/ChatbotScreen';

export default function TabLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState('home');
  const [expiredCount, setExpiredCount] = useState(0);

  // Opening Settings counts as seeing that a connection has expired, so the badge clears.
  // It comes back only for a connection that expires again after being reconnected.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const expired = await ehrService.getExpiredSystemIds();
        const stored: string[] = JSON.parse((await AsyncStorage.getItem(ACKNOWLEDGED_KEY)) || '[]');
        // Keep only acknowledgments for connections that are still expired
        let acknowledged = stored.filter((id) => expired.includes(id));
        if (activeTab === 'settings') acknowledged = expired;
        await AsyncStorage.setItem(ACKNOWLEDGED_KEY, JSON.stringify(acknowledged));
        if (!cancelled) setExpiredCount(expired.filter((id) => !acknowledged.includes(id)).length);
      } catch {
        if (!cancelled) setExpiredCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

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
          badge={expiredCount}
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
  badge = 0,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  active: boolean;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <TouchableOpacity
      style={[styles.tabButton, active && styles.activeTabButton]}
      onPress={onPress}
    >
      <View>
        <MaterialCommunityIcons name={icon} size={24} color={active ? '#007AFF' : '#999'} style={styles.tabIcon} />
        {badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
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
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
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
