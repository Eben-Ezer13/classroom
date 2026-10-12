import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Contrôle de disponibilité pour le monitoring après déploiement.
 * Ne renvoie ni détails de connexion ni erreurs internes au client.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json(
      { status: 'ok', database: 'ok', at: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[health] base de données indisponible', error)

    return NextResponse.json(
      { status: 'unavailable', database: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
