import { useEffect, useRef, useCallback, useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { useNavigate } from 'react-router-dom'

const INACTIVITY_LIMIT = 15 * 60 * 1000 // 15 minutos en ms
const WARNING_TIME = 2 * 60 * 1000      // Aviso 2 min antes

export function useInactivityLogout() {
  const navigate = useNavigate()
  const timerRef = useRef(null)
  const warningRef = useRef(null)
  const [showWarning, setShowWarning] = useState(false)

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (warningRef.current) clearTimeout(warningRef.current)
    setShowWarning(false)

    // Timer de aviso (13 minutos)
    warningRef.current = setTimeout(() => {
      setShowWarning(true)
    }, INACTIVITY_LIMIT - WARNING_TIME)

    // Timer de logout (15 minutos)
    timerRef.current = setTimeout(async () => {
      await signOut(auth)
      navigate('/login')
    }, INACTIVITY_LIMIT)
  }, [navigate])

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    events.forEach(e => window.addEventListener(e, resetTimer))
    resetTimer()

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer))
      if (timerRef.current) clearTimeout(timerRef.current)
      if (warningRef.current) clearTimeout(warningRef.current)
    }
  }, [resetTimer])

  return { showWarning, resetTimer }
}
