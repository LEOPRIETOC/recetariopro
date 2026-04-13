import { initializeApp } from 'firebase/app'
import { getAuth, setPersistence, browserSessionPersistence, GoogleAuthProvider, OAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDU11FxZaSGlnos4fUx8o9UffHBn-WArqg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "inom-recetas.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "inom-recetas",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "inom-recetas.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "631742948478",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:631742948478:web:e1b3606bcfeede25f4242f",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-L19NTSVWJE"
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)

// SESSION persistence: al cerrar pestaña/navegador la sesión se elimina automáticamente
setPersistence(auth, browserSessionPersistence)

export const db = getFirestore(app)
export const storage = getStorage(app, 'gs://inom-recetas.firebasestorage.app')

export const googleProvider = new GoogleAuthProvider()
googleProvider.addScope('email')
googleProvider.addScope('profile')

export const appleProvider = new OAuthProvider('apple.com')
appleProvider.addScope('email')
appleProvider.addScope('name')

export default app
