/**
 * @file main.tsx
 * @description Application entry point, initializes React, PWA, and FontAwesome.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import App from './App';
import './styles/App.css';
// Only register PWA service worker in production to avoid HMR interference
if (import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true });
  });
} else {
  // In dev, unregister any stale Service Workers to prevent caching issues
  navigator.serviceWorker?.getRegistrations().then(registrations => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}

import '@fortawesome/fontawesome-free/css/all.min.css';

import { ProcessingProvider } from './context/ProcessingContext';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <ProcessingProvider>
      <App />
    </ProcessingProvider>
  </React.StrictMode>
);
