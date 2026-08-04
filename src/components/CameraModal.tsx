import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import { cameraService } from '@/services/cameraService';
import { photoStorageService } from '@/services/photoStorageService';

interface CameraModalProps {
  visible: boolean;
  type: 'medication' | 'document' | 'record';
  onClose: () => void;
  onPhotoSaved: (photoId: string, analysis: string) => void;
}

export default function CameraModal({ visible, type, onClose, onPhotoSaved }: CameraModalProps) {
  const [loading, setLoading] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  const getTitle = () => {
    switch (type) {
      case 'medication':
        return 'Scan Medication Bottle';
      case 'document':
        return 'Capture Medical Document';
      case 'record':
        return 'Photograph Health Record';
    }
  };

  const getDescription = () => {
    switch (type) {
      case 'medication':
        return 'Take a clear photo of the medication bottle label to extract dosage and instructions.';
      case 'document':
        return 'Capture a medical document such as a prescription or test result.';
      case 'record':
        return 'Take a photo of a health record or lab result for analysis.';
    }
  };

  const handleTakePhoto = async () => {
    try {
      setLoading(true);
      const imageUri = await cameraService.takeCameraPhoto();

      if (imageUri) {
        setPreviewUri(imageUri);
        analyzePhoto(imageUri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
      console.error('Camera error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePickPhoto = async () => {
    try {
      setLoading(true);
      const imageUri = await cameraService.pickPhotoFromLibrary();

      if (imageUri) {
        setPreviewUri(imageUri);
        analyzePhoto(imageUri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick photo. Please try again.');
      console.error('Pick photo error:', error);
    } finally {
      setLoading(false);
    }
  };

  const analyzePhoto = async (imageUri: string) => {
    try {
      setAnalyzing(true);
      let result;

      switch (type) {
        case 'medication':
          result = await cameraService.analyzeMedicationBottle(imageUri);
          break;
        case 'document':
          result = await cameraService.analyzeDocument(imageUri);
          break;
        case 'record':
          result = await cameraService.analyzeHealthRecord(imageUri);
          break;
      }

      if (result.success) {
        const analysisText = typeof result.data === 'string'
          ? result.data
          : JSON.stringify(result.data, null, 2);
        setAnalysisResult(analysisText);
      } else {
        Alert.alert('Error', result.error || 'Failed to analyze photo');
      }
    } catch (error) {
      Alert.alert('Error', 'Analysis failed. Please try again.');
      console.error('Analysis error:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSavePhoto = async () => {
    try {
      if (!previewUri) return;

      setLoading(true);
      const photo = await photoStorageService.savePhoto(
        previewUri,
        type,
        undefined,
        analysisResult || undefined
      );

      onPhotoSaved(photo.id, analysisResult || '');
      resetModal();
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to save photo.');
      console.error('Save error:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setPreviewUri(null);
    setAnalysisResult(null);
    setAnalyzing(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.closeButton}>✕ Close</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{getTitle()}</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {!previewUri ? (
            <>
              <Text style={styles.description}>{getDescription()}</Text>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.largeButton, styles.cameraButton]}
                  onPress={handleTakePhoto}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" size="large" />
                  ) : (
                    <>
                      <Text style={styles.buttonIcon}>📷</Text>
                      <Text style={styles.buttonText}>Take Photo</Text>
                      <Text style={styles.buttonSubtext}>Use device camera</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.largeButton, styles.libraryButton]}
                  onPress={handlePickPhoto}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#007AFF" size="large" />
                  ) : (
                    <>
                      <Text style={styles.buttonIcon}>📸</Text>
                      <Text style={[styles.buttonText, { color: '#007AFF' }]}>
                        Choose Photo
                      </Text>
                      <Text style={styles.buttonSubtext}>From your library</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.previewTitle}>Photo Preview</Text>
              <Image source={{ uri: previewUri }} style={styles.preview} />

              {analyzing ? (
                <View style={styles.analyzingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <Text style={styles.analyzingText}>Analyzing photo...</Text>
                </View>
              ) : analysisResult ? (
                <>
                  <Text style={styles.analysisTitle}>Analysis Results</Text>
                  <View style={styles.analysisBox}>
                    <ScrollView style={styles.analysisScroll}>
                      <Text style={styles.analysisText}>{analysisResult}</Text>
                    </ScrollView>
                  </View>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.button, styles.retakeButton]}
                      onPress={() => {
                        setPreviewUri(null);
                        setAnalysisResult(null);
                      }}
                    >
                      <Text style={[styles.buttonTextSmall, { color: '#007AFF' }]}>
                        Retake Photo
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.button, styles.saveButton]}
                      onPress={handleSavePhoto}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <Text style={[styles.buttonTextSmall, { color: '#FFF' }]}>
                          Save & Use Analysis
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.errorText}>Failed to analyze photo. Please try again.</Text>
                  <TouchableOpacity
                    style={[styles.button, styles.retakeButton]}
                    onPress={() => {
                      setPreviewUri(null);
                      setAnalysisResult(null);
                    }}
                  >
                    <Text style={[styles.buttonTextSmall, { color: '#007AFF' }]}>
                      Try Again
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  closeButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    lineHeight: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    gap: 12,
  },
  largeButton: {
    paddingVertical: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraButton: {
    backgroundColor: '#007AFF',
  },
  libraryButton: {
    backgroundColor: '#F0F8FF',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  buttonIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 4,
  },
  buttonSubtext: {
    fontSize: 12,
    color: '#FFF',
    opacity: 0.8,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  preview: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    marginBottom: 20,
  },
  analyzingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  analyzingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
  },
  analysisTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  analysisBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    maxHeight: 200,
    marginBottom: 16,
  },
  analysisScroll: {
    maxHeight: 200,
  },
  analysisText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3333',
    textAlign: 'center',
    marginVertical: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  retakeButton: {
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  buttonTextSmall: {
    fontSize: 14,
    fontWeight: '600',
  },
});
