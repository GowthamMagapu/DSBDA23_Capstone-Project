'use client'

import { motion } from 'framer-motion'
import { Brain } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeStyles = {
  sm: 'text-xl',
  md: 'text-3xl',
  lg: 'text-5xl',
}

const iconSizes = {
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
}

export const Logo = ({ className, size = 'md' }: LogoProps) => {
  return (
    <motion.div
      className={cn('flex items-center gap-3', className)}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <motion.div
        className={cn(
          'relative flex items-center justify-center rounded-2xl',
          'bg-gradient-to-br from-white to-white/60',
          'shadow-2xl shadow-white/20',
          iconSizes[size]
        )}
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ duration: 0.8, delay: 0.2, type: 'spring', stiffness: 100 }}
        whileHover={{ scale: 1.1, rotate: 10 }}
      >
        <Brain className="text-white" />
        <motion.div
          className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-yellow-400"
          animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </motion.div>
      <div>
        <motion.h1
          className={cn(
            'font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-300 bg-clip-text text-transparent',
            sizeStyles[size]
          )}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          AgentU
        </motion.h1>
        <motion.p
          className="text-xs font-medium text-slate-400 tracking-wider uppercase"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          Multi-Agent HR Automation
        </motion.p>
      </div>
    </motion.div>
  )
}

export const LogoIcon = ({ className, size = 'md' }: LogoProps) => {
  return (
    <motion.div
      className={cn(
        'relative flex items-center justify-center rounded-2xl',
        'bg-gradient-to-br from-white to-white/60',
        'shadow-2xl shadow-white/20',
        iconSizes[size],
        className
      )}
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ duration: 0.8, type: 'spring', stiffness: 100 }}
      whileHover={{ scale: 1.1, rotate: 10 }}
    >
      <Brain className="text-white" />
    </motion.div>
  )
}