import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

export interface StoredPhoto {
  id: string;
  uri: string;
  type: 'medication' | 'document' | 'record';
  timestamp: string;
  description?: string;
  analysis?: string;
}

const PHOTOS_DIR = `${FileSystem.documentDirectory}photos/`;
const PHOTOS_STORAGE_KEY = 'stored_photos';

export const photoStorageService = {
  async initializePhotoDirectory() {
    try {
      const info = await FileSystem.getInfoAsync(PHOTOS_DIR);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
      }
    } catch (error) {
      console.error('Error initializing photo directory:', error);
    }
  },

  async savePhoto(
    imageUri: string,
    type: 'medication' | 'document' | 'record',
    description?: string,
    analysis?: string
  ): Promise<StoredPhoto> {
    try {
      // Initialize directory if needed
      await this.initializePhotoDirectory();

      // Compress image to reduce storage
      const compressedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 1200, height: 1200 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      // Generate unique ID
      const photoId = `${type}_${Date.now()}`;
      const filename = `${photoId}.jpg`;
      const filePath = `${PHOTOS_DIR}${filename}`;

      // Copy file to storage
      await FileSystem.copyAsync({
        from: compressedImage.uri,
        to: filePath,
      });

      // Create photo object
      const photo: StoredPhoto = {
        id: photoId,
        uri: filePath,
        type,
        timestamp: new Date().toISOString(),
        description,
        analysis,
      };

      // Save metadata to AsyncStorage
      await this.savePhotoMetadata(photo);

      return photo;
    } catch (error) {
      console.error('Error saving photo:', error);
      throw error;
    }
  },

  async savePhotoMetadata(photo: StoredPhoto) {
    try {
      const existingPhotos = await this.getAllPhotos();
      const updated = [...existingPhotos, photo];
      await AsyncStorage.setItem(PHOTOS_STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving photo metadata:', error);
      throw error;
    }
  },

  async getAllPhotos(): Promise<StoredPhoto[]> {
    try {
      const data = await AsyncStorage.getItem(PHOTOS_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting photos:', error);
      return [];
    }
  },

  async getPhotosByType(type: 'medication' | 'document' | 'record'): Promise<StoredPhoto[]> {
    try {
      const allPhotos = await this.getAllPhotos();
      return allPhotos.filter(photo => photo.type === type);
    } catch (error) {
      console.error('Error getting photos by type:', error);
      return [];
    }
  },

  async updatePhotoAnalysis(photoId: string, analysis: string) {
    try {
      const photos = await this.getAllPhotos();
      const updated = photos.map(photo =>
        photo.id === photoId ? { ...photo, analysis } : photo
      );
      await AsyncStorage.setItem(PHOTOS_STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error updating photo analysis:', error);
      throw error;
    }
  },

  async deletePhoto(photoId: string) {
    try {
      // Delete from metadata
      const photos = await this.getAllPhotos();
      const updated = photos.filter(photo => photo.id !== photoId);
      await AsyncStorage.setItem(PHOTOS_STORAGE_KEY, JSON.stringify(updated));

      // Delete file
      const photo = photos.find(p => p.id === photoId);
      if (photo) {
        await FileSystem.deleteAsync(photo.uri, { idempotent: true });
      }
    } catch (error) {
      console.error('Error deleting photo:', error);
      throw error;
    }
  },

  async getPhotoUri(photoId: string): Promise<string | null> {
    try {
      const photos = await this.getAllPhotos();
      const photo = photos.find(p => p.id === photoId);
      return photo?.uri || null;
    } catch (error) {
      console.error('Error getting photo URI:', error);
      return null;
    }
  },

  async exportPhotoAsBase64(photoId: string): Promise<string | null> {
    try {
      const photoUri = await this.getPhotoUri(photoId);
      if (!photoUri) return null;

      const base64 = await FileSystem.readAsStringAsync(photoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return base64;
    } catch (error) {
      console.error('Error exporting photo as base64:', error);
      return null;
    }
  },
};
