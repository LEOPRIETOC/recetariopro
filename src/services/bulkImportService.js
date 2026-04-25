import * as XLSX from 'xlsx'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import {
  importMenus, importSuppliers, importUnits,
  importMaterias, importSubrecipes, importRecipes,
} from './importService'

// ── Sheet name aliases ────────────────────────────────────────────────────────

const SHEET_ALIASES = {
  UNIDADES: 'unidades', MEDIDAS: 'unidades', UNITS: 'unidades',
  MENUS: 'menus', 'MENÚS': 'menus', MENUES: 'menus',
  CATEGORIAS: 'menus', 'CATEGORÍAS': 'menus',
  PROVEEDORES: 'proveedores', SUPPLIERS: 'proveedores',
  MATERIAS_PRIMAS: 'materias', 'MATERIAS PRIMAS': 'materias',
  MATERIAS: 'materias', INGREDIENTES: 'materias',
  SUB_RECETAS: 'subrecetas', 'SUB RECETAS': 'subrecetas',
  SUBRECETAS: 'subrecetas', 'SUB-RECETAS': 'subrecetas',
  RECETAS: 'recetas', RECIPES: 'recetas',
}

function normalizeSheet(name) {
  return SHEET_ALIASES[name.toUpperCase().trim().replace(/\s+/g, ' ')] || null
}

// ── Parse workbook ────────────────────────────────────────────────────────────

export function parseWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const sheets = {}
        const found = []
        const unknown = []
        for (const name of wb.SheetNames) {
          const canonical = normalizeSheet(name)
          if (canonical) {
            sheets[canonical] = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' })
            found.push(name)
          } else {
            unknown.push(name)
          }
        }
        resolve({ sheets, found, unknown })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// ── Load Firestore reference sets ─────────────────────────────────────────────

async function loadFirestoreRefs(restaurantId) {
  const [unitsSnap, catsSnap, supSnap, mpSnap, subSnap] = await Promise.all([
    getDocs(collection(db, 'restaurants', restaurantId, 'units')),
    getDocs(collection(db, 'restaurants', restaurantId, 'categories')),
    getDocs(collection(db, 'restaurants', restaurantId, 'suppliers')),
    getDocs(collection(db, 'restaurants', restaurantId, 'materias_primas')),
    getDocs(query(
      collection(db, 'restaurants', restaurantId, 'recipes'),
      where('type', '==', 'subrecipe'),
    )),
  ])
  return {
    units:     new Set(unitsSnap.docs.map(d => (d.data().abbreviation || '').toUpperCase().trim()).filter(Boolean)),
    menus:     new Set(catsSnap.docs.map(d => (d.data().code || '').toUpperCase().trim()).filter(Boolean)),
    suppliers: new Set(supSnap.docs.map(d => (d.data().code || '').toUpperCase().trim()).filter(Boolean)),
    materias:  new Set(mpSnap.docs.map(d => (d.data().reference || '').toUpperCase().trim()).filter(Boolean)),
    subrecetas:new Set(subSnap.docs.map(d => (d.data().reference || '').toUpperCase().trim()).filter(Boolean)),
  }
}

function buildExcelSets(sheets) {
  const units = new Set()
  ;(sheets.unidades || []).forEach(r => {
    const v = r.MEDIDA?.toString().trim().toUpperCase(); if (v) units.add(v)
  })
  const menus = new Set()
  ;(sheets.menus || []).forEach(r => {
    const v = r.CODIGO_MENU?.toString().trim().toUpperCase(); if (v) menus.add(v)
  })
  const suppliers = new Set()
  ;(sheets.proveedores || []).forEach(r => {
    const v = r.CODIGO_PROVEEDOR?.toString().trim().toUpperCase(); if (v) suppliers.add(v)
  })
  const materias = new Set()
  ;(sheets.materias || []).forEach(r => {
    const v = r.REFERENCIA?.toString().trim().toUpperCase(); if (v) materias.add(v)
  })
  const subrecetas = new Set()
  ;(sheets.subrecetas || []).forEach(r => {
    const v = r.REFERENCIA?.toString().trim().toUpperCase(); if (v) subrecetas.add(v)
  })
  return { units, menus, suppliers, materias, subrecetas }
}

// ── Validation engine ─────────────────────────────────────────────────────────

