import { StrictMode} from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

import React from 'react'
import ReactDOM from 'react-dom/client'

// Log service worker registration status
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    console.log('Service Worker support is available in this browser.')
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
