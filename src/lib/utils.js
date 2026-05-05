import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// Format number without currency symbol — sin decimales por defecto.
// Si necesitas decimales puntualmente, pasa el segundo argumento (raro).
export function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined || isNaN(Number(value))) return '0'
  return Number(value).toLocaleString('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

// Keep for backward compat but prefer formatNumber in UI
export function formatCurrency(value) {
  return formatNumber(value)
}

export function formatPercent(value) {
  return `${Math.round(value || 0)}%`
}

export function generateId() {
  return Math.random().toString(36).substring(2, 9)
}

export function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .trim()
}

export function debounce(fn, delay) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

export function calculateMargin(cost, price) {
  if (!price || price === 0) return 0
  return ((price - cost) / price) * 100
}

export function calculateCostPercent(cost, price) {
  if (!price || price === 0) return 0
  return (cost / price) * 100
}

export function truncate(str, n) {
  return str?.length > n ? str.substring(0, n - 1) + '…' : str
}

// Title case — capitalizes first letter of each word
export function toTitleCase(str) {
  if (!str) return str
  return str
    .split(' ')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : ''))
    .join(' ')
}

// Apply title case on blur handler — skips emails, codes, passwords
export function makeTitleCaseHandler(onChange) {
  return (e) => {
    const val = toTitleCase(e.target.value)
    if (val !== e.target.value) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )?.set
      nativeInputValueSetter?.call(e.target, val)
      e.target.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }
}

// ─── Helpers de normalizacion de casing (5 reglas del proyecto) ───────────────
// Recetas/sub-recetas y unidades → MAYUSCULAS
// Menus/categorias → Title Case
// Ingredientes/MP → Sentence case (solo primera letra en mayus)
// Preparacion → primera letra de cada renglon en mayus

export function toUpperSafe(s) {
  if (s == null) return s
  return String(s).toUpperCase()
}

export function toSentenceCase(s) {
  if (s == null) return s
  const str = String(s)
  if (!str.length) return str
  const trimmed = str.trimStart()
  const lead = str.slice(0, str.length - trimmed.length)
  return lead + trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
}

// Capitaliza la primera letra de cada renglon, deja el resto del renglon intacto
export function capitalizeLines(s) {
  if (s == null) return s
  return String(s)
    .split('\n')
    .map((line) => {
      const t = line.trimStart()
      if (!t) return line
      const lead = line.slice(0, line.length - t.length)
      return lead + t.charAt(0).toUpperCase() + t.slice(1)
    })
    .join('\n')
}

// ─── Predicados que detectan formato incorrecto ───────────────────────────────
export function violatesUpper(s) {
  if (s == null || s === '') return false
  return String(s) !== String(s).toUpperCase()
}

export function violatesTitleCase(s) {
  if (s == null || s === '') return false
  return String(s) !== toTitleCase(String(s))
}

export function violatesSentenceCase(s) {
  if (s == null || s === '') return false
  return String(s) !== toSentenceCase(String(s))
}

export function violatesLineCase(s) {
  if (s == null || s === '') return false
  return String(s) !== capitalizeLines(String(s))
}
