import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Clean up old localStorage entry that caused QuotaExceededError
try { localStorage.removeItem('canvas-pm-v2'); localStorage.removeItem('chaos-pm-v1'); } catch {}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
