import { useState, useEffect } from 'react';
import IntraDayPlanner from './components/IntraDayPlanner'

function App() {
  const [isDark, setIsDark] = useState(() => {
    const savedDarkMode = localStorage.getItem('dayPlannerDarkMode');
    return savedDarkMode ? savedDarkMode === 'true' : false;
  });

  useEffect(() => {
    localStorage.setItem('dayPlannerDarkMode', isDark);
    document.documentElement.style.backgroundColor = isDark ? 'black' : 'white';
  }, [isDark]);
  return (
    <div className={`min-h-screen ${isDark ? 'bg-black' : 'bg-gray-50'} py-8`}>
      <IntraDayPlanner isDark={isDark} setIsDark={setIsDark} />
    </div >
  )
}

export default App