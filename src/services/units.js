import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, getDocs,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

export function subscribeUnits(restaurantId, callback) {
  const q = query(
    collection(db, 'restaurants', restaurantId, 'units'),
    orderBy('name', 'asc')
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function createUnit(restaurantId, data) {
  return addDoc(collection(db, 'restaurants', restaurantId, 'units'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateUnit(restaurantId, unitId, data) {
  return updateDoc(doc(db, 'restaurants', restaurantId, 'units', unitId), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteUnit(restaurantId, unitId) {
  return deleteDoc(doc(db, 'restaurants', restaurantId, 'units', unitId))
}

export async function getNextUnitCode(restaurantId) {
  const snap = await getDocs(collection(db, 'restaurants', restaurantId, 'units'))
  const nums = snap.docs
    .map((d) => d.data().code || '')
    .filter((c) => /^UND\d+$/.test(c))
    .map((c) => parseInt(c.replace('UND', ''), 10))
  const next = nums.length ? Math.max(...nums) + 1 : 1
  return `UND${String(next).padStart(3, '0')}`
}

// Default units to seed on first use
export const DEFAULT_UNITS = [
  { name: 'Kilogramo', abbreviation: 'kg', type: 'Peso' },
  { name: 'Gramo', abbreviation: 'g', type: 'Peso' },
  { name: 'Litro', abbreviation: 'lt', type: 'Volumen' },
  { name: 'Mililitro', abbreviation: 'ml', type: 'Volumen' },
  { name: 'Unidad', abbreviation: 'und', type: 'Unidad' },
  { name: 'Porción', abbreviation: 'prc', type: 'Unidad' },
  { name: 'Taza', abbreviation: 'tz', type: 'Volumen' },
  { name: 'Cucharada', abbreviation: 'cda', type: 'Volumen' },
  { name: 'Cucharadita', abbreviation: 'cdta', type: 'Volumen' },
]
