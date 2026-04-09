// src/firebase.js

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// 👉 CONFIGURATION FIREBASE (tu la récupères dans Firebase console)
const firebaseConfig = {
  apiKey: "AIzaSyD3RzlcTrIEbokr7wMJs_IFMYZ0iDmq8tM",
  authDomain: "sharemusic-68b1d.firebaseapp.com",
  projectId: "sharemusic-68b1d",
  storageBucket: "sharemusic-68b1d.firebasestorage.app",
  messagingSenderId: "279492765028",
  appId: "1:279492765028:web:700ee197269ebcc0c68671",
  measurementId: "G-1JLY86QXMK"
};

// 🔧 Initialisation de l'app Firebase
const app = initializeApp(firebaseConfig);

// 🗄️ Base de données Firestore
export const db = getFirestore(app);

export default app;

