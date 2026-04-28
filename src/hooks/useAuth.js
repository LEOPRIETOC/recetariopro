import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { onAuthChange, getUserProfile } from '../services/auth'
import { collection, query, where, getDocs, limit } from 'firebase/firestore'
import { db } from '../lib/firebase'

// Module-level flag — resets on every page reload, prevents duplicate navigation
// from multiple simultaneous useAuth() instances
let _navigatedToSelector = false

export function useAuth() {
  const {
    user, userProfile,
    setUser, setUserProfile,
    setCurrentRestaurant, currentRestaurant,
    setAccentColor,
  } = useAppStore()
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        })
        let profile = await getUserProfile(firebaseUser.uid)
        if (profile) setUserProfile(profile)

        if (!currentRestaurant) {
          let found = null
          try {
            const q = query(
              collection(db, 'restaurants'),
              where(`members.${firebaseUser.uid}.role`, 'in', ['master', 'admin', 'usuario']),
              limit(1)
            )
            const snap = await getDocs(q)
            if (!snap.empty) found = { id: snap.docs[0].id, ...snap.docs[0].data() }
          } catch {
            try {
              const q2 = query(
                collection(db, 'restaurants'),
                where('ownerId', '==', firebaseUser.uid),
                limit(1)
              )
              const snap2 = await getDocs(q2)
              if (!snap2.empty) found = { id: snap2.docs[0].id, ...snap2.docs[0].data() }
            } catch { /* silent */ }
          }

          if (found) {
            setCurrentRestaurant(found)
            if (found.accentColor) setAccentColor(found.accentColor)
          }
        }

        // Navigate to restaurant selector on every fresh page load / login
        if (!_navigatedToSelector) {
          _navigatedToSelector = true
          navigate('/restaurants')
        }
      } else {
        // Logout — reset everything
        _navigatedToSelector = false
        setUser(null)
        setUserProfile(null)
        setCurrentRestaurant(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const rawRole = userProfile?.role?.toLowerCase() || ''
  const role = rawRole === 'superadmin' ? 'admin' : (rawRole === 'chef' ? 'usuario' : rawRole)
  const isMaster  = role === 'master'
  const isAdmin   = role === 'admin'
  const isUsuario = role === 'usuario'

  const canEdit             = isMaster || isAdmin
  const canSeeCosts         = isMaster || isAdmin
  const canManageUsers      = isMaster || isAdmin
  const canCreateAdmin      = isMaster || isAdmin
  const canCreateRestaurant = isMaster

  return {
    user, userProfile, loading,
    isMaster, isAdmin, isUsuario,
    canEdit, canSeeCosts, canManageUsers, canCreateAdmin, canCreateRestaurant,
  }
}
