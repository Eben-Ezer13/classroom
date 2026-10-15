'use client'

import { useEffect, useState } from 'react'
import { Alert } from '@/components/ui/feedback'
import { Button } from '@/components/ui/button'

type AppBadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

type PushState = 'loading' | 'unsupported' | 'off' | 'on' | 'denied'

function applicationServerKey(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from(raw, (char) => char.charCodeAt(0)).buffer as ArrayBuffer
}

export function PushNotificationsSettings() {
  const [state, setState] = useState<PushState>('loading')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setState(subscription ? 'on' : 'off'))
      .catch(() => setState('unsupported'))
  }, [])

  async function enable() {
    setBusy(true)
    setMessage('')
    try {
      const keyResponse = await fetch('/api/push/key', { cache: 'no-store' })
      const keyData = await keyResponse.json()
      if (!keyResponse.ok || typeof keyData.publicKey !== 'string') {
        throw new Error(keyData.error || 'Le service de notifications n’est pas encore configuré.')
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off')
        setMessage('Autorise les notifications Classroom dans les réglages du navigateur.')
        return
      }

      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      const ready = await navigator.serviceWorker.ready
      const subscription =
        (await ready.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(keyData.publicKey),
        }))

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Activation des notifications impossible.')
      setState('on')
      setMessage('Les notifications sur cet appareil sont activées.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Activation des notifications impossible.')
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    setMessage('')
    try {
      const registration = await navigator.serviceWorker.getRegistration('/')
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        const response = await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription),
        })
        if (!response.ok) throw new Error('La désactivation n’a pas abouti.')
        await subscription.unsubscribe()
      }
      setState('off')
      setMessage('Les notifications sur cet appareil sont désactivées.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Désactivation impossible.')
    } finally {
      setBusy(false)
    }
  }

  const buttonLabel =
    state === 'on' ? 'Désactiver sur cet appareil' : 'Activer les notifications push'

  return (
    <div className="space-y-3">
      {message ? <Alert tone={state === 'on' || state === 'off' ? 'success' : 'danger'}>{message}</Alert> : null}
      <p className="text-[12.5px] text-[var(--text-3)]">
        Sur iPhone ou iPad, ajoute d’abord Classroom à l’écran d’accueil depuis Safari ; les notifications push y sont disponibles dans l’application installée.
      </p>
      {state === 'unsupported' ? (
        <Alert tone="warning">Les notifications push ne sont pas prises en charge par ce navigateur. Essaie Chrome, Edge ou Safari récent en HTTPS.</Alert>
      ) : state === 'denied' ? (
        <Alert tone="warning">Les notifications sont bloquées dans les réglages du navigateur. Autorise Classroom, puis recharge cette page.</Alert>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12.5px] text-[var(--text-3)]">
            {state === 'on'
              ? 'Cet appareil recevra les notifications même quand Classroom est fermé, selon les capacités du navigateur.'
              : 'Autorise les notifications sur cet appareil pour être averti lorsque Classroom est fermé.'}
          </p>
          <Button
            type="button"
            variant={state === 'on' ? 'secondary' : 'primary'}
            disabled={busy || state === 'loading'}
            onClick={state === 'on' ? disable : enable}
          >
            {busy ? 'Un instant…' : buttonLabel}
          </Button>
        </div>
      )}
    </div>
  )
}

export function PushAppBootstrap({ unreadCount }: { unreadCount: number }) {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      console.error('[pwa] enregistrement du service worker impossible', error)
    })

    const badge = navigator as AppBadgeNavigator
    if (unreadCount > 0) void badge.setAppBadge?.(unreadCount)
    else void badge.clearAppBadge?.()
  }, [unreadCount])

  return null
}

export function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  async function install() {
    if (!installPrompt) {
      setMessage(/iPhone|iPad|iPod/i.test(navigator.userAgent)
        ? 'Sur iPhone/iPad : ouvre le menu Partager de Safari, puis « Sur l’écran d’accueil ». '
        : 'Utilise le menu d’installation de ton navigateur (« Installer Classroom » ou « Ajouter à l’écran d’accueil »).')
      return
    }
    const prompt = installPrompt as Event & { prompt: () => Promise<void> }
    await prompt.prompt()
    setInstallPrompt(null)
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="secondary" onClick={install}>
        Installer Classroom sur cet appareil
      </Button>
      {message ? <p className="text-[12.5px] text-[var(--text-3)]">{message}</p> : null}
    </div>
  )
}
