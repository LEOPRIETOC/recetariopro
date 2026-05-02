// Preferencias de personalizacion por (usuario, restaurante).
// Cada usuario puede tener distinto accentColor por cada restaurante en el
// que es miembro. No se sincroniza a Firestore — solo localStorage de su
// dispositivo. Diferentes dispositivos del mismo usuario pueden tener
// preferencias distintas (similar a la preferencia de tema).

import { DEFAULT_ACCENT_DAY, DEFAULT_ACCENT_NIGHT } from '../store/useAppStore'

const key = (uid, rid, themeKey) => `pref_accent_${themeKey}_${uid || 'anon'}_${rid || 'none'}`

export function getAccentForRestaurant(uid, rid, theme) {
  const themeKey = theme === 'night' ? 'night' : 'day'
  if (uid && rid) {
    try {
      const stored = localStorage.getItem(key(uid, rid, themeKey))
      if (stored) return stored
    } catch (_) { /* noop */ }
  }
  return themeKey === 'night' ? DEFAULT_ACCENT_NIGHT : DEFAULT_ACCENT_DAY
}

export function setAccentForRestaurant(uid, rid, theme, color) {
  if (!uid || !rid) return
  const themeKey = theme === 'night' ? 'night' : 'day'
  try { localStorage.setItem(key(uid, rid, themeKey), color) } catch (_) { /* noop */ }
}

export function applyDefaultAccent(theme) {
  const c = theme === 'night' ? DEFAULT_ACCENT_NIGHT : DEFAULT_ACCENT_DAY
  try { document.documentElement.style.setProperty('--accent', c) } catch (_) {}
  return c
}
