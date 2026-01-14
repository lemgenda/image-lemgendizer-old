/**
 * @file main.tsx
 * @description Application entry point, initializes React, PWA, and FontAwesome.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import App from './App';
import './styles/App.css';
import { registerSW } from 'virtual:pwa-register';

// Register PWA service worker
registerSW({ immediate: true });

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
