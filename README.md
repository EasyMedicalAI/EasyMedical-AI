# EasyMedical

A mobile app that centralizes all your health records in one place. Upload records from doctors, pharmacies, and labs via photo, gallery, or manual input. AI-powered Claude parses and summarizes records in plain language.

## Features

- **📊 Dashboard** - Quick view of key medical info (medications, allergies, recent results)
- **⊕ Upload Records** - Add records via camera, photo library, or manual text input
- **🏥 Organize by Specialty** - Browse records grouped by medical specialty (Cardiology, Orthopedics, etc.)
- **🤖 AI Parsing** - Claude automatically extracts key information and creates plain-language summaries
- **📱 Local Storage** - All records stored securely on your device
- **☁️ Cloud Sync** - Optional cloud backup (coming soon)

## Quick Start

### Prerequisites
- Node.js 18+
- Claude API key from https://console.anthropic.com/

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up your Claude API key:
   - Open `.env.local`
   - Add: `EXPO_PUBLIC_ANTHROPIC_API_KEY=your_key_here`

3. Start the app:
```bash
npm start
```

4. Run on device:
   - **iOS**: Press `i`
   - **Android**: Press `a`
   - **Web**: Press `w`

## How It Works

### Upload & AI Processing
1. Choose upload method (camera, gallery, or text)
2. Claude API extracts key information:
   - Medical specialty & provider
   - Medications & allergies
   - Test results & conditions
3. Generates plain-language summary
4. Saved securely to your device

### Dashboard
- View unique medications across all records
- See all allergies with warning badges
- Browse recent records
- One-tap upload for new records

### Specialties
- Records organized by medical specialty
- Expandable sections per specialty
- Quick access to provider information

## Project Structure

```
src/
├── screens/           # UI screens
├── context/           # State management
├── services/          # Claude API, storage
├── types/             # TypeScript types
└── app/               # Routing (expo-router)
```

## Technology

- React Native + Expo
- Anthropic Claude API
- AsyncStorage for local data
- TypeScript

## Building

```bash
# Development
eas build --platform ios --profile preview
eas build --platform android --profile preview

# Production
eas build --platform ios
eas build --platform android
```

## Troubleshooting

**Claude API errors?**
- Check `.env.local` has your API key
- Verify key at https://console.anthropic.com/

**Records not saving?**
- Check device storage space
- Verify AsyncStorage permissions

## Future Plans

- Cloud backup with Firebase
- Better OCR for document scanning
- Doctor collaboration features
- Appointment reminders
- Insurance information storage
