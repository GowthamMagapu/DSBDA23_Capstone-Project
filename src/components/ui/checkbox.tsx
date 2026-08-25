'use client'

import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const checkboxId = id || label.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex items-start gap-3">
        <div className="relative flex items-center justify-center mt-0.5">
          <input
            type="checkbox"
            id={checkboxId}
            className={cn(
              'peer h-5 w-5 cursor-pointer appearance-none rounded-lg',
              'bg-white/5 border border-white/20',
              'checked:bg-gradient-to-br checked:from-white checked:to-white/70 checked:border-transparent',
              'focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-slate-900/50',
              'transition-all duration-200',
              'hover:border-white/60',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              className
            )}
            ref={ref}
            {...props}
          />
          <Check
            className={cn(
              'absolute h-4 w-4 text-white',
              'opacity-0 scale-50 peer-checked:opacity-100 peer-checked:scale-100',
              'transition-all duration-200'
            )}
            strokeWidth={3}
          />
        </div>
        <label
          htmlFor={checkboxId}
          className="text-sm text-slate-300 cursor-pointer select-none leading-relaxed"
        >
          {label}
        </label>
      </div>
    )
  }
)
Checkbox.displayName = 'Checkbox'

export { Checkbox }