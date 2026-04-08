import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyDU11FxZaSGlnos4fUx8o9UffHBn-WArqg",
  authDomain: "inom-recetas.firebaseapp.com",
  projectId: "inom-recetas",
  storageBucket: "inom-recetas.appspot.com",
  messagingSenderId: "631742948478",
  appId: "1:631742948478:web:e1b3606bcfeede25f4242f",
  measurementId: "G-L19NTSVWJE"
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export default app
