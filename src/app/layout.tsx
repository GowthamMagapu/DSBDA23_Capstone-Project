import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { SessionProvider } from 'next-auth/react'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AgentU | Multi-Agent HR Automation',
  description: 'Automate hiring with intelligent AI agents. Next-generation recruitment platform powered by autonomous agents for sourcing, screening, and analysis.',
  keywords: ['HR automation', 'AI recruitment', 'talent acquisition', 'hiring automation', 'multi-agent system'],
  authors: [{ name: 'AgentU' }],
  creator: 'AgentU',
  publisher: 'AgentU',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://talentflow.ai',
    title: 'AgentU | Multi-Agent HR Automation',
    description: 'Automate hiring with intelligent AI agents. Next-generation recruitment platform.',
    siteName: 'AgentU',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AgentU | Multi-Agent HR Automation',
    description: 'Automate hiring with intelligent AI agents.',
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body
        className={`${inter.variable} font-sans antialiased bg-slate-950 text-white`}
      >
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}