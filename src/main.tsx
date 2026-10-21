import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { warmEngineCache } from './engine';
import './styles/global.css';

void warmEngineCache();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
