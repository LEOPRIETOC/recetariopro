import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  signInWithPopup,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth'
import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { doc, setDoc, getDoc, updateDoc, getDocs, collection, query, where, serverTimestamp } from 'firebase/firestore'
import { auth, db, default as firebaseApp } from '../lib/firebase'

// ── Password policy ────────────────────────────────────────────────────────────
// Mínimo 8 chars + 1 mayús + 1 minús + 1 número + 1 especial
export const PASSWORD_POLICY = {
  minLength: 8,
  message: 'Mínimo 8 caracteres con mayúscula, minúscula, número y carácter especial.',
}

export function validateStrongPassword(pwd) {
  if (!pwd || pwd.length < PASSWORD_POLICY.minLength) return false
  if (!/[a-z]/.test(pwd)) return false
  if (!/[A-Z]/.test(pwd)) return false
  if (!/\d/.test(pwd)) return false
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(pwd)) return false
  return true
}

export function generateTempPassword(length = 12) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnpqrstuvwxyz'
  const digits = '23456789'
  const special = '!@#$%&*?'
  const all = upper + lower + digits + special
  const pick = (set) => set[Math.floor(Math.random() * set.length)]
  const chars = [pick(upper), pick(lower), pick(digits), pick(special)]
  for (let i = chars.length; i < length; i++) chars.push(pick(all))
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

// ── Secondary app to create users without signing out the current admin ────────
function getSecondaryAuth() {
  try { return getAuth(getApp('secondary')) }
  catch { return getAuth(initializeApp(firebaseApp.options, 'secondary')) }
}

export async function registerUser({ email, password, name }) {
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  const user = credential.user

  await updateProfile(user, { displayName: name })

  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    email,
    name,
    role: 'usuario',
    restaurantIds: [],
    active: true,
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
  if (!validateStrongPassword(userData.password)) {
    throw new Error(PASSWORD_POLICY.message)
  }
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
    mustChangePassword: true,
  })

  await Promise.all((userData.restaurantIds || []).map((restId) =>
    updateDoc(doc(db, 'restaurants', restId), {
      [`members.${user.uid}`]: { role: userData.role, joinedAt: serverTimestamp() },
    })
  ))

  return user
}

// ── User changes own password (requires current password) ─────────────────────
export async function changeUserPassword(currentPassword, newPassword) {
  if (!validateStrongPassword(newPassword)) {
    throw new Error(PASSWORD_POLICY.message)
  }
  const current = auth.currentUser
  if (!current?.email) throw new Error('No hay sesión activa')

  const credential = EmailAuthProvider.credential(current.email, currentPassword)
  await reauthenticateWithCredential(current, credential)
  await updatePassword(current, newPassword)

  await updateDoc(doc(db, 'users', current.uid), {
    mustChangePassword: false,
    passwordChangedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
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
  let isNew = false
  if (!snap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      name: user.displayName || '',
      role: 'usuario',
      restaurantIds: [],
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    isNew = true
  }

  return { user, isNew }
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