export async function validateSheets(sheets, restaurantId) {
  const fs = await loadFirestoreRefs(restaurantId)
  const ex = buildExcelSets(sheets)

  const allUnits     = new Set([...fs.units,      ...ex.units])
  const allMenus     = new Set([...fs.menus,      ...ex.menus])
  const allSuppliers = new Set([...fs.suppliers,  ...ex.suppliers])
  const allMaterias  = new Set([...fs.materias,   ...ex.materias])
  const allSubs      = new Set([...fs.subrecetas, ...ex.subrecetas])
  const allIngred    = new Set([...allMaterias,   ...allSubs])

  const r = {
    sheets: {
      unidades:    { found: !!sheets.unidades,    rows: sheets.unidades?.length    || 0, errors: [], warnings: [] },
      menus:       { found: !!sheets.menus,        rows: sheets.menus?.length        || 0, errors: [], warnings: [] },
      proveedores: { found: !!sheets.proveedores,  rows: sheets.proveedores?.length  || 0, errors: [], warnings: [] },
      materias:    { found: !!sheets.materias,     rows: sheets.materias?.length     || 0, errors: [], warnings: [] },
      subrecetas:  { found: !!sheets.subrecetas,   rows: sheets.subrecetas?.length   || 0, errors: [], warnings: [] },
      recetas:     { found: !!sheets.recetas,      rows: sheets.recetas?.length      || 0, errors: [], warnings: [] },
    },
  }

  const err  = (key, obj) => r.sheets[key].errors.push(obj)
  const warn = (key, obj) => r.sheets[key].warnings.push(obj)

  // UNIDADES
  ;(sheets.unidades || []).forEach((row, i) => {
    const n = i + 2
    if (!row.CODIGO?.toString().trim())      err('unidades', { row: n, field: 'CODIGO',       message: 'CODIGO es requerido' })
    if (!row.MEDIDA?.toString().trim())      err('unidades', { row: n, field: 'MEDIDA',       message: 'MEDIDA es requerida' })
    if (!row.DESCRIPCION?.toString().trim()) err('unidades', { row: n, field: 'DESCRIPCION',  message: 'DESCRIPCION es requerida' })
    const eq = parseFloat(String(row.EQUIVALENCIA || '').replace(',', '.'))
    if (isNaN(eq)) err('unidades', { row: n, field: 'EQUIVALENCIA', message: `"${row.EQUIVALENCIA}" no es un número válido` })
  })

  // MENUS
  ;(sheets.menus || []).forEach((row, i) => {
    const n = i + 2
    if (!row.CODIGO_MENU?.toString().trim())  err('menus', { row: n, field: 'CODIGO_MENU',  message: 'CODIGO_MENU es requerido' })
    if (!row.NOMBRE_MENU?.toString().trim())  err('menus', { row: n, field: 'NOMBRE_MENU',  message: 'NOMBRE_MENU es requerido' })
  })

  // PROVEEDORES
  ;(sheets.proveedores || []).forEach((row, i) => {
    const n = i + 2
    if (!row.CODIGO_PROVEEDOR?.toString().trim())  err('proveedores', { row: n, field: 'CODIGO_PROVEEDOR',  message: 'CODIGO_PROVEEDOR es requerido' })
    if (!row.NOMBRE_PROVEEDOR?.toString().trim())  err('proveedores', { row: n, field: 'NOMBRE_PROVEEDOR',  message: 'NOMBRE_PROVEEDOR es requerido' })
  })

  // MATERIAS_PRIMAS
  ;(sheets.materias || []).forEach((row, i) => {
    const n = i + 2
    if (!row.REFERENCIA?.toString().trim()) { err('materias', { row: n, field: 'REFERENCIA', message: 'REFERENCIA es requerida' }); return }
    if (!row.NOMBRE?.toString().trim())      err('materias', { row: n, field: 'NOMBRE',      message: 'NOMBRE es requerido' })

    const useUnit = row.UNIDAD_USO?.toString().trim().toUpperCase()
    if (!useUnit) {
      err('materias', { row: n, field: 'UNIDAD_USO', value: '', message: 'UNIDAD_USO es requerida', fix: 'Agrega la unidad en la hoja UNIDADES' })
    } else if (!allUnits.has(useUnit)) {
      err('materias', { row: n, field: 'UNIDAD_USO', value: useUnit, message: `Unidad "${useUnit}" no existe`, fix: `Agrega "${useUnit}" en la hoja UNIDADES (columna MEDIDA)` })
    }

    const purUnit = row.UNIDAD_COMPRA?.toString().trim().toUpperCase()
    if (purUnit && !allUnits.has(purUnit)) {
      warn('materias', { row: n, field: 'UNIDAD_COMPRA', value: purUnit, message: `Unidad de compra "${purUnit}" no existe`, fix: `Agrega "${purUnit}" en la hoja UNIDADES` })
    }

    const supCode = row.CODIGO_PROVEEDOR?.toString().trim().toUpperCase()
    if (supCode && !allSuppliers.has(supCode)) {
      warn('materias', { row: n, field: 'CODIGO_PROVEEDOR', value: supCode, message: `Proveedor "${supCode}" no existe`, fix: `Agrega "${supCode}" en la hoja PROVEEDORES` })
    }

    if (!row.COSTO?.toString().trim())             warn('materias', { row: n, field: 'COSTO',             message: 'COSTO vacío → se importará en 0' })
    if (!row.CANT_PRESENTACION?.toString().trim())  warn('materias', { row: n, field: 'CANT_PRESENTACION', message: 'CANT_PRESENTACION vacío → se usará 1' })
  })

  // SUB_RECETAS — agrupar por REFERENCIA
  const subGroups = {}; const subOrder = []
  ;(sheets.subrecetas || []).forEach(row => {
    const ref = row.REFERENCIA?.toString().trim(); if (!ref) return
    if (!subGroups[ref]) { subGroups[ref] = { header: row, ingredients: [] }; subOrder.push(ref) }
    if (row.REFERENCIA_MP?.toString().trim()) subGroups[ref].ingredients.push(row)
  })
  subOrder.forEach(ref => {
    const { header: h, ingredients } = subGroups[ref]
    if (!h.NOMBRE_RECETA?.toString().trim()) err('subrecetas', { field: 'NOMBRE_RECETA', message: `Ref ${ref}: NOMBRE_RECETA es requerido` })
    const yAmt = parseFloat(String(h.RENDIMIENTO || '0').replace(',', '.'))
    if (!yAmt || yAmt <= 0) err('subrecetas', { field: 'RENDIMIENTO', message: `Ref ${ref}: RENDIMIENTO debe ser mayor a 0` })
    const yUnit = h.UNIDAD_RENDIMIENTO?.toString().trim().toUpperCase()
    if (!yUnit) {
      err('subrecetas', { field: 'UNIDAD_RENDIMIENTO', message: `Ref ${ref}: UNIDAD_RENDIMIENTO es requerida`, fix: 'Agrega la unidad en la hoja UNIDADES' })
    } else if (!allUnits.has(yUnit)) {
      err('subrecetas', { field: 'UNIDAD_RENDIMIENTO', value: yUnit, message: `Ref ${ref}: Unidad "${yUnit}" no existe`, fix: `Agrega "${yUnit}" en la hoja UNIDADES (columna MEDIDA)` })
    }
    ingredients.forEach(ing => {
      const u = ing.UNIDAD?.toString().trim().toUpperCase()
      if (u && !allUnits.has(u))
        err('subrecetas', { field: 'UNIDAD', value: u, message: `Ref ${ref}: Unidad de ingrediente "${u}" no existe`, fix: `Agrega "${u}" en la hoja UNIDADES` })
      const iRef = ing.REFERENCIA_MP?.toString().trim().toUpperCase()
      if (iRef && !allIngred.has(iRef))
        warn('subrecetas', { field: 'REFERENCIA_MP', value: iRef, message: `Ref ${ref}: Ingrediente "${iRef}" no encontrado`, fix: `Agrégalo en MATERIAS_PRIMAS o importa primero esa hoja` })
    })
  })

  // RECETAS — agrupar por REFERENCIA
  const recGroups = {}; const recOrder = []
  ;(sheets.recetas || []).forEach(row => {
    const ref = row.REFERENCIA?.toString().trim(); if (!ref) return
    if (!recGroups[ref]) { recGroups[ref] = { header: row, ingredients: [] }; recOrder.push(ref) }
    if (row.REFERENCIA_MP?.toString().trim()) recGroups[ref].ingredients.push(row)
  })
  recOrder.forEach(ref => {
    const { header: h, ingredients } = recGroups[ref]
    if (!h.NOMBRE_RECETA?.toString().trim()) err('recetas', { field: 'NOMBRE_RECETA', message: `Ref ${ref}: NOMBRE_RECETA es requerido` })
    const mc = h.CODIGO_MENU?.toString().trim().toUpperCase()
    if (!mc) {
      err('recetas', { field: 'CODIGO_MENU', message: `Ref ${ref}: CODIGO_MENU es requerido`, fix: 'Agrega el menú en la hoja MENUS' })
    } else if (!allMenus.has(mc)) {
      err('recetas', { field: 'CODIGO_MENU', value: mc, message: `Ref ${ref}: Menú "${mc}" no existe`, fix: `Agrega "${mc}" en la hoja MENUS (columna CODIGO_MENU)` })
    }
    if (!h.PRECIO_VENTA?.toString().trim()) warn('recetas', { field: 'PRECIO_VENTA', message: `Ref ${ref}: PRECIO_VENTA vacío → se guardará en 0` })
    ingredients.forEach(ing => {
      const u = ing.UNIDAD?.toString().trim().toUpperCase()
      if (u && !allUnits.has(u))
        err('recetas', { field: 'UNIDAD', value: u, message: `Ref ${ref}: Unidad de ingrediente "${u}" no existe`, fix: `Agrega "${u}" en la hoja UNIDADES` })
      const iRef = ing.REFERENCIA_MP?.toString().trim().toUpperCase()
      if (iRef && !allIngred.has(iRef))
        warn('recetas', { field: 'REFERENCIA_MP', value: iRef, message: `Ref ${ref}: Ingrediente "${iRef}" no encontrado`, fix: `Agrégalo en MATERIAS_PRIMAS o en SUB_RECETAS` })
    })
  })

  const totalErrors   = Object.values(r.sheets).reduce((s, sh) => s + sh.errors.length,   0)
  const totalWarnings = Object.values(r.sheets).reduce((s, sh) => s + sh.warnings.length, 0)
  return { ...r, totalErrors, totalWarnings, canImport: totalErrors === 0 }
}

