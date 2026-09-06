import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { PRESENCE_REFRESH_MS } from '@/lib/constants'

/**
 * Battement de presence.
 *
 * Un onglet ouvert signale son activite toutes les quelques minutes. Ce
 * n'est PAS un sondage permanent : une ecriture par utilisateur et par
 * intervalle, sans lecture ni diffusion. La navigation normale met deja
 * `lastSeenAt` a jour (voir getCurrentUser) ; ce battement ne sert qu'aux
 * onglets laisses ouverts sans navigation.
 */
export async function POST() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 })
  }

  // getCurrentUser a deja rafraichi la date si elle etait ancienne : on
  // n'ecrit ici que si elle ne l'a pas ete, pour ne pas doubler l'ecriture.
  const threshold = new Date(Date.now() - PRESENCE_REFRESH_MS)
  await prisma.user.updateMany({
    where: {
      id: user.id,
      OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: threshold } }],
    },
    data: { lastSeenAt: new Date() },
  })

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
