import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRecords } from '@/context/RecordsContext';
import { claudeService } from '@/services/claudeService';
import { useRouter } from 'expo-router';
import { v4 as uuidv4 } from 'uuid';

export default function UploadScreen() {
  const [activeTab, setActiveTab] = useState<'photo' | 'text' | 'gallery'>('photo');
  const [textInput, setTextInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { addRecord } = useRecords();
  const router = useRouter();

  const handlePhotoCapture = async () => {
    Alert.alert('Coming Soon', 'Camera upload feature coming soon. Use text input for now!');
  };

  const handlePhotoLibrary = async () => {
    Alert.alert('Coming Soon', 'Gallery upload feature coming soon. Use text input for now!');
  };

  const processImage = async (base64: string) => {
    setLoading(true);
    try {
      const recordId = uuidv4();
      const parsedRecord = await claudeService.parseRecordFromImage(base64, recordId);

      await addRecord({
        id: recordId,
        uploadDate: parsedRecord.uploadDate || new Date().toISOString(),
        imageUri: parsedRecord.imageUri,
        specialty: parsedRecord.specialty || 'Unspecified',
        provider: parsedRecord.provider || 'Unknown',
        summary: parsedRecord.summary || 'Document uploaded',
        extractedData: parsedRecord.extractedData || {},
        processed: true,
      });

      Alert.alert('Success', 'Record uploaded and processed', [
        {
          text: 'View Record',
          onPress: () => router.push(`/detail/${recordId}`),
        },
        {
          text: 'Back to Home',
          onPress: () => router.push('/'),
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to process image: ' + String(error));
      console.error('Image processing error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTextSubmit = async () => {
    if (textInput.trim().length < 10) {
      Alert.alert('Error', 'Please enter at least 10 characters');
      return;
    }

    setLoading(true);
    try {
      const recordId = uuidv4();
      const parsedRecord = await claudeService.parseRecordFromText(textInput, recordId);

      await addRecord({
        id: recordId,
        uploadDate: parsedRecord.uploadDate || new Date().toISOString(),
        originalText: parsedRecord.originalText,
        specialty: parsedRecord.specialty || 'Unspecified',
        provider: parsedRecord.provider || 'Unknown',
        summary: parsedRecord.summary || 'Document uploaded',
        extractedData: parsedRecord.extractedData || {},
        processed: true,
      });

      setTextInput('');
      Alert.alert('Success', 'Record uploaded and processed', [
        {
          text: 'View Record',
          onPress: () => router.push(`/detail/${recordId}`),
        },
        {
          text: 'Back to Home',
          onPress: () => router.push('/'),
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to process text: ' + String(error));
      console.error('Text processing error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.topBar}>
        <View />
        <Text style={styles.appName}>EasyMedical AI</Text>
      </View>
      <View style={styles.header}>
        <Text style={styles.title}>Upload Medical Record</Text>
        <Text style={styles.subtitle}>Choose how to add your record</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'photo' && styles.activeTab]}
          onPress={() => setActiveTab('photo')}
        >
          <Text style={[styles.tabText, activeTab === 'photo' && styles.activeTabText]}>
            📷 Camera
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'gallery' && styles.activeTab]}
          onPress={() => setActiveTab('gallery')}
        >
          <Text style={[styles.tabText, activeTab === 'gallery' && styles.activeTabText]}>
            🖼️ Gallery
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'text' && styles.activeTab]}
          onPress={() => setActiveTab('text')}
        >
          <Text style={[styles.tabText, activeTab === 'text' && styles.activeTabText]}>
            ✏️ Text
          </Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Processing your record...</Text>
        </View>
      )}

      {!loading && activeTab === 'photo' && (
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardIcon}>📷</Text>
            <Text style={styles.cardTitle}>Take a Photo</Text>
            <Text style={styles.cardSubtitle}>
              Use your camera to photograph medical records
            </Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handlePhotoCapture}
              disabled={loading}
            >
              <Text style={styles.actionButtonText}>Open Camera</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!loading && activeTab === 'gallery' && (
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardIcon}>🖼️</Text>
            <Text style={styles.cardTitle}>Choose from Gallery</Text>
            <Text style={styles.cardSubtitle}>
              Select a photo from your device
            </Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handlePhotoLibrary}
              disabled={loading}
            >
              <Text style={styles.actionButtonText}>Open Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!loading && activeTab === 'text' && (
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardIcon}>✏️</Text>
            <Text style={styles.cardTitle}>Manual Entry</Text>
            <Text style={styles.cardSubtitle}>
              Type or paste your medical information
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter medical information..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={8}
              value={textInput}
              onChangeText={setTextInput}
            />
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleTextSubmit}
              disabled={loading}
            >
              <Text style={styles.actionButtonText}>Process & Upload</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  header: {
    padding: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  tabText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  activeTabText: {
    color: '#FFF',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  cardIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  textInput: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#000',
    marginBottom: 20,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  actionButton: {
    width: '100%',
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    marginTop: 40,
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
  },
});
