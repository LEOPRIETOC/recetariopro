import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const DEFAULT_ACCENT_DAY   = '#0833A2'
export const DEFAULT_ACCENT_NIGHT = '#EA580C'

const defaultForTheme = (theme) => theme === 'night' ? DEFAULT_ACCENT_NIGHT : DEFAULT_ACCENT_DAY

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

      // Theme: 'day' | 'night'
      theme: 'day',
      setTheme: (theme) => {
        const state = get()
        const color = theme === 'night'
          ? (state.accentNight || DEFAULT_ACCENT_NIGHT)
          : (state.accentDay   || DEFAULT_ACCENT_DAY)
        document.documentElement.style.setProperty('--accent', color)
        set({ theme, accentColor: color })
      },

      // Language
      language: 'es',
      setLanguage: (language) => set({ language }),

      // Show costs to chefs toggle
      showCosts: true,
      setShowCosts: (showCosts) => set({ showCosts }),

      // Per-theme accent colors
      accentDay:   DEFAULT_ACCENT_DAY,
      accentNight: DEFAULT_ACCENT_NIGHT,
      // accentColor = current active accent (kept for compatibility)
      accentColor: DEFAULT_ACCENT_DAY,
      setAccentColor: (color) => {
        document.documentElement.style.setProperty('--accent', color)
        const theme = get().theme
        if (theme === 'night') set({ accentNight: color, accentColor: color })
        else                   set({ accentDay:   color, accentColor: color })
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
        accentColor:     state.accentColor,
        accentDay:       state.accentDay,
        accentNight:     state.accentNight,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const theme = state.theme || 'day'
        const color = theme === 'night'
          ? (state.accentNight || DEFAULT_ACCENT_NIGHT)
          : (state.accentDay   || DEFAULT_ACCENT_DAY)
        state.accentColor = color
        document.documentElement.style.setProperty('--accent', color)
      },
    }
  )
)
