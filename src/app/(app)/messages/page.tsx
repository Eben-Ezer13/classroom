import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requirePageUser } from '@/lib/auth/guards'
import { messagesEnabled } from '@/lib/messages/config'
import { getClassConversation } from '@/lib/messages/access'
import { NoClassState } from '@/components/ui/no-class'
import { PageHeader } from '@/components/layout/page-header'
import { MessagesChat } from '@/components/messages/messages-chat'

export const metadata: Metadata = { title: 'Messages' }

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ messageId?: string; reports?: string }>
}) {
  if (!messagesEnabled) notFound()

  const user = await requirePageUser()
  const params = await searchParams
  if (!user.classGroupId) {
    return (
      <>
        <PageHeader title="Messages" />
        <NoClassState />
      </>
    )
  }

  const context = await getClassConversation(user.id, user.classGroupId)
  if (!context) notFound()

  return (
    <>
      <PageHeader
        title="Messages"
        description={`Discussion de la classe ${user.className ?? ''}.`}
      />
      <MessagesChat
        conversationId={context.conversation.id}
        currentUserId={user.id}
        canMentionAll={context.role === 'ADMIN'}
        focusMessageId={params.messageId ?? null}
        initialReportsOpen={params.reports === '1' && context.role === 'ADMIN'}
      />
    </>
  )
}
