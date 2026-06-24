import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ApplicantProvider } from './context/ApplicantContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApplicantProvider>
      <App />
    </ApplicantProvider>
  </StrictMode>,
);
