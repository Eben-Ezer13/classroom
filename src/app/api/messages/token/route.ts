import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { messagesEnabled } from '@/lib/messages/config'
import { getClassConversation } from '@/lib/messages/access'
import { authorizeMessageChannel, messageChannel } from '@/lib/messages/realtime'

export async function POST(request: NextRequest) {
  if (!messagesEnabled) {
    return NextResponse.json({ error: 'Messages indisponibles.' }, { status: 404 })
  }

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Autorisation Pusher invalide.' }, { status: 400 })
  }

  const socketId = String(formData.get('socket_id') ?? '')
  const channel = String(formData.get('channel_name') ?? '')
  const channelMatch = /^private-messages-([A-Za-z0-9_-]{1,64})$/.exec(channel)
  if (!/^\d{1,20}\.\d{1,20}$/.test(socketId) || !channelMatch) {
    return NextResponse.json({ error: 'Canal ou connexion invalide.' }, { status: 400 })
  }

  const conversationId = channelMatch[1]
  const context = await getClassConversation(user.id, user.classGroupId, conversationId)
  if (!context) {
    return NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 })
  }

  try {
    const auth = authorizeMessageChannel(
      socketId,
      messageChannel(context.conversation.id),
    )
    return NextResponse.json(auth, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('[messages] autorisation du canal temps réel impossible', error)
    return NextResponse.json(
      { error: 'Le service temps réel est momentanément indisponible.' },
      { status: 503 },
    )
  }
}
