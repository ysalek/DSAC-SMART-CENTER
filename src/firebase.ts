import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAPlQOfTkAYtJ0RePwhY7um1f8i4qnb6SI",
  authDomain: "chat-inteligente-fdeb8.firebaseapp.com",
  projectId: "chat-inteligente-fdeb8",
  storageBucket: "chat-inteligente-fdeb8.firebasestorage.app",
  messagingSenderId: "705567753072",
  appId: "1:705567753072:web:57cafa046b681f20be45b5"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);