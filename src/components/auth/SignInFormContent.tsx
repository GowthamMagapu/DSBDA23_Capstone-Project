'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { PasswordInput } from './PasswordInput'
import { Link } from '@/components/ui/link'
import { cn } from '@/lib/utils'
import { Loader2, ArrowRight, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().optional(),
})

type SignInFormData = z.infer<typeof signInSchema>

export function SignInFormContent({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  const [isLoading, setIsLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: { remember: false },
  })

  const onSubmit = async (data: SignInFormData) => {
    setIsLoading(true)
    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (result?.error) {
        setError('password', { message: 'Invalid email or password' })
        return
      }

      setShowSuccess(true)
      onSuccess?.()

      setTimeout(() => {
        router.push(callbackUrl)
        router.refresh()
      }, 800)
    } catch {
      setError('password', { message: 'Something went wrong. Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="grid gap-5">
        <Input
          {...register('email')}
          type="email"
          label="Email Address"
          placeholder="you@company.com"
          error={errors.email?.message}
          disabled={isLoading || showSuccess}
          autoComplete="email"
          autoFocus
        />

        <PasswordInput
          {...register('password')}
          label="Password"
          placeholder="Enter your password"
          error={errors.password?.message}
          disabled={isLoading || showSuccess}
        />
      </div>

      <div className="flex items-center justify-between">
        <Checkbox
          {...register('remember')}
          label="Remember me"
        />
        <Link
          href="/auth/forgot-password"
          className="text-sm text-white/70 hover:text-white font-medium transition-colors"
        >
          Forgot password?
        </Link>
      </div>

      <AnimatePresence mode="wait">
        {!showSuccess && (
          <motion.button
            key="signin"
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
                Signing in...
              </>
            ) : (
              <>
                Sign In
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
            Signed In Successfully
          </motion.button>
        )}
      </AnimatePresence>
    </form>
  )
}