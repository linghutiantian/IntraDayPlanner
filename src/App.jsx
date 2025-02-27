import { useState, useEffect } from 'react';
import IntraDayPlanner from './components/IntraDayPlanner'
import PWAInstaller from './components/PWAInstaller'

function App() {
  const [isDark, setIsDark] = useState(() => {
    const savedDarkMode = localStorage.getItem('dayPlannerDarkMode');
    return savedDarkMode ? savedDarkMode === 'true' : false;
  });

  useEffect(() => {
    localStorage.setItem('dayPlannerDarkMode', isDark);
    document.documentElement.style.backgroundColor = isDark ? 'black' : 'white';
  }, [isDark]);
  useEffect(() => {
    // Debug PWA installation status
    const debugPWA = () => {
      console.log('PWA Debug Info:');
      
      // Check if running in standalone mode (installed)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      console.log('Running in standalone mode:', isStandalone);
      
      // Check service worker support
      console.log('Service Worker supported:', 'serviceWorker' in navigator);
      
      // Check manifest
      const manifestLink = document.querySelector('link[rel="manifest"]');
      console.log('Manifest found:', !!manifestLink, manifestLink ? manifestLink.href : '');
      
      // List installed service workers
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          console.log('Service Worker registrations:', registrations.length);
          registrations.forEach((registration, idx) => {
            console.log(`SW ${idx + 1}:`, registration.scope);
          });
        });
      }
    };
    
    // Run debug after a short delay to ensure everything is loaded
    setTimeout(debugPWA, 1000);
  }, []);
  return (
    <>
      <PWAInstaller />
      <div className={`min-h-screen ${isDark ? 'bg-black' : 'bg-gray-50'} py-8`}>
        <IntraDayPlanner isDark={isDark} setIsDark={setIsDark} />
      </div >
    </>
  )
}

export default App