import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, setDoc, getDoc, updateDoc, getDocs, collection, query, where, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

export async function registerUser({ email, password, name, restaurantName }) {
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  const user = credential.user

  await updateProfile(user, { displayName: name })

  // Create user doc
  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    email,
    name,
    role: 'admin',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  // Create restaurant
  const restaurantRef = doc(db, 'restaurants', user.uid)
  await setDoc(restaurantRef, {
    id: user.uid,
    name: restaurantName || 'Mi Restaurante',
    ownerId: user.uid,
    members: {
      [user.uid]: { role: 'admin', joinedAt: serverTimestamp() },
    },
    settings: {
      showCosts: true,
      currency: 'USD',
      theme: 'day',
      language: 'es',
    },
    subscription: {
      plan: 'starter',
      status: 'active',
      billing: 'monthly',
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return user
}

export async function loginUser({ email, password }) {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

export async function logoutUser() {
  await signOut(auth)
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email)
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  if (snap.exists()) return { id: snap.id, ...snap.data() }
  return null
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback)
}

export async function setMasterRole(uid) {
  await updateDoc(doc(db, 'users', uid), {
    role: 'master',
    updatedAt: serverTimestamp(),
  })
}

export async function migrateChefToUsuario() {
  const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'chef')))
  await Promise.all(
    snap.docs.map((d) =>
      updateDoc(doc(db, 'users', d.id), { role: 'usuario', updatedAt: serverTimestamp() })
    )
  )
  return snap.size
}

export function mapFirebaseError(code) {
  const map = {
    'auth/invalid-email': 'auth.errors.invalidEmail',
    'auth/weak-password': 'auth.errors.weakPassword',
    'auth/email-already-in-use': 'auth.errors.emailInUse',
    'auth/user-not-found': 'auth.errors.userNotFound',
    'auth/wrong-password': 'auth.errors.wrongPassword',
    'auth/invalid-credential': 'auth.errors.wrongPassword',
    'auth/too-many-requests': 'auth.errors.tooManyRequests',
    'auth/user-disabled': 'auth.errors.generic',
    'auth/network-request-failed': 'auth.errors.networkError',
  }
  return map[code] || 'auth.errors.generic'
}
