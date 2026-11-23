'use client'

import { useEffect, useState } from 'react'
import { formatCountdown } from '@/lib/utils'

export function ExamCountdown({ startsAt }: { startsAt: string }) {
  const [now, setNow] = useState(0)
  useEffect(() => {
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const date = new Date(startsAt)
  return <span aria-live="off">{now ? formatCountdown(date) : 'Calcul du compte à rebours…'}</span>
}
