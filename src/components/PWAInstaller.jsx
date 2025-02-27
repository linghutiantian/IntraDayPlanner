import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

function PWAInstaller() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  
  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }

    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      // Stash the event so it can be triggered later
      setInstallPrompt(e)
      setIsInstallable(true)
    })

    // Register the service worker
    const updateSW = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true)
      },
      onOfflineReady() {
        setOfflineReady(true)
        setTimeout(() => {
          setOfflineReady(false)
        }, 3000)
      }
    })
    
    // Network status detection
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setIsInstallable(false)
      console.log('PWA was installed')
    })
    
    return () => {
      updateSW && updateSW()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])
  
  const handleInstallClick = async () => {
    if (!installPrompt) return
    
    // Show the install prompt
    installPrompt.prompt()
    
    // Wait for the user to respond to the prompt
    const { outcome } = await installPrompt.userChoice
    console.log(`User response to the install prompt: ${outcome}`)
    
    // Clear the saved prompt since it can't be used again
    setInstallPrompt(null)
    setIsInstallable(false)
  }
  
  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }
  
  return (
    <>
      {/* Network status indicator */}
      {!isOnline && (
        <div className="network-status offline">
          You are currently offline. Some features may be unavailable.
        </div>
      )}
      
      {/* Install button */}
      {isInstallable && !isInstalled && (
        <div className="install-container">
          <button className="install-button" onClick={handleInstallClick}>
            Install App
          </button>
        </div>
      )}
      
      {/* PWA update/offline toast */}
      <div className="pwa-toast" style={{ display: (offlineReady || needRefresh) ? 'block' : 'none' }}>
        <div className="message">
          {offlineReady ? (
            <span>App ready to work offline! ✅</span>
          ) : (
            <span>New content available, click on reload button to update.</span>
          )}
        </div>
        {needRefresh && <button onClick={() => updateSW(true)}>Reload</button>}
        <button onClick={() => close()}>Close</button>
      </div>
    </>
  )
}

export default PWAInstaller