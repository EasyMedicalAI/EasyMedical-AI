import * as Camera from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { photoStorageService, StoredPhoto } from './photoStorageService';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export interface AnalysisResult {
  success: boolean;
  data?: any;
  error?: string;
}

export const cameraService = {
  async requestCameraPermission(): Promise<boolean> {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      return false;
    }
  },

  async requestMediaLibraryPermission(): Promise<boolean> {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting media library permission:', error);
      return false;
    }
  },

  async pickPhotoFromLibrary(): Promise<string | null> {
    try {
      const hasPermission = await this.requestMediaLibraryPermission();
      if (!hasPermission) {
        throw new Error('Media library permission denied');
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets.length > 0) {
        return result.assets[0].uri;
      }
      return null;
    } catch (error) {
      console.error('Error picking photo from library:', error);
      throw error;
    }
  },

  async takeCameraPhoto(): Promise<string | null> {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets.length > 0) {
        return result.assets[0].uri;
      }
      return null;
    } catch (error) {
      console.error('Error taking camera photo:', error);
      throw error;
    }
  },

  async analyzeMedicationBottle(imageUri: string): Promise<AnalysisResult> {
    try {
      const base64 = await this.imageUriToBase64(imageUri);
      if (!base64) {
        throw new Error('Failed to convert image to base64');
      }

      const response = await fetch(`${BACKEND_URL}/api/vision/analyze-medication`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64,
          analysisType: 'medication',
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          error: 'Failed to analyze medication bottle',
        };
      }

      const result = await response.json();
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Error analyzing medication:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  async analyzeDocument(imageUri: string): Promise<AnalysisResult> {
    try {
      const base64 = await this.imageUriToBase64(imageUri);
      if (!base64) {
        throw new Error('Failed to convert image to base64');
      }

      const response = await fetch(`${BACKEND_URL}/api/vision/analyze-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64,
          analysisType: 'document',
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          error: 'Failed to analyze document',
        };
      }

      const result = await response.json();
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Error analyzing document:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  async analyzeHealthRecord(imageUri: string): Promise<AnalysisResult> {
    try {
      const base64 = await this.imageUriToBase64(imageUri);
      if (!base64) {
        throw new Error('Failed to convert image to base64');
      }

      const response = await fetch(`${BACKEND_URL}/api/vision/analyze-record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64,
          analysisType: 'record',
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          error: 'Failed to analyze health record',
        };
      }

      const result = await response.json();
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Error analyzing health record:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  async captureAndSavePhoto(
    type: 'medication' | 'document' | 'record',
    useCamera: boolean = true
  ): Promise<StoredPhoto | null> {
    try {
      // Get image
      const imageUri = useCamera
        ? await this.takeCameraPhoto()
        : await this.pickPhotoFromLibrary();

      if (!imageUri) {
        return null;
      }

      // Analyze based on type
      let analysis: AnalysisResult;
      switch (type) {
        case 'medication':
          analysis = await this.analyzeMedicationBottle(imageUri);
          break;
        case 'document':
          analysis = await this.analyzeDocument(imageUri);
          break;
        case 'record':
          analysis = await this.analyzeHealthRecord(imageUri);
          break;
      }

      // Save photo with analysis
      const photo = await photoStorageService.savePhoto(
        imageUri,
        type,
        undefined,
        analysis.success ? JSON.stringify(analysis.data) : analysis.error
      );

      return photo;
    } catch (error) {
      console.error('Error capturing and saving photo:', error);
      throw error;
    }
  },

  async imageUriToBase64(imageUri: string): Promise<string | null> {
    try {
      const { FileSystem } = await import('expo-file-system/legacy');
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return base64;
    } catch (error) {
      console.error('Error converting image to base64:', error);
      return null;
    }
  },
};
