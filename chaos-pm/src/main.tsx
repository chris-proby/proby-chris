import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { runMigrations } from './migrate';

function mount() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// Run migrations before rendering so Zustand hydrates with correct data
runMigrations().then(mount).catch(mount);
