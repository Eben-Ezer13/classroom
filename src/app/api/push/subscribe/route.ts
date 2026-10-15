import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db'
import { AppError } from '@/lib/errors'

type BrowserSubscription = {
  endpoint?: unknown
  keys?: { p256dh?: unknown; auth?: unknown }
}

function parseSubscription(value: unknown) {
  if (!value || typeof value !== 'object') throw new AppError('Abonnement invalide.')
  const subscription = value as BrowserSubscription
  const endpoint = typeof subscription.endpoint === 'string' ? subscription.endpoint : ''
  const p256dh = typeof subscription.keys?.p256dh === 'string' ? subscription.keys.p256dh : ''
  const auth = typeof subscription.keys?.auth === 'string' ? subscription.keys.auth : ''
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    throw new AppError('Adresse d’abonnement invalide.')
  }
  const knownPushProvider =
    url.hostname === 'fcm.googleapis.com' ||
    url.hostname === 'web.push.apple.com' ||
    url.hostname === 'notify.windows.com' ||
    url.hostname.endsWith('.push.services.mozilla.com') ||
    url.hostname.endsWith('.notify.windows.com')
  if (
    url.protocol !== 'https:' ||
    url.port !== '' ||
    !knownPushProvider ||
    !p256dh ||
    !auth ||
    endpoint.length > 2048
  ) {
    throw new AppError('Abonnement push invalide.')
  }
  return { endpoint, p256dh, auth }
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 })

  try {
    const subscription = parseSubscription(await request.json())
    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: { ...subscription, userId: user.id },
      update: { ...subscription, userId: user.id },
    })
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[push] enregistrement impossible', error)
    return NextResponse.json({ error: 'Activation des notifications impossible.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 })

  try {
    const subscription = parseSubscription(await request.json())
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: subscription.endpoint, userId: user.id },
    })
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[push] désactivation impossible', error)
    return NextResponse.json({ error: 'Désactivation des notifications impossible.' }, { status: 500 })
  }
}
