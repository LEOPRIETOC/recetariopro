import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// Format number without currency symbol — "28.500,00"
export function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(Number(value))) return '0,00'
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
  return `${(value || 0).toFixed(1)}%`
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
