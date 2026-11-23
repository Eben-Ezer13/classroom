import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { dispatchDeadlineReminders, dispatchScheduledReminders, purgeExpiredRecords } from '@/lib/services/maintenance'

export const maxDuration = 60

function isAuthorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`)
  const received = Buffer.from(header ?? '')
  // Comparaison a temps constant : la duree de reponse ne revele rien du
  // secret attendu.
  return received.length === expected.length && timingSafeEqual(received, expected)
}

/**
 * Rappels d'échéance et de projets à la minute, rappels d'examens trois
 * fois par jour. La purge technique reste quotidienne.
 *
 * Declenchee par un Cron Vercel (voir vercel.json). Vercel signe ses appels
 * avec CRON_SECRET : sans en-tete valide, la route repond 401, ce qui evite
 * que n'importe qui puisse declencher une vague de notifications.
 *
 * L'operation est idempotente : chaque echeance porte un drapeau
 * `reminderSent`, un second appel n'envoie donc rien de plus.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()

  if (secret) {
    if (!isAuthorized(request.headers.get('authorization'), secret)) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
    }
  } else if (process.env.NODE_ENV === 'production') {
    // En production, refuser plutot que d'exposer un declencheur ouvert.
    return NextResponse.json({ error: 'CRON_SECRET non configuré.' }, { status: 503 })
  }

  const remindersSent = await dispatchDeadlineReminders()
  const scheduledRemindersSent = await dispatchScheduledReminders()
  const localTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Casablanca', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date())
  const purged = localTime === '03:00' ? await purgeExpiredRecords() : null

  return NextResponse.json({
    ok: true,
    remindersSent,
    scheduledRemindersSent,
    purged,
    at: new Date().toISOString(),
  })
}
