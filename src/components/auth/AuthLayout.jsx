import { useAppStore } from '../../store/useAppStore'

export function AuthLayout({ children }) {
  const theme = useAppStore((s) => s.theme)

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 ${
        theme === 'night'
          ? 'bg-gray-950'
          : theme === 'earth'
          ? 'bg-earth-900'
          : 'bg-gradient-to-br from-stone-50 via-amber-50 to-yellow-50'
      }`}
    >
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gold-600 shadow-lg mb-4">
            <span className="text-white text-2xl font-display font-bold">R</span>
          </div>
          <h1 className={`font-display text-3xl font-bold ${theme === 'night' ? 'text-white' : 'text-gray-900'}`}>
            RecetarioPro
          </h1>
          <p className={`text-sm mt-1 ${theme === 'night' ? 'text-gray-400' : 'text-gray-500'}`}>
            Gestión profesional de recetas
          </p>
        </div>

        {/* Card */}
        <div
          className={`rounded-2xl border shadow-xl p-8 ${
            theme === 'night'
              ? 'bg-gray-900 border-gray-800'
              : theme === 'earth'
              ? 'bg-earth-800 border-earth-700'
              : 'bg-white border-gray-100'
          }`}
        >
          {children}
        </div>

        <p className={`text-center text-xs mt-6 ${theme === 'night' ? 'text-gray-600' : 'text-gray-400'}`}>
          © 2024 RecetarioPro. Todos los derechos reservados.
        </p>
      </div>
    </div>
  )
}
