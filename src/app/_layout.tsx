import { RecordsProvider } from '@/context/RecordsContext';
import TabLayout from './(tabs)/_layout';
import SplashScreen from '@/screens/SplashScreen';
import { useState, useEffect } from 'react';
import { ehrService } from '@/services/ehrService';

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      // Initialize Epic service with stored access token
      try {
        await ehrService.load();
      } catch (error) {
        console.error('Error initializing Epic service:', error);
      }

      const timer = setTimeout(() => {
        setShowSplash(false);
      }, 3000);

      return () => clearTimeout(timer);
    };

    initializeApp();
  }, []);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <RecordsProvider>
      <TabLayout />
    </RecordsProvider>
  );
}
