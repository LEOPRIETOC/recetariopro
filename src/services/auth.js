import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  signInWithPopup,
} from 'firebase/auth'
import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { doc, setDoc, getDoc, updateDoc, getDocs, collection, query, where, serverTimestamp } from 'firebase/firestore'
import { auth, db, default as firebaseApp } from '../lib/firebase'

// ── Secondary app to create users without signing out the current admin ────────
function getSecondaryAuth() {
  try { return getAuth(getApp('secondary')) }
  catch { return getAuth(initializeApp(firebaseApp.options, 'secondary')) }
}

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

// ── Create user without signing out current admin ─────────────────────────────
export async function createUserWithRole(userData, creatorUid) {
  const secondaryAuth = getSecondaryAuth()
  const { user } = await createUserWithEmailAndPassword(secondaryAuth, userData.email, userData.password)
  await signOut(secondaryAuth) // sign out from secondary immediately

  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    name: userData.name,
    email: userData.email,
    role: userData.role,
    restaurantIds: userData.restaurantIds || [],
    createdBy: creatorUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    active: true,
  })

  await Promise.all((userData.restaurantIds || []).map((restId) =>
    updateDoc(doc(db, 'restaurants', restId), {
      [`members.${user.uid}`]: { role: userData.role, joinedAt: serverTimestamp() },
    })
  ))

  return user
}

export async function updateUserRole(uid, newRole, restaurantIds) {
  await updateDoc(doc(db, 'users', uid), { role: newRole, updatedAt: serverTimestamp() })
  await Promise.all((restaurantIds || []).map((restId) =>
    updateDoc(doc(db, 'restaurants', restId), {
      [`members.${uid}.role`]: newRole,
    })
  ))
}

export async function deactivateUser(uid, active) {
  await updateDoc(doc(db, 'users', uid), { active, updatedAt: serverTimestamp() })
}

export async function sendUserPasswordReset(email) {
  await sendPasswordResetEmail(auth, email)
}

export async function signInWithSocialProvider(provider) {
  const credential = await signInWithPopup(auth, provider)
  const user = credential.user

  // Create user doc only if new (no existing Firestore record)
  const userRef = doc(db, 'users', user.uid)
  const snap = await getDoc(userRef)
  if (!snap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      name: user.displayName || '',
      role: 'usuario',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  return user
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
