import type { Metadata, Viewport } from 'next'
import { ThemeScript } from '@/components/layout/theme'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Plateforme de gestion de classe',
    template: '%s · Gestion de classe',
  },
  description:
    'Programme, ressources, annonces, projets et échéances centralisés pour toute la classe.',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f9' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0c11' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="theme-pending" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  )
}
