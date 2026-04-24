import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { onAuthChange, getUserProfile } from '../services/auth'
import { collection, query, where, getDocs, addDoc, setDoc, doc, limit, serverTimestamp } from 'firebase/firestore'
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

        // Load the user's primary restaurant (kept for backwards compat)
        if (!currentRestaurant) {
          let found = null
          try {
            const q = query(
              collection(db, 'restaurants'),
              where(`members.${firebaseUser.uid}.role`, 'in', ['admin', 'chef', 'superadmin', 'master', 'usuario']),
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
          } else {
            // Auto-create restaurant on first login
            try {
              const name = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Mi Restaurante'
              const restRef = await addDoc(collection(db, 'restaurants'), {
                name,
                ownerId: firebaseUser.uid,
                members: { [firebaseUser.uid]: { role: 'admin' } },
                createdAt: serverTimestamp(),
              })
              await setDoc(doc(db, 'users', firebaseUser.uid), {
                role: 'admin',
                restaurantId: restRef.id,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName || '',
                createdAt: serverTimestamp(),
              }, { merge: true })
              setCurrentRestaurant({ id: restRef.id, name, ownerId: firebaseUser.uid })
              profile = await getUserProfile(firebaseUser.uid)
              if (profile) setUserProfile(profile)
            } catch { /* silent */ }
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

  const role           = userProfile?.role?.toLowerCase() || ''
  const isMaster       = role === 'master'
  const isSuperAdmin   = role === 'superadmin'
  const isAdmin        = role === 'admin'
  const isChef         = role === 'chef'
  const isUsuario      = role === 'usuario'

  // Permisos compuestos
  const canEdit             = isMaster || isSuperAdmin || isAdmin
  const canSeeCosts         = isMaster || isSuperAdmin || isAdmin
  const canManageUsers      = isMaster || isSuperAdmin
  const canCreateAdmin      = isMaster || isSuperAdmin
  const canCreateRestaurant = isMaster

  return {
    user, userProfile, loading,
    isAdmin, isSuperAdmin, isMaster, isChef, isUsuario,
    canEdit, canSeeCosts, canManageUsers, canCreateAdmin, canCreateRestaurant,
  }
}