// ── Execute bulk import (in correct order) ────────────────────────────────────

export async function executeBulkImport(restaurantId, sheets, onProgress) {
  const STEPS = [
    { key: 'unidades',    label: 'Unidades',       fn: importUnits,      rows: sheets.unidades    || [] },
    { key: 'menus',       label: 'Menús',           fn: importMenus,      rows: sheets.menus       || [] },
    { key: 'proveedores', label: 'Proveedores',     fn: importSuppliers,  rows: sheets.proveedores || [] },
    { key: 'materias',    label: 'Materias Primas', fn: importMaterias,   rows: sheets.materias    || [] },
    { key: 'subrecetas',  label: 'Sub-recetas',     fn: importSubrecipes, rows: sheets.subrecetas  || [] },
    { key: 'recetas',     label: 'Recetas',         fn: importRecipes,    rows: sheets.recetas     || [] },
  ].filter(s => s.rows.length > 0)

  const results = {}
  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i]
    onProgress?.({ step: step.key, label: step.label, stepIndex: i, totalSteps: STEPS.length, pct: 0 })
    results[step.key] = await step.fn(restaurantId, step.rows, (pct) => {
      onProgress?.({ step: step.key, label: step.label, stepIndex: i, totalSteps: STEPS.length, pct })
    })
  }
  return results
}

