import {
  collection, addDoc, serverTimestamp,
  query, orderBy, limit, getDocs, where,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

/**
 * Registrar una acción en el historial de auditoría.
 * Falla silenciosamente para no bloquear el flujo principal.
 */
export async function logAction({
  restaurantId,
  userId,
  userName,
  userRole,
  action,       // 'create' | 'edit' | 'delete'
  module,       // 'recipe' | 'subrecipe' | 'materia' | 'menu' | 'user' | 'category' | 'unit' | 'supplier'
  entityId = null,
  entityName = null,
  entityCode = null,
  changes = [],
}) {
  if (!restaurantId) return
  const payload = {
    action,
    module,
    entityId,
    entityName,
    entityCode: entityCode || null,
    userId: userId || null,
    userName: userName || 'Desconocido',
    userRole: userRole || null,
    changes,
    timestamp: serverTimestamp(),
  }
  console.log('[audit] logAction →', module, action, entityName, '| restaurantId:', restaurantId)
  try {
    const ref = await addDoc(
      collection(db, 'restaurants', restaurantId, 'audit_logs'),
      payload
    )
    console.log('[audit] Log guardado con ID:', ref.id)
  } catch (err) {
    console.error('[audit] Error guardando log:', err)
  }
}

/**
 * Comparar dos objetos y retornar los campos que cambiaron.
 * @param {object} before
 * @param {object} after
 * @param {string[]} fields - lista de campos a comparar
 */
export function detectChanges(before, after, fields) {
  const changes = []
  fields.forEach((field) => {
    const bVal = before?.[field]
    const aVal = after?.[field]
    if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
      changes.push({ field, before: bVal ?? null, after: aVal ?? null })
    }
  })
  return changes
}

/**
 * Detectar diferencias en la lista de ingredientes de una receta.
 */
export function detectIngredientChanges(before = [], after = []) {
  const changes = []

  // Eliminados
  before.forEach((ing) => {
    const found = after.find(
      (a) => a.reference === ing.reference || a.ingredientName === ing.ingredientName
    )
    if (!found) {
      changes.push({
        field: 'ingrediente',
        action: 'removed',
        item: `${ing.ingredientName || ing.description} ${ing.quantity}${ing.unit}`,
      })
    }
  })

  // Agregados
  after.forEach((ing) => {
    const found = before.find(
      (b) => b.reference === ing.reference || b.ingredientName === ing.ingredientName
    )
    if (!found) {
      changes.push({
        field: 'ingrediente',
        action: 'added',
        item: `${ing.ingredientName || ing.description} ${ing.quantity}${ing.unit}`,
      })
    }
  })

  // Cantidad modificada
  after.forEach((ing) => {
    const prev = before.find(
      (b) => b.reference === ing.reference || b.ingredientName === ing.ingredientName
    )
    if (prev && prev.quantity !== ing.quantity) {
      changes.push({
        field: 'cantidad',
        item: ing.ingredientName || ing.description,
        before: `${prev.quantity}${prev.unit}`,
        after: `${ing.quantity}${ing.unit}`,
      })
    }
    if (prev && prev.wasteMargin !== ing.wasteMargin) {
      changes.push({
        field: 'desperdicio',
        item: ing.ingredientName || ing.description,
        before: `${prev.wasteMargin}%`,
        after: `${ing.wasteMargin}%`,
      })
    }
  })

  return changes
}

/**
 * Cargar logs de auditoría.
 * @param {string} restaurantId
 * @param {string|null} module - filtrar por módulo (null = todos)
 * @param {number} limitN
 */
export async function getAuditLogs(restaurantId, module = null, limitN = 100) {
  if (!restaurantId) return []
  console.log('[audit] getAuditLogs → restaurantId:', restaurantId, '| module:', module)
  try {
    // Intentar query con filtro por módulo (requiere índice compuesto)
    if (module) {
      try {
        const q = query(
          collection(db, 'restaurants', restaurantId, 'audit_logs'),
          where('module', '==', module),
          orderBy('timestamp', 'desc'),
          limit(limitN)
        )
        const snap = await getDocs(q)
        console.log('[audit] Logs cargados (filtrado):', snap.size)
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      } catch (indexErr) {
        // Índice compuesto no existe aún — fallback: traer todos y filtrar en cliente
        console.warn('[audit] Índice no disponible, usando fallback sin filtro:', indexErr.message)
        const qAll = query(
          collection(db, 'restaurants', restaurantId, 'audit_logs'),
          orderBy('timestamp', 'desc'),
          limit(500)
        )
        const snap = await getDocs(qAll)
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        const filtered = all.filter((d) => d.module === module).slice(0, limitN)
        console.log('[audit] Logs tras filtro cliente:', filtered.length)
        return filtered
      }
    } else {
      const q = query(
        collection(db, 'restaurants', restaurantId, 'audit_logs'),
        orderBy('timestamp', 'desc'),
        limit(limitN)
      )
      const snap = await getDocs(q)
      console.log('[audit] Logs cargados (todos):', snap.size)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    }
  } catch (err) {
    console.error('[audit] Error cargando logs:', err)
    return []
  }
}
