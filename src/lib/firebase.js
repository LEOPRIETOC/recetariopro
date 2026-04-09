import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDU11FxZaSGlnos4fUx8o9UffHBn-WArqg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "inom-recetas.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "inom-recetas",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "inom-recetas.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "631742948478",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:631742948478:web:e1b3606bcfeede25f4242f",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-L19NTSVWJE"
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export default app
