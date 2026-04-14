import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const DEFAULT_ACCENT = '#C2410C'

export const useAppStore = create(
  persist(
    (set) => ({
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
      setTheme: (theme) => set({ theme }),

      // Language
      language: 'es',
      setLanguage: (language) => set({ language }),

      // Show costs to chefs toggle
      showCosts: true,
      setShowCosts: (showCosts) => set({ showCosts }),

      // Global accent color (replaces per-category accent)
      accentColor: DEFAULT_ACCENT,
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

      // Active/inactive filter for recipes (kept for Gestión de Recetas tab)
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
        set((s) => ({
          toasts: [...s.toasts, { id: Date.now(), ...toast }],
        })),
      removeToast: (id) =>
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: 'recetario-store',
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        showCosts: state.showCosts,
        currentRestaurant: state.currentRestaurant,
        accentColor: state.accentColor,
      }),
      onRehydrateStorage: () => (state) => {
        // Apply accent CSS variable immediately when store rehydrates
        const color = state?.accentColor || DEFAULT_ACCENT
        document.documentElement.style.setProperty('--accent', color)
      },
    }
  )
)
