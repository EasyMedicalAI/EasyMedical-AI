// Speech recognition, loaded only if this build includes it. Older builds keep running and the mic explains the update.
let speechModule: any = null;
try {
  speechModule = require('expo-speech-recognition');
} catch {
  speechModule = null;
}

export const speechAvailable = !!speechModule;
export const SpeechModule: any = speechModule?.ExpoSpeechRecognitionModule ?? null;

// Hook wrapper. Whether the module exists never changes while the app runs, so the hook order stays the same.
export function useSpeechEvent(name: string, handler: (event: any) => void) {
  if (speechModule) speechModule.useSpeechRecognitionEvent(name, handler);
}
