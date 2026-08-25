'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { PasswordInput } from './PasswordInput'
import { Link } from '@/components/ui/link'
import { Separator } from '@/components/ui/separator'
import { GoogleButton } from './GoogleButton'
import { cn } from '@/lib/utils'
import { Loader2, ArrowRight, Check, Shield } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'

const signUpSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type SignUpFormData = z.infer<typeof signUpSchema>

type SignUpFormState = {
  errors?: {
    name?: string[]
    email?: string[]
    password?: string[]
    confirmPassword?: string[]
    _form?: string[]
  }
  message?: string
}

const passwordRequirements = [
  { label: 'At least 8 characters', regex: /.{8,}/ },
  { label: 'One uppercase letter', regex: /[A-Z]/ },
  { label: 'One lowercase letter', regex: /[a-z]/ },
  { label: 'One number', regex: /[0-9]/ },
  { label: 'One special character', regex: /[^A-Za-z0-9]/ },
]

export const SignUpForm = () => {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setError,
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
  })

  const watchedPassword = watch('password')

  const passwordChecks = passwordRequirements.map((req) => ({
    ...req,
    met: req.regex.test(watchedPassword || ''),
  }))

  const onSubmit = async (data: SignUpFormData) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        if (result.errors?.email) {
          setError('email', { message: result.errors.email[0] })
        }
        if (result.errors?._form) {
          setError('confirmPassword', { message: result.errors._form[0] })
        }
        return
      }

      setShowSuccess(true)

      setTimeout(() => {
        router.push('/dashboard')
        router.refresh()
      }, 800)
    } catch {
      setError('confirmPassword', { message: 'Something went wrong. Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="grid gap-5">
        <Input
          {...register('name')}
          type="text"
          label="Full Name"
          placeholder="John Doe"
          error={errors.name?.message}
          disabled={isLoading || showSuccess}
          autoComplete="name"
          autoFocus
        />

        <Input
          {...register('email')}
          type="email"
          label="Email Address"
          placeholder="you@company.com"
          error={errors.email?.message}
          disabled={isLoading || showSuccess}
          autoComplete="email"
        />

        <PasswordInput
          {...register('password')}
          label="Password"
          placeholder="Create a strong password"
          error={errors.password?.message}
          disabled={isLoading || showSuccess}
        />

        <PasswordInput
          {...register('confirmPassword')}
          label="Confirm Password"
          placeholder="Confirm your password"
          error={errors.confirmPassword?.message}
          disabled={isLoading || showSuccess}
        />
      </div>

      <div className="space-y-2 p-4 rounded-xl bg-white/5 border border-white/10">
        <p className="text-xs font-medium text-slate-400 flex items-center gap-2">
          <Shield className="h-3.5 w-3.5" />
          Password Requirements
        </p>
        <div className="grid grid-cols-2 gap-2">
          {passwordChecks.map((req, index) => (
            <motion.div
              key={index}
              className={cn(
                'flex items-center gap-2 text-xs',
                req.met ? 'text-white' : 'text-slate-500'
              )}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
            >
              <span
                className={cn(
                  'h-3.5 w-3.5 rounded flex items-center justify-center',
                  req.met
                    ? 'bg-white text-black'
                    : 'bg-white/10 border border-white/20'
                )}
              >
                {req.met && <Check className="h-2.5 w-2.5" />}
              </span>
              {req.label}
            </motion.div>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!showSuccess && (
          <motion.button
            key="signup"
            type="submit"
            disabled={isLoading}
            className={cn(
              'w-full h-12 text-lg font-semibold rounded-xl',
              'bg-gradient-to-r from-white to-white/70',
              'text-black hover:from-white/90 hover:to-white/60',
              'shadow-lg shadow-white/20',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-white/50',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'active:scale-[0.98]'
            )}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Creating Account...
              </>
            ) : (
              <>
                Create Account
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </motion.button>
        )}
        {showSuccess && (
          <motion.button
            key="success"
            type="button"
            disabled
            className={cn(
              'w-full h-12 text-lg font-semibold rounded-xl',
              'bg-gradient-to-r from-white to-white/70',
              'text-black',
              'shadow-lg shadow-white/20',
              'transition-all duration-200'
            )}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, type: 'spring' }}
          >
            <Check className="mr-2 h-5 w-5" />
            Account Created Successfully
          </motion.button>
        )}
      </AnimatePresence>

      <div className="relative">
        <Separator className="my-6" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/5 px-3 text-xs text-slate-500 font-medium">
          OR
        </div>
      </div>

      <GoogleButton
        className="h-12"
        disabled={isLoading || showSuccess}
      >
        Continue with Google
      </GoogleButton>

      <p className="text-center text-sm text-slate-400">
        Already have an account?{' '}
        <Link
          href="/auth/signin"
          className="text-white/70 hover:text-white font-medium transition-colors"
        >
          Sign In
        </Link>
      </p>
    </form>
  )
}