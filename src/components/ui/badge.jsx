import * as React from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent text-white shadow',
        secondary: 'border-transparent bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200',
        destructive: 'border-transparent bg-red-500 text-white shadow hover:bg-red-600',
        outline: 'text-foreground',
        success: 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
        warning: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

function Badge({ className, variant, style, ...props }) {
  const resolvedStyle = (!variant || variant === 'default')
    ? { backgroundColor: 'var(--accent, #d97706)', ...style }
    : style
  return <div className={cn(badgeVariants({ variant }), className)} style={resolvedStyle} {...props} />
}

export { Badge, badgeVariants }
