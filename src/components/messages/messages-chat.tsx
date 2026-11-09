'use client'

import Pusher from 'pusher-js'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatRelative } from '@/lib/utils'

type MentionView = {
  userId: string
  user: { firstName: string; lastName: string }
}

type MessageView = {
  id: string
  conversationId: string
  authorId: string | null
  replyToId: string | null
  body: string
  createdAt: string | Date
  author: { firstName: string; lastName: string } | null
  mentions?: MentionView[]
  mentionAll?: boolean
  replyTo?: {
    id: string
    body: string
    author: { firstName: string; lastName: string } | null
  } | null
}

type MemberOption = {
  userId: string
  role: 'ADMIN' | 'MEMBER'
  user: { firstName: string; lastName: string }
}

export function MessagesChat({
  conversationId,
  currentUserId,
  canMentionAll,
  focusMessageId,
}: {
  conversationId: string
  currentUserId: string
  canMentionAll: boolean
  focusMessageId: string | null
}) {
  const router = useRouter()
  const [messages, setMessages] = useState<MessageView[]>([])
  const [members, setMembers] = useState<MemberOption[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [body, setBody] = useState('')
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([])
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [replyTo, setReplyTo] = useState<MessageView | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [realtimeWarning, setRealtimeWarning] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const focusedMessageRef = useRef<string | null>(null)

  const appendMessage = useCallback((message: MessageView) => {
    setMessages((current) => {
      if (current.some((item) => item.id === message.id)) return current
      return [...current, message].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
    })
  }, [])

  useEffect(() => {
    let active = true

    const refreshThread = async () => {
      try {
        const response = await fetch(
          `/api/messages?conversationId=${encodeURIComponent(conversationId)}${
            focusMessageId ? `&messageId=${encodeURIComponent(focusMessageId)}` : ''
          }`,
          { cache: 'no-store' },
        )
        const result = await response.json()
        if (!response.ok) throw new Error(result.error ?? 'Impossible de charger les messages.')
        if (!active) return
        setMessages(result.messages as MessageView[])
        setMembers(result.members as MemberOption[])
        setUnreadCount(result.unreadCount as number)
        setError(null)
        router.refresh()
      } catch (cause) {
        if (!active) return
        setError(cause instanceof Error ? cause.message : 'Impossible de charger les messages.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void refreshThread()

    const key = process.env.NEXT_PUBLIC_PUSHER_KEY
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER
    if (!key || !cluster) {
      setRealtimeWarning('Le service temps réel n’est pas configuré.')
      return () => {
        active = false
      }
    }

    const pusher = new Pusher(key, {
      cluster,
      channelAuthorization: { endpoint: '/api/messages/token', transport: 'ajax' },
    })
    const channelName = `private-messages-${conversationId}`
    const channel = pusher.subscribe(channelName)
    const onMessage = (message: MessageView) => {
      if (!active) return
      appendMessage(message)
      void refreshThread()
    }
    const onConnectionState = (state: { current: string }) => {
      if (!active) return
      const connected = state.current === 'connected'
      setRealtimeConnected(connected)
      if (connected) {
        setRealtimeWarning(null)
      } else if (state.current === 'failed' || state.current === 'unavailable') {
        setRealtimeWarning('Connexion temps réel interrompue. Actualise la page pour réessayer.')
      }
    }
    channel.bind('message', onMessage)
    pusher.connection.bind('state_change', onConnectionState)

    return () => {
      active = false
      channel.unbind('message', onMessage)
      pusher.connection.unbind('state_change', onConnectionState)
      pusher.unsubscribe(channelName)
      pusher.disconnect()
    }
  }, [appendMessage, conversationId, focusMessageId, router])

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages])

  useEffect(() => {
    if (!focusMessageId || focusedMessageRef.current === focusMessageId) return
    const target = document.getElementById(`message-${focusMessageId}`)
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    focusedMessageRef.current = focusMessageId
  }, [focusMessageId, messages])

  function updateBody(value: string, caret: number) {
    setBody(value)
    const beforeCaret = value.slice(0, caret)
    const match = /(?:^|\s)@([^\s@]*)$/u.exec(beforeCaret)
    if (!match) {
      setMentionQuery(null)
      setMentionStart(null)
      return
    }
    setMentionQuery(match[1])
    setMentionStart(beforeCaret.lastIndexOf('@'))
  }

  function insertMention(member: MemberOption | null) {
    if (mentionStart === null) return
    const caret = textareaRef.current?.selectionStart ?? body.length
    const label = member ? `@${member.user.firstName} ` : '@tous '
    const updated = `${body.slice(0, mentionStart)}${label}${body.slice(caret)}`
    setBody(updated)
    if (member) {
      setMentionedUserIds((current) =>
        current.includes(member.userId) ? current : [...current, member.userId],
      )
    }
    setMentionQuery(null)
    setMentionStart(null)
    requestAnimationFrame(() => {
      const input = textareaRef.current
      if (!input) return
      input.focus()
      const nextCaret = mentionStart + label.length
      input.setSelectionRange(nextCaret, nextCaret)
    })
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = body.trim()
    if (!text || sending) return

    setSending(true)
    setError(null)
    setRealtimeWarning(null)
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          body: text,
          replyToId: replyTo?.id ?? null,
          mentionedUserIds: mentionedUserIds.filter((id) => {
            const member = members.find((candidate) => candidate.userId === id)
            if (!member) return false
            const escapedName = member.user.firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            return new RegExp(`(?:^|\\s)@${escapedName}(?=$|[\\s.,!?])`, 'iu').test(text)
          }),
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Impossible d’envoyer le message.')

      appendMessage(result.message as MessageView)
      setBody('')
      setMentionedUserIds([])
      setReplyTo(null)
      setRealtimeWarning(result.realtimeWarning ?? null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible d’envoyer le message.')
    } finally {
      setSending(false)
    }
  }

  const filteredMembers =
    mentionQuery === null
      ? []
      : members
          .filter((member) => member.userId !== currentUserId)
          .filter((member) =>
            `${member.user.firstName} ${member.user.lastName}`
              .toLocaleLowerCase()
              .includes(mentionQuery.toLocaleLowerCase()),
          )
          .slice(0, 6)

  return (
    <Card className="flex h-[min(70dvh,760px)] min-h-[420px] flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-[var(--text-1)]">Discussion de classe</p>
          <p className="text-xs text-[var(--text-3)]">
            {unreadCount > 0 ? `${unreadCount} non lu${unreadCount > 1 ? 's' : ''}` : 'À jour'}
          </p>
        </div>
        <span
          className={`size-2 rounded-full ${realtimeConnected ? 'bg-[var(--success)]' : 'bg-[var(--warning)]'}`}
          aria-label={realtimeConnected ? 'Temps réel connecté' : 'Temps réel en attente'}
        />
      </div>

      <div
        ref={listRef}
        className="flex-1 space-y-3 overflow-y-auto p-4"
        aria-live="polite"
        aria-label="Messages de la classe"
      >
        {loading ? (
          <p className="py-8 text-center text-sm text-[var(--text-3)]">Chargement des messages…</p>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--text-3)]">
            Aucun message pour le moment. Lancez la discussion !
          </p>
        ) : (
          messages.map((message) => {
            const ownMessage = message.authorId === currentUserId
            const reply = message.replyTo
              ?? messages.find((candidate) => candidate.id === message.replyToId)
            return (
              <article
                key={message.id}
                id={`message-${message.id}`}
                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${
                  ownMessage
                    ? 'ml-auto bg-[var(--accent-soft)]'
                    : 'mr-auto bg-[var(--surface-2)]'
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--text-1)]">
                    {ownMessage
                      ? 'Vous'
                      : message.author
                        ? `${message.author.firstName} ${message.author.lastName}`
                        : 'Ancien membre'}
                  </span>
                  <time
                    className="text-[10px] text-[var(--text-3)]"
                    dateTime={new Date(message.createdAt).toISOString()}
                  >
                    {formatRelative(new Date(message.createdAt))}
                  </time>
                </div>
                {reply ? (
                  <div className="mb-2 border-l-2 border-[var(--accent)] pl-2 text-xs text-[var(--text-3)]">
                    Réponse à {reply.author?.firstName ?? 'un membre'} : {reply.body}
                  </div>
                ) : null}
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--text-1)]">
                  {renderMessageBody(message.body, message.mentions ?? [], message.mentionAll)}
                </p>
                <button
                  type="button"
                  onClick={() => setReplyTo(message)}
                  className="mt-1 text-[11px] font-medium text-[var(--accent)] hover:underline"
                  aria-label={`Répondre au message de ${message.author?.firstName ?? 'ce membre'}`}
                >
                  Répondre
                </button>
              </article>
            )
          })
        )}
      </div>

      {error ? (
        <p role="alert" className="border-t border-[var(--border)] px-4 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      {realtimeWarning ? (
        <p role="status" className="border-t border-[var(--border)] px-4 py-2 text-sm text-[var(--warning)]">
          {realtimeWarning}
        </p>
      ) : null}
      <form onSubmit={send} className="border-t border-[var(--border)] p-3">
        <div className="flex items-end gap-2">
          <div className="relative min-w-0 flex-1">
            {mentionQuery !== null && (filteredMembers.length > 0 || canMentionAll) ? (
              <ul
                role="listbox"
                aria-label="Membres à mentionner"
                className="absolute bottom-full left-0 z-10 mb-2 max-h-52 w-full overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-1 shadow-[var(--shadow-lg)]"
              >
                {canMentionAll && 'tous'.startsWith(mentionQuery.toLocaleLowerCase()) ? (
                  <li role="option" aria-selected="false">
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => insertMention(null)}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-3)]"
                    >
                      @tous <span className="text-xs text-[var(--text-3)]">Toute la classe</span>
                    </button>
                  </li>
                ) : null}
                {filteredMembers.map((member) => (
                  <li key={member.userId} role="option" aria-selected="false">
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => insertMention(member)}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-3)]"
                    >
                      @{member.user.firstName}{' '}
                      <span className="text-xs text-[var(--text-3)]">
                        {member.user.lastName}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--surface-1)] focus-within:border-[var(--accent)]">
              {replyTo ? (
                <div className="m-1 flex items-center justify-between gap-3 rounded-lg border-l-4 border-[var(--accent)] bg-[var(--surface-2)] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[var(--accent)]">
                      {replyTo.author?.firstName ?? 'Un membre'}
                    </p>
                    <p className="truncate text-sm text-[var(--text-2)]">{replyTo.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="shrink-0 px-1 text-lg leading-none text-[var(--text-3)] hover:text-[var(--text-1)]"
                    aria-label="Annuler la réponse"
                  >
                    ×
                  </button>
                </div>
              ) : null}
              <textarea
                ref={textareaRef}
                value={body}
                onChange={(event) => updateBody(event.target.value, event.target.selectionStart)}
                maxLength={2000}
                rows={2}
                placeholder="Écrire un message…"
                aria-label="Votre message"
                aria-autocomplete="list"
                className="min-h-10 w-full resize-y border-0 bg-transparent px-3 py-2 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:outline-none"
              />
            </div>
          </div>
          <Button type="submit" disabled={sending || !body.trim()}>
            {sending ? 'Envoi…' : 'Envoyer'}
          </Button>
        </div>
      </form>
    </Card>
  )
}

function renderMessageBody(
  body: string,
  mentions: MentionView[],
  mentionAll = false,
): ReactNode[] {
  const tokens = body.split(/(@[\p{L}\p{N}_-]+)/gu)
  const highlighted = new Set(
    mentions.map((mention) => `@${mention.user.firstName}`.toLocaleLowerCase()),
  )

  return tokens.map((token, index) => {
    const shouldHighlight =
      highlighted.has(token.toLocaleLowerCase()) || (mentionAll && token.toLocaleLowerCase() === '@tous')
    return shouldHighlight ? (
      <mark
        key={index}
        className="rounded bg-[var(--accent-soft)] px-0.5 text-[var(--accent-strong)]"
      >
        {token}
      </mark>
    ) : (
      token
    )
  })
}
