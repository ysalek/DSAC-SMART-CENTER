import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// --- SERVICE WORKER KILLER ---
// Esta sección detecta si hay un Service Worker activo (el "Zombie")
// y lo fuerza a des-registrarse. Esto soluciona el error "Failed to fetch"
// causado por cachés corruptas de versiones anteriores.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        console.log('MATANDO SERVICE WORKER ZOMBIE:', registration);
        registration.unregister()
          .then(() => console.log('SW eliminado correctamente. Recarga la página si persisten errores.'))
          .catch(err => console.warn('Error al eliminar SW:', err));
      }
    }).catch(err => {
      // Ignoramos errores de contexto inseguro o iframes restringidos
      console.warn('No se pudo acceder al registro de SW (esperado en algunos entornos de dev):', err);
    });
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("No se encontró el elemento root");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);