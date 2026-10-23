import * as Camera from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { photoStorageService, StoredPhoto } from './photoStorageService';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://easymedical-backend-new-production.up.railway.app';

// Log backend URL on startup
console.log(`🌐 Backend URL configured: ${BACKEND_URL}`);

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

  async pickPhotoFromLibrary(allowMultiple: boolean = false): Promise<string | string[] | null> {
    try {
      const hasPermission = await this.requestMediaLibraryPermission();
      if (!hasPermission) {
        throw new Error('Media library permission denied');
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        allowsMultiple: allowMultiple,
        quality: 1,
      });

      if (!result.canceled && result.assets.length > 0) {
        if (allowMultiple) {
          return result.assets.map(asset => asset.uri);
        }
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

  // Reads a medication label from one or more JPEG photos (base64)
  async analyzeMedicationLabel(base64Images: string[]): Promise<AnalysisResult> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/vision/medication-label`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: base64Images }),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return { success: false, error: `Backend error ${response.status}: ${errorText || 'No response body'}` };
      }
      return { success: true, data: await response.json() };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Reads an insurance card from photos and/or PDFs. The card is sent for reading only; nothing is stored.
  async analyzeInsuranceCard(images: string[], documents: string[]): Promise<AnalysisResult> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/vision/insurance-card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images, documents }),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return { success: false, error: `Backend error ${response.status}: ${errorText || 'No response body'}` };
      }
      return { success: true, data: await response.json() };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Reads one or more PDF files (for example, an after-visit summary) through the same extraction as photos
  async analyzePdfs(pdfUris: string[]): Promise<AnalysisResult> {
    try {
      const documents = await Promise.all(
        pdfUris.map((uri) => FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }))
      );
      const response = await fetch(`${BACKEND_URL}/api/vision/extract-record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents }),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return { success: false, error: `Backend error ${response.status}: ${errorText || 'No response body'}` };
      }
      return { success: true, data: await response.json() };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async analyzeHealthRecord(imageUris: string | string[], recordType: 'lab' | 'other' = 'other'): Promise<AnalysisResult> {
    try {
      // Convert single URI to array for consistent processing
      const uriArray = Array.isArray(imageUris) ? imageUris : [imageUris];

      // Compress images before converting to base64 to avoid payload size limits
      console.log(`📸 Compressing ${uriArray.length} image(s) before encoding (recordType: ${recordType})...`);
      const compressedUris = await Promise.all(
        // Keep full detail for every document so small print in lab tables stays readable
        uriArray.map(uri => this.compressImage(uri, true))
      );

      // Convert all images to base64
      const base64Images = await Promise.all(
        compressedUris.map(uri => this.imageUriToBase64(uri))
      );

      if (base64Images.some(b64 => !b64)) {
        throw new Error('Failed to convert one or more images to base64');
      }

      // Every document goes through the same structured extraction, so the result has one shape
      const url = `${BACKEND_URL}/api/vision/extract-record`;
      console.log(`🌐 Calling backend: ${url}`);
      console.log(`📦 Payload: ${base64Images.length} image(s) for ${recordType}`);

      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images: base64Images }),
        });
      } catch (fetchError) {
        console.error(`❌ Network error calling backend:`, fetchError);
        return {
          success: false,
          error: `Network error: ${fetchError instanceof Error ? fetchError.message : 'Failed to connect to backend'}. Check if backend is running at ${BACKEND_URL}`,
        };
      }

      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
        } catch (e) {
          errorText = 'Unable to read error response';
        }
        console.error(`❌ Backend returned ${response.status}:`, errorText);
        return {
          success: false,
          error: `Backend error ${response.status}: ${errorText || 'No response body'}`,
        };
      }

      const result = await response.json();
      console.log('✅ Backend analysis successful');
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('❌ Error analyzing health record:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Analysis error: ${errorMsg}`,
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

  async compressImage(imageUri: string, isLabPhoto: boolean = false): Promise<string> {
    try {
      console.log(`🗜️ Starting image compression: ${imageUri} (lab: ${isLabPhoto})`);

      // Get original file size
      const originalInfo = await FileSystem.getInfoAsync(imageUri);
      if (!originalInfo.size) {
        console.warn(`⚠️ Could not get file size, skipping compression`);
        return imageUri;
      }

      const originalSizeMB = (originalInfo.size / 1024 / 1024).toFixed(2);
      console.log(`📏 Original file size: ${originalSizeMB} MB`);

      // For lab photos, use HIGHER quality to preserve text/numbers readability
      // For other images, use standard compression
      let compress: number;
      let width: number;

      if (isLabPhoto) {
        // Lab photos: MAXIMIZE quality for Claude's vision to read all text
        compress = 0.8; // 80% quality - high quality for text clarity
        width = 1800; // Higher width to preserve table text readability
        console.log(`🔬 Lab photo mode: HIGH QUALITY (${(compress * 100).toFixed(0)}%) at ${width}px for full text extraction`);
      } else {
        // Regular images: standard compression
        compress = originalInfo.size > 5 * 1024 * 1024 ? 0.3 : 0.5; // 30-50% quality for others
        width = originalInfo.size > 5 * 1024 * 1024 ? 800 : 1200; // Standard widths
        console.log(`📸 Regular photo mode: standard compression (${(compress * 100).toFixed(0)}%)`);
      }

      console.log(`🔧 Using compression: ${(compress * 100).toFixed(0)}%, width: ${width}px`);

      // Resize and compress image using ImageManipulator
      // For documents, preserve original aspect ratio instead of forcing 1.33
      const manipResult = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width } }], // Don't specify height - let it maintain original aspect ratio
        { compress, format: ImageManipulator.SaveFormat.JPEG }
      );

      console.log(`✅ Compression complete: ${manipResult.uri}`);

      // Get compressed file size
      const compressedInfo = await FileSystem.getInfoAsync(manipResult.uri);
      if (compressedInfo.size) {
        const compressedSizeMB = (compressedInfo.size / 1024 / 1024).toFixed(2);
        console.log(`📊 Compressed from ${originalSizeMB}MB to ${compressedSizeMB}MB`);
      }

      return manipResult.uri;
    } catch (error) {
      console.error(`❌ Compression error:`, error);
      console.warn(`⚠️ Falling back to original image`);
      return imageUri;
    }
  },

  async imageUriToBase64(imageUri: string): Promise<string | null> {
    try {
      console.log(`📊 Converting image to base64: ${imageUri}`);
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log(`✅ Base64 conversion successful. Length: ${base64.length} characters`);
      return base64;
    } catch (error) {
      console.error('❌ Error converting image to base64:', error);
      return null;
    }
  },
};
