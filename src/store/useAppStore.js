import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const DEFAULT_ACCENT_DAY   = '#0833A2'
export const DEFAULT_ACCENT_NIGHT = '#EA580C'

export const useAppStore = create(
  persist(
    (set, get) => ({
      // Auth
      user: null,
      userProfile: null,
      setUser: (user) => set({ user }),
      setUserProfile: (userProfile) => set({ userProfile }),

      // Current restaurant
      currentRestaurant: null,
      setCurrentRestaurant: (restaurant) => set({ currentRestaurant: restaurant }),

      theme: 'day',
      setTheme: (theme) => {
        const color = theme === 'night' ? DEFAULT_ACCENT_NIGHT : DEFAULT_ACCENT_DAY
        document.documentElement.style.setProperty('--accent', color)
        set({ theme, accentColor: color })
      },

      // Language
      language: 'es',
      setLanguage: (language) => set({ language }),

      // Show costs to chefs toggle
      showCosts: true,
      setShowCosts: (showCosts) => set({ showCosts }),

      // accentColor = color activo en CSS (efimero, no se persiste).
      // La personalizacion real vive por par (usuario, restaurante) en
      // localStorage (src/lib/userRestaurantPrefs.js); el store no debe
      // guardar el color personal porque contaminaria el selector de
      // restaurantes que siempre muestra defaults.
      accentColor: DEFAULT_ACCENT_DAY,
      setAccentColor: (color) => {
        document.documentElement.style.setProperty('--accent', color)
        set({ accentColor: color })
      },

      // Global search
      globalSearch: '',
      setGlobalSearch: (globalSearch) => set({ globalSearch }),

      // Selected category in POS panel
      selectedCategory: null,
      setSelectedCategory: (selectedCategory) => set({ selectedCategory }),

      // Active/inactive filter for recipes
      activeFilter: 'active',
      setActiveFilter: (activeFilter) => set({ activeFilter }),

      // Config modal open state
      configOpen: false,
      configTab: 'ingredients',
      setConfigOpen: (configOpen) => set({ configOpen }),
      setConfigTab: (configTab) => set({ configTab, configOpen: true }),
      openConfig: (tab = 'ingredients') => set({ configOpen: true, configTab: tab }),
      closeConfig: () => set({ configOpen: false }),

      // Toast notifications
      toasts: [],
      addToast: (toast) =>
        set((s) => ({ toasts: [...s.toasts, { id: Date.now(), ...toast }] })),
      removeToast: (id) =>
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: 'recetario-store',
      partialize: (state) => ({
        theme:           state.theme,
        language:        state.language,
        showCosts:       state.showCosts,
        currentRestaurant: state.currentRestaurant,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const theme = state.theme || 'day'
        const color = theme === 'night' ? DEFAULT_ACCENT_NIGHT : DEFAULT_ACCENT_DAY
        state.accentColor = color
        document.documentElement.style.setProperty('--accent', color)
      },
    }
  )
)
