import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

export async function getNextSupplierCode(restaurantId) {
  try {
    const snap = await getDocs(collection(db, 'restaurants', restaurantId, 'suppliers'))
    const nums = snap.docs
      .map((d) => d.data().code || '')
      .filter((c) => /^PRV\d+$/.test(c))
      .map((c) => parseInt(c.replace('PRV', ''), 10))
    const next = nums.length ? Math.max(...nums) + 1 : 1
    return `PRV${String(next).padStart(3, '0')}`
  } catch {
    return `PRV${Date.now().toString().slice(-3)}`
  }
}

export function subscribeSuppliers(restaurantId, callback) {
  return onSnapshot(
    query(collection(db, 'restaurants', restaurantId, 'suppliers'), orderBy('code', 'asc')),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  )
}

export async function createSupplier(restaurantId, data) {
  return addDoc(collection(db, 'restaurants', restaurantId, 'suppliers'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateSupplier(restaurantId, supplierId, data) {
  return updateDoc(doc(db, 'restaurants', restaurantId, 'suppliers', supplierId), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteSupplier(restaurantId, supplierId) {
  return deleteDoc(doc(db, 'restaurants', restaurantId, 'suppliers', supplierId))
}
