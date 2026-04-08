import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, Mail, Shield, ChefHat, Crown, UserPlus } from 'lucide-react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAppStore } from '../store/useAppStore'
import { useAuth } from '../hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { cn } from '../lib/utils'

const roleIcons = {
  superadmin: Crown,
  admin: Shield,
  chef: ChefHat,
}

const roleColors = {
  superadmin: 'text-purple-500',
  admin: 'text-gold-600',
  chef: 'text-blue-500',
}

export default function UsersPage() {
  const { t } = useTranslation()
  const { currentRestaurant, theme } = useAppStore()
  const { isAdmin } = useAuth()
  const isDark = theme === 'night'

  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentRestaurant?.id) return
    const memberIds = Object.keys(currentRestaurant.members || {})
    if (memberIds.length === 0) { setLoading(false); return }

    // Fetch user profiles for all members
    Promise.all(
      memberIds.map(async (uid) => {
        const snap = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)))
        if (snap.empty) return null
        const userData = snap.docs[0].data()
        return {
          ...userData,
          restaurantRole: currentRestaurant.members[uid]?.role || 'chef',
        }
      })
    ).then((results) => {
      setMembers(results.filter(Boolean))
      setLoading(false)
    })
  }, [currentRestaurant])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cn('font-display text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
            {t('users.title')}
          </h1>
          <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
            {members.length} miembro{members.length !== 1 ? 's' : ''} del equipo
          </p>
        </div>
        {isAdmin && (
          <Button>
            <UserPlus className="h-4 w-4" /> {t('users.inviteUser')}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member) => {
            const RoleIcon = roleIcons[member.restaurantRole] || ChefHat
            const roleColor = roleColors[member.restaurantRole] || 'text-gray-500'
            return (
              <Card key={member.uid} className={cn('hover:shadow-md transition-all', isDark && 'bg-gray-900 border-gray-800')}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gold-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-lg font-bold">
                        {member.name?.[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('font-semibold truncate', isDark ? 'text-white' : 'text-gray-800')}>
                        {member.name}
                      </p>
                      <p className={cn('text-xs truncate flex items-center gap-1 mt-0.5', isDark ? 'text-gray-500' : 'text-gray-400')}>
                        <Mail className="h-3 w-3" /> {member.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    <RoleIcon className={cn('h-4 w-4', roleColor)} />
                    <span className={cn('text-sm capitalize font-medium', roleColor)}>
                      {t(`users.roles.${member.restaurantRole}`)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Role legend */}
      <Card className={cn(isDark && 'bg-gray-900 border-gray-800')}>
        <CardHeader><CardTitle className="text-sm">Roles del sistema</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { role: 'superadmin', desc: 'Acceso total a todas las funciones y restaurantes' },
              { role: 'admin', desc: 'Gestión completa del restaurante, usuarios, costos y configuración' },
              { role: 'chef', desc: 'Visualización de recetas (costos opcionales según configuración)' },
            ].map(({ role, desc }) => {
              const Icon = roleIcons[role]
              const color = roleColors[role]
              return (
                <div key={role} className="flex items-start gap-3">
                  <Icon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', color)} />
                  <div>
                    <p className={cn('text-sm font-medium capitalize', isDark ? 'text-gray-200' : 'text-gray-800')}>
                      {t(`users.roles.${role}`)}
                    </p>
                    <p className={cn('text-xs', isDark ? 'text-gray-600' : 'text-gray-400')}>{desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
