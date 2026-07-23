import { RecordsProvider } from '@/context/RecordsContext';
import TabLayout from './(tabs)/_layout';
import SplashScreen from '@/screens/SplashScreen';
import { useState, useEffect } from 'react';

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);

    return () => clearTimeout(timer);
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
