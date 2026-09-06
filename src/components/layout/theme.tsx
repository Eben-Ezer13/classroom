'use client'

import { useEffect, useState } from 'react'
import { IconMoon, IconSun } from '@/components/ui/icons'

const STORAGE_KEY = 'cp-theme'

/**
 * Applique le theme AVANT le premier rendu pour eviter le flash blanc.
 * Le script est volontairement inline et synchrone : c'est le seul moyen
 * fiable de peindre la bonne couleur des la premiere frame.
 */
export function ThemeScript() {
  const code = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}finally{document.documentElement.classList.remove('theme-pending');}})();`
  return <script dangerouslySetInnerHTML={{ __html: code }} />
}

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
    setMounted(true)
  }, [])

  function toggle() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light')
    } catch {
      // Navigation privee : le theme ne sera simplement pas memorise.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      title={isDark ? 'Mode clair' : 'Mode sombre'}
      className="size-9 grid place-items-center rounded-lg text-[var(--text-2)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] transition-colors"
    >
      {mounted && isDark ? <IconSun /> : <IconMoon />}
    </button>
  )
}
