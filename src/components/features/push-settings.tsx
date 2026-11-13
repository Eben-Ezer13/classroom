'use client'

import { useEffect, useState } from 'react'
import { Alert } from '@/components/ui/feedback'
import { Button } from '@/components/ui/button'
import { sendPushTestAction } from '@/app/actions/notifications'

type AppBadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

type PushState =
  | 'loading'
  | 'unsupported'
  | 'unavailable'
  | 'unconfigured'
  | 'off'
  | 'on'
  | 'denied'
type MessageTone = 'success' | 'warning' | 'danger'

function applicationServerKey(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from(raw, (char) => char.charCodeAt(0)).buffer as ArrayBuffer
}

export function PushNotificationsSettings() {
  const [state, setState] = useState<PushState>('loading')
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<MessageTone>('success')
  const [busy, setBusy] = useState(false)
  const [testState, setTestState] = useState<'idle' | 'sending' | 'sent' | 'received' | 'missing'>('idle')
  const [testMessage, setTestMessage] = useState('')

  async function sendTest() {
    setTestState('sending')
    setTestMessage('')
    try {
      const result = await sendPushTestAction()
      if (!result.ok) {
        setTestState('idle')
        setTestMessage(result.error || 'Impossible d’envoyer la notification de test.')
        return
      }
      setTestState('sent')
    } catch (error) {
      setTestState('idle')
      setTestMessage(error instanceof Error ? error.message : 'Impossible d’envoyer la notification de test.')
    }
  }

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }

    let active = true
    void (async () => {
      try {
        const keyResponse = await fetch('/api/push/key', { cache: 'no-store' })
        if (keyResponse.status === 503) {
          if (active) setState('unconfigured')
          return
        }
        if (!keyResponse.ok) {
          if (active) setState('unavailable')
          return
        }
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        const subscription = await registration.pushManager.getSubscription()
        if (active) setState(subscription ? 'on' : 'off')
      } catch {
        if (active) setState('unavailable')
      }
    })()
    return () => {
      active = false
    }
  }, [])

  async function enable() {
    setBusy(true)
    setMessage('')
    try {
      const keyResponse = await fetch('/api/push/key', { cache: 'no-store' })
      const keyData = await keyResponse.json()
      if (!keyResponse.ok || typeof keyData.publicKey !== 'string') {
        if (keyResponse.status === 503) setState('unconfigured')
        throw new Error(keyData.error || 'Le service de notifications n’est pas encore configuré.')
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off')
        setMessageTone('warning')
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
      setMessageTone('success')
      setMessage('Les notifications sur cet appareil sont activées.')
    } catch (error) {
      setMessageTone('danger')
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
      setMessageTone('success')
      setMessage('Les notifications sur cet appareil sont désactivées.')
    } catch (error) {
      setMessageTone('danger')
      setMessage(error instanceof Error ? error.message : 'Désactivation impossible.')
    } finally {
      setBusy(false)
    }
  }

  const buttonLabel =
    state === 'on' ? 'Désactiver sur cet appareil' : 'Activer les notifications push'

  return (
    <div className="space-y-3">
      {message ? <Alert tone={messageTone}>{message}</Alert> : null}
      <p className="text-[12.5px] text-[var(--text-3)]">
        Sur iPhone ou iPad, ajoute d’abord Classroom à l’écran d’accueil depuis Safari ; les notifications push y sont disponibles dans l’application installée.
      </p>
      {state === 'unconfigured' ? (
        <Alert tone="warning">
          Les notifications push ne sont pas configurées sur le serveur. L’administrateur doit définir
          VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY et VAPID_SUBJECT dans les variables Vercel, puis redéployer.
        </Alert>
      ) : state === 'unavailable' ? (
        <Alert tone="warning">
          Impossible de vérifier la configuration des notifications. Vérifie ta connexion puis recharge cette page.
        </Alert>
      ) : state === 'unsupported' ? (
        <Alert tone="warning">Les notifications push ne sont pas prises en charge par ce navigateur. Essaie Chrome, Edge ou Safari récent en HTTPS.</Alert>
      ) : state === 'denied' ? (
        <Alert tone="warning">Les notifications sont bloquées dans les réglages du navigateur. Autorise Classroom, puis recharge cette page.</Alert>
      ) : state !== 'loading' ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12.5px] text-[var(--text-3)]">
            {state === 'on'
              ? 'Cet appareil recevra les notifications même quand Classroom est fermé, selon les capacités du navigateur.'
              : 'Autorise les notifications sur cet appareil pour être averti lorsque Classroom est fermé.'}
          </p>
          <Button
            type="button"
            variant={state === 'on' ? 'secondary' : 'primary'}
            disabled={busy}
            onClick={state === 'on' ? disable : enable}
          >
            {busy ? 'Un instant…' : buttonLabel}
          </Button>
        </div>
      ) : null}
      {state === 'on' ? (
        <div className="space-y-2 rounded-xl border border-[var(--border)] p-3">
          <p className="text-[13px] font-medium">Vérifier les notifications sur cet appareil</p>
          <p className="text-[12.5px] text-[var(--text-3)]">Envoie une notification de test, puis indique si tu l’as reçue.</p>
          {testMessage ? <Alert tone="warning">{testMessage}</Alert> : null}
          {testState === 'received' ? (
            <Alert tone="success">Merci, la notification de test a bien été reçue.</Alert>
          ) : testState === 'missing' ? (
            <Alert tone="warning">Merci pour ton retour. Vérifie les autorisations de notification et réessaie.</Alert>
          ) : testState === 'sent' ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="w-full text-[12.5px] text-[var(--text-3)]">As-tu reçu la notification ?</p>
              <Button type="button" onClick={() => setTestState('received')}>Oui, reçue</Button>
              <Button type="button" variant="secondary" onClick={() => setTestState('missing')}>Non, pas reçue</Button>
            </div>
          ) : (
            <Button type="button" variant="secondary" disabled={testState === 'sending'} onClick={sendTest}>
              {testState === 'sending' ? 'Envoi…' : 'Envoyer une notification de test'}
            </Button>
          )}
        </div>
      ) : null}
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
