'use client'

import { Suspense } from 'react'
import { SignInFormContent } from './SignInFormContent'

export function SignInForm({ onSuccess }: { onSuccess?: () => void }) {
  return (
    <Suspense fallback={<div className="h-12 animate-pulse bg-white/5 rounded-xl" />}>
      <SignInFormContent onSuccess={onSuccess} />
    </Suspense>
  )
}