import { NextResponse } from 'next/server'
import { dispatchDeadlineRemindersAction } from '@/app/actions/deadlines'

/**
 * Envoi des rappels d’échéance.
 *
 * Declenchee par un Cron Vercel (voir vercel.json). Vercel signe ses appels
 * avec CRON_SECRET : sans en-tete valide, la route repond 401, ce qui evite
 * que n'importe qui puisse declencher une vague de notifications.
 *
 * L’opération est idempotente : chaque échéance porte un drapeau
 * `reminderSent`, un second appel n'envoie donc rien de plus.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()

  if (secret) {
    const header = request.headers.get('authorization')
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Non autorise.' }, { status: 401 })
    }
  } else if (process.env.NODE_ENV === 'production') {
    // En production, refuser plutot que d'exposer un declencheur ouvert.
    return NextResponse.json(
      { error: 'CRON_SECRET non configure.' },
      { status: 503 },
    )
  }

  const sent = await dispatchDeadlineRemindersAction()

  return NextResponse.json({
    ok: true,
    remindersSent: sent,
    at: new Date().toISOString(),
  })
}
