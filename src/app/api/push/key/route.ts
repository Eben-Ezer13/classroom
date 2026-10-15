import { NextResponse } from 'next/server'
import { getPushPublicKey } from '@/lib/push'

export const dynamic = 'force-dynamic'

export async function GET() {
  const publicKey = getPushPublicKey()
  if (!publicKey) {
    return NextResponse.json({ error: 'Notifications push non configurées.' }, { status: 503 })
  }
  return NextResponse.json({ publicKey }, { headers: { 'Cache-Control': 'no-store' } })
}
