import { initializeApp } from "firebase/app";
import { initializeFirestore, memoryLocalCache } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Configuración por defecto o variables de entorno si estuvieran disponibles
const firebaseConfig = {
  apiKey: "AIzaSyAPlQOfTkAYtJ0RePwhY7um1f8i4qnb6SI",
  authDomain: "chat-inteligente-fdeb8.firebaseapp.com",
  projectId: "chat-inteligente-fdeb8",
  storageBucket: "chat-inteligente-fdeb8.firebasestorage.app",
  messagingSenderId: "705567753072",
  appId: "1:705567753072:web:57cafa046b681f20be45b5"
};

const app = initializeApp(firebaseConfig);

// Optimización: Usar caché en memoria para reducir costos de lectura y mejorar velocidad
// Esto evita volver a descargar documentos que no han cambiado en la sesión actual.
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache()
});

export const auth = getAuth(app);
export const storage = getStorage(app);