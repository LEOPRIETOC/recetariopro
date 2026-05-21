import { useEffect } from 'react'
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAppStore } from '../../store/useAppStore'

const icons = {
  success: <CheckCircle className="h-5 w-5 text-emerald-500" />,
  error: <XCircle className="h-5 w-5 text-red-500" />,
  warning: <AlertCircle className="h-5 w-5 text-amber-500" />,
  info: <AlertCircle className="h-5 w-5 text-blue-500" />,
}

function Toast({ id, type = 'info', title, message }) {
  const removeToast = useAppStore((s) => s.removeToast)

  useEffect(() => {
    const timer = setTimeout(() => removeToast(id), 4000)
    return () => clearTimeout(timer)
  }, [id, removeToast])

  return (
    <div
      className={cn(
        'flex items-start gap-3 w-80 rounded-xl border p-4 shadow-lg bg-white dark:bg-gray-900',
        'animate-fade-in',
        type === 'success' && 'border-emerald-200 dark:border-emerald-800',
        type === 'error' && 'border-red-200 dark:border-red-800',
        type === 'warning' && 'border-amber-200 dark:border-amber-800',
        type === 'info' && 'border-blue-200 dark:border-blue-800',
      )}
    >
      {icons[type]}
      <div className="flex-1 min-w-0">
        {title && <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>}
        {message && <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>}
      </div>
      <button
        onClick={() => removeToast(id)}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function Toaster() {
  const toasts = useAppStore((s) => s.toasts)

  return (
    <div className="fixed bottom-4 right-4 z-[10000] flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} />
      ))}
    </div>
  )
}

export function useToast() {
  const addToast = useAppStore((s) => s.addToast)

  return {
    toast: ({ type = 'info', title, message }) => addToast({ type, title, message }),
    success: (title, message) => addToast({ type: 'success', title, message }),
    error: (title, message) => addToast({ type: 'error', title, message }),
    warning: (title, message) => addToast({ type: 'warning', title, message }),
    info: (title, message) => addToast({ type: 'info', title, message }),
  }
}
