'use client'

import * as React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface LinkProps extends React.ComponentPropsWithoutRef<typeof Link> {
  variant?: 'default' | 'muted'
}

export const StyledLink = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    return (
      <Link
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-colors',
          variant === 'default' && 'text-white/70 hover:text-white',
          variant === 'muted' && 'text-slate-400 hover:text-slate-300',
          className
        )}
        {...props}
      >
        {children}
      </Link>
    )
  }
)
StyledLink.displayName = 'StyledLink'

export { StyledLink as Link }