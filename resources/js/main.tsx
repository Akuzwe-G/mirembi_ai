import { createRoot } from 'react-dom/client';
import App from './App';
import { registerPwa } from './pwa';

const element = document.getElementById('app');
if (element) createRoot(element).render(<App />);
registerPwa();