// ── Master template generator ─────────────────────────────────────────────────

export function generateMasterTemplate() {
  const wb = XLSX.utils.book_new()

  const addSheet = (name, rows, colWidths) => {
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = colWidths.map(w => ({ wch: w }))
    XLSX.utils.book_append_sheet(wb, ws, name)
  }

  addSheet('UNIDADES', [
    { CODIGO: 'UN001', MEDIDA: 'G',   DESCRIPCION: 'Gramo',      EQUIVALENCIA: 1    },
    { CODIGO: 'UN002', MEDIDA: 'KG',  DESCRIPCION: 'Kilogramo',  EQUIVALENCIA: 1000 },
    { CODIGO: 'UN003', MEDIDA: 'ML',  DESCRIPCION: 'Mililitro',  EQUIVALENCIA: 1    },
    { CODIGO: 'UN004', MEDIDA: 'L',   DESCRIPCION: 'Litro',      EQUIVALENCIA: 1000 },
    { CODIGO: 'UN005', MEDIDA: 'UND', DESCRIPCION: 'Unidad',     EQUIVALENCIA: 1    },
    { CODIGO: 'UN006', MEDIDA: 'OZ',  DESCRIPCION: 'Onza',       EQUIVALENCIA: 28.35},
  ], [12, 10, 20, 14])

  addSheet('MENUS', [
    { CODIGO_MENU: 'BAR01', NOMBRE_MENU: 'Bebidas' },
    { CODIGO_MENU: 'ONI01', NOMBRE_MENU: 'Nigiris' },
  ], [16, 28])

  addSheet('PROVEEDORES', [
    { CODIGO_PROVEEDOR: 'PROV001', NOMBRE_PROVEEDOR: 'Proveedor Ejemplo', CONTACTO: 'Juan Pérez', CELULAR: '3001234567', DIRECCION: 'Calle 123 # 45-67' },
  ], [18, 28, 20, 14, 28])

  addSheet('MATERIAS_PRIMAS', [
    { REFERENCIA: 'MP1000001', NOMBRE: 'ARROZ SUSHI', UNIDAD_USO: 'G', UNIDAD_COMPRA: 'KG', CANT_PRESENTACION: 1, COSTO: 5000, CODIGO_PROVEEDOR: 'PROV001', PROVEEDOR: 'Proveedor Ejemplo', CATEGORIA: 'Granos'   },
    { REFERENCIA: 'MP1000002', NOMBRE: 'SALMON',      UNIDAD_USO: 'G', UNIDAD_COMPRA: 'KG', CANT_PRESENTACION: 1, COSTO: 35000,CODIGO_PROVEEDOR: 'PROV001', PROVEEDOR: 'Proveedor Ejemplo', CATEGORIA: 'Pescados' },
  ], [14, 24, 12, 14, 20, 10, 18, 24, 16])

  // SUB_RECETAS: primera fila = encabezado de receta, filas siguientes = ingredientes
  addSheet('SUB_RECETAS', [
    { REFERENCIA: 'ONISUB001', NOMBRE_RECETA: 'ARROZ PARA SUSHI', RENDIMIENTO: 1000, UNIDAD_RENDIMIENTO: 'G',  PREPARACION: 'Cocinar con vinagre de arroz', REFERENCIA_MP: 'MP1000001', NOMBRE_MP: 'ARROZ SUSHI', CANTIDAD: 900, UNIDAD: 'G',  DESPERDICIO: 0 },
    { REFERENCIA: 'ONISUB001', NOMBRE_RECETA: '',                  RENDIMIENTO: '',   UNIDAD_RENDIMIENTO: '',   PREPARACION: '',                             REFERENCIA_MP: 'MP1000002', NOMBRE_MP: 'SALMON',      CANTIDAD: 50,  UNIDAD: 'ML', DESPERDICIO: 5 },
  ], [14, 24, 12, 20, 34, 16, 22, 10, 8, 12])

  addSheet('RECETAS', [
    { REFERENCIA: 'ONIREC001', NOMBRE_RECETA: 'NIGIRI DE SALMON', CODIGO_MENU: 'ONI01', MENU: 'Nigiris', PRECIO_VENTA: 12000, PREPARACION: 'Formar nigiri', REFERENCIA_MP: 'ONISUB001', NOMBRE_MP: 'ARROZ PARA SUSHI', CANTIDAD: 80, UNIDAD: 'G',  DESPERDICIO: 0 },
    { REFERENCIA: 'ONIREC001', NOMBRE_RECETA: '',                  CODIGO_MENU: '',      MENU: '',        PRECIO_VENTA: '',    PREPARACION: '',              REFERENCIA_MP: 'MP1000002', NOMBRE_MP: 'SALMON',          CANTIDAD: 30, UNIDAD: 'G',  DESPERDICIO: 5 },
  ], [14, 24, 14, 16, 14, 28, 14, 24, 10, 8, 12])

  // Instrucciones
  const instrRows = [
    ['=== INSTRUCCIONES DE IMPORTACIÓN MASIVA ==='],
    [''],
    ['ORDEN: 1.UNIDADES → 2.MENUS → 3.PROVEEDORES → 4.MATERIAS_PRIMAS → 5.SUB_RECETAS → 6.RECETAS'],
    [''],
    ['UNIDADES: MEDIDA es la abreviatura que usan todas las demás hojas (ej: G, KG, ML)'],
    ['MENUS: CODIGO_MENU es el código que referencia la hoja RECETAS'],
    ['PROVEEDORES: CODIGO_PROVEEDOR es el código que referencia MATERIAS_PRIMAS'],
    ['MATERIAS_PRIMAS: UNIDAD_USO y UNIDAD_COMPRA deben coincidir con MEDIDA en UNIDADES'],
    ['SUB_RECETAS / RECETAS: Primera fila del grupo = encabezado. Filas siguientes con misma REFERENCIA = ingredientes'],
    ['RECETAS: CODIGO_MENU debe existir en hoja MENUS o ya estar en la base de datos'],
    [''],
    ['Los campos COSTO, CANT_PRESENTACION y PRECIO_VENTA se importan en 0 si están vacíos'],
    ['Los campos CODIGO_PROVEEDOR e ingredientes faltantes generan advertencias pero NO bloquean la importación'],
  ]
  const wsInstr = XLSX.utils.aoa_to_sheet(instrRows)
  wsInstr['!cols'] = [{ wch: 90 }]
  XLSX.utils.book_append_sheet(wb, wsInstr, 'INSTRUCCIONES')

  XLSX.writeFile(wb, 'plantilla_importacion_masiva.xlsx')
}
