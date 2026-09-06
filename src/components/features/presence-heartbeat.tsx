'use client'

import { useEffect } from 'react'
import { PRESENCE_HEARTBEAT_MS } from '@/lib/constants'

/**
 * Signale que l'onglet est toujours actif.
 *
 * Trois precautions pour rester leger :
 *   - un appel toutes les 3 minutes, pas toutes les secondes ;
 *   - rien n'est envoye quand l'onglet est en arriere-plan ;
 *   - un seul appel supplementaire au retour au premier plan.
 * Cout : quelques requetes par heure et par membre connecte.
 */
export function PresenceHeartbeat() {
  useEffect(() => {
    let stopped = false

    const ping = () => {
      if (stopped || document.visibilityState !== 'visible') return
      void fetch('/api/presence', {
        method: 'POST',
        cache: 'no-store',
        keepalive: true,
      }).catch(() => {
        // Une perte de reseau ne doit rien casser a l'ecran.
      })
    }

    const timer = window.setInterval(ping, PRESENCE_HEARTBEAT_MS)
    document.addEventListener('visibilitychange', ping)

    return () => {
      stopped = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', ping)
    }
  }, [])

  return null
}
