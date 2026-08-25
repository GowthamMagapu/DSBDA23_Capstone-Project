'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { GoogleButton } from './GoogleButton'
import { Link } from '@/components/ui/link'
import { cn } from '@/lib/utils'
import { Check, ArrowRight } from 'lucide-react'

interface AuthCardProps {
  children: React.ReactNode
  className?: string
}

export const AuthCard = ({
  children,
  className,
}: AuthCardProps) => {
  const [showSuccess] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={cn('w-full max-w-md', className)}
    >
      <Card className="overflow-hidden">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>Sign in to continue to AgentU</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pb-2">
          <GoogleButton
            className="h-12"
            disabled={showSuccess}
          >
            Continue with Google
          </GoogleButton>

          <div className="relative">
            <Separator className="my-6" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/5 px-3 text-xs text-slate-500 font-medium">
              OR
            </div>
          </div>

          {children}

          <Button
            className="w-full h-12 text-lg"
            size="lg"
            variant="default"
            disabled={showSuccess}
          >
            {showSuccess ? (
              <>
                <Check className="mr-2 h-5 w-5" />
                Signed In!
              </>
            ) : (
              <>
                Sign In
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col items-center gap-4 pt-4">
          <p className="text-sm text-slate-400">
            Don&apos;t have an account?{' '}
            <Link
              href="/auth/signup"
              className="text-white/70 hover:text-white font-medium transition-colors"
            >
              Create Account
            </Link>
          </p>
        </CardFooter>
      </Card>
    </motion.div>
  )
}