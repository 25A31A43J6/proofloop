import { createRoot } from 'react-dom/client';
import App from './App.js';
import { ThemeProvider } from './context/ThemeContext.js';
import { VoiceProvider } from './context/VoiceContext.js';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <VoiceProvider>
      <App />
    </VoiceProvider>
  </ThemeProvider>
);

