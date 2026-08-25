'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface FloatingParticleProps {
  index: number
  delay: number
  duration: number
  size: number
  x: number
  y: number
  color: 'neutral'
}

const FloatingParticle = ({
  index,
  delay,
  duration,
  size,
  x,
  y,
  color,
}: FloatingParticleProps) => {
  const colorStyles = {
    neutral: 'bg-gradient-to-br from-white/30 to-white/5',
  }

  const glowStyles = {
    neutral: 'shadow-white/20',
  }

  return (
    <motion.div
      key={index}
      className={cn(
        'absolute rounded-full opacity-30 blur-xl',
        colorStyles[color],
        glowStyles[color]
      )}
      style={{ width: size, height: size, left: x, top: y }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: [0.1, 0.3, 0.1],
        scale: [0.8, 1.2, 0.8],
        x: [0, (index % 2 === 0 ? 50 : -50), 0],
        y: [0, (index % 3 === 0 ? -30 : 30), 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  )
}

export const FloatingParticles = () => {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    index: i,
    delay: i * 0.3,
    duration: 15 + Math.random() * 10,
    size: 60 + Math.random() * 100,
    x: Math.random() * 100,
    y: Math.random() * 100,
    color: 'neutral' as const,
  }))

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {particles.map((p) => (
        <FloatingParticle key={p.index} {...p} />
      ))}
    </div>
  )
}

interface GradientOrbProps {
  x: string
  y: string
  size: string
  color: 'neutral'
  delay: number
  duration: number
}

const GradientOrb = ({ x, y, size, color, delay, duration }: GradientOrbProps) => {
  const gradientStyles = {
    neutral: 'from-white/20 via-white/10 to-transparent',
  }

  return (
    <motion.div
      className={cn(
        'absolute rounded-full opacity-20 blur-3xl',
        'bg-gradient-to-br',
        gradientStyles[color]
      )}
      style={{ width: size, height: size, left: x, top: y }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: [0.15, 0.25, 0.15],
        scale: [0.9, 1.1, 0.9],
        rotate: [0, 180, 360],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  )
}

export const GradientOrbs = () => {
  const orbs = [
    { x: '10%', y: '10%', size: '400px', color: 'neutral' as const, delay: 0, duration: 20 },
    { x: '70%', y: '80%', size: '300px', color: 'neutral' as const, delay: 2, duration: 25 },
    { x: '50%', y: '50%', size: '500px', color: 'neutral' as const, delay: 4, duration: 30 },
    { x: '80%', y: '20%', size: '250px', color: 'neutral' as const, delay: 1, duration: 18 },
    { x: '20%', y: '70%', size: '350px', color: 'neutral' as const, delay: 3, duration: 22 },
  ]

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {orbs.map((orb, i) => (
        <GradientOrb key={i} {...orb} />
      ))}
    </div>
  )
}

const patternSvg = `data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E`

export const AnimatedBackground = () => {
  return (
    <div className="relative fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-950/50 via-slate-950 to-black" />
      <GradientOrbs />
      <FloatingParticles />
      <div className="absolute inset-0" style={{ backgroundImage: `url(${patternSvg})`, opacity: 0.3 }} />
    </div>
  )
}