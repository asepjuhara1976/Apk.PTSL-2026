import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ApplicantProvider } from './context/ApplicantContext.tsx';

// Register Service Worker for PWA installability
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('ServiceWorker registration successful with scope: ', reg.scope);
      })
      .catch((err) => {
        console.log('ServiceWorker registration failed: ', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApplicantProvider>
      <App />
    </ApplicantProvider>
  </StrictMode>,
);
