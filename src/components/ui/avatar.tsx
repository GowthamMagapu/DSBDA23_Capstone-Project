'use client'

import * as React from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null
  alt?: string
  fallback?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
}

const sizeValues = {
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, size = 'md', ...props }, ref) => {
    const [imageError, setImageError] = React.useState(false)

    const initials = React.useMemo(() => {
      if (!fallback) return '?'
      return fallback
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }, [fallback])

    const bgColor = React.useMemo(() => {
      if (!fallback) return 'bg-white/70 text-black'
      const colors = [
        'bg-white/70 text-black',
        'bg-white/80',
        'bg-white/60',
        'bg-white/50 text-black',
        'bg-white/40 text-black',
        'bg-white/30 text-black',
        'bg-rose-600',
      ]
      let hash = 0
      for (let i = 0; i < fallback.length; i++) {
        hash = fallback.charCodeAt(i) + ((hash << 5) - hash)
      }
      return colors[Math.abs(hash) % colors.length]
    }, [fallback])

    const dimension = sizeValues[size]

    return (
      <div
        ref={ref}
        className={cn(
          'relative inline-flex items-center justify-center rounded-full overflow-hidden',
          'bg-gradient-to-br from-white to-white/60 text-black',
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {src && !imageError ? (
          <Image
            src={src}
            alt={alt || fallback || 'Avatar'}
            width={dimension}
            height={dimension}
            className="h-full w-full object-cover"
            onError={() => setImageError(true)}
            unoptimized
          />
        ) : (
          <div className={cn('h-full w-full flex items-center justify-center font-semibold text-white', bgColor)}>
            {initials}
          </div>
        )}
      </div>
    )
  }
)
Avatar.displayName = 'Avatar'