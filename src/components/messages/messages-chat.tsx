'use client'

import Pusher from 'pusher-js'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
/* eslint-disable @next/next/no-img-element */
import { useDirectUploads, uploadPendingLabel } from '@/components/features/direct-upload'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconClose, IconLink, IconPlus } from '@/components/ui/icons'
import { checkFile, UPLOAD_RULES } from '@/lib/uploads'
import { MESSAGE_REACTIONS } from '@/lib/messages/constants'
import { formatFileSize, formatRelative } from '@/lib/utils'

type MessageAttachmentView = {
  id: string
  fileName: string
  mimeType: string
  fileSize: number
}

type LinkPreviewView = {
  url: string
  title: string
  description: string | null
}

type SharedItemView = {
  shareType: 'announcement' | 'deadline'
  entityId: string
  title: string
  description: string | null
  url: string
}

type MessageReactionView = { userId: string; emoji: string }

type PinnedMessageView = {
  id: string
  body: string
  createdAt: string | Date
  author: { firstName: string; lastName: string } | null
  sharedItem: { title: string } | null
  linkPreview: { title: string } | null
}

type ShareOption = {
  id: string
  title: string
  description: string | null
  date: string
}

type GalleryAttachment = MessageAttachmentView & {
  createdAt: string
  message: {
    id: string
    body: string
    createdAt: string
    author: { firstName: string; lastName: string } | null
  }
}

type ReportView = {
  id: string
  reason: string
  createdAt: string
  reporter: { firstName: string; lastName: string }
  message: {
    id: string
    body: string
    author: { firstName: string; lastName: string } | null
  }
}

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
  attachments?: MessageAttachmentView[]
  linkPreview?: LinkPreviewView | null
  sharedItem?: SharedItemView | null
  reactions?: MessageReactionView[]
  pins?: { id: string; pinnedById: string }[]
  replyTo?: {
    id: string
    body: string
    author: { firstName: string; lastName: string } | null
  } | null
}

type MemberOption = {
  userId: string
  role: 'ADMIN' | 'MEMBER'
  user: { firstName: string; lastName: string; avatarUrl: string | null }
}

type TypingEvent = {
  userId: string
  firstName: string
  lastName: string
  avatarUrl: string | null
  isTyping: boolean
}

type ActiveTyping = TypingEvent & { expiresAt: number }

export function MessagesChat({
  conversationId,
  currentUserId,
  canMentionAll,
  focusMessageId,
  initialReportsOpen,
}: {
  conversationId: string
  currentUserId: string
  canMentionAll: boolean
  focusMessageId: string | null
  initialReportsOpen: boolean
}) {
  const router = useRouter()
  const { prepare, progress } = useDirectUploads()
  const [messages, setMessages] = useState<MessageView[]>([])
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessageView[]>([])
  const [members, setMembers] = useState<MemberOption[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [body, setBody] = useState('')
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([])
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [replyTo, setReplyTo] = useState<MessageView | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [shareLinkOpen, setShareLinkOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [shareTitle, setShareTitle] = useState('')
  const [shareDescription, setShareDescription] = useState('')
  const [shareContentOpen, setShareContentOpen] = useState(false)
  const [shareOptions, setShareOptions] = useState<{
    announcements: ShareOption[]
    deadlines: ShareOption[]
  }>({ announcements: [], deadlines: [] })
  const [selectedShareEntity, setSelectedShareEntity] = useState<{
    type: 'announcement' | 'deadline'
    id: string
  } | null>(null)
  const [shareOptionsLoading, setShareOptionsLoading] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryQuery, setGalleryQuery] = useState('')
  const [galleryAttachments, setGalleryAttachments] = useState<GalleryAttachment[]>([])
  const [reportsOpen, setReportsOpen] = useState(initialReportsOpen)
  const [reports, setReports] = useState<ReportView[]>([])
  const [reportMessageId, setReportMessageId] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState('')
  const [typingUsers, setTypingUsers] = useState<Record<string, ActiveTyping>>({})
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [realtimeWarning, setRealtimeWarning] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const focusedMessageRef = useRef<string | null>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingSentAtRef = useRef(0)
  const typingActiveRef = useRef(false)

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
        setPinnedMessages(result.pinnedMessages as PinnedMessageView[])
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
    const onTyping = (typing: TypingEvent) => {
      if (!active || typing.userId === currentUserId) return
      setTypingUsers((current) => {
        if (!typing.isTyping) {
          const next = { ...current }
          delete next[typing.userId]
          return next
        }
        return {
          ...current,
          [typing.userId]: { ...typing, expiresAt: Date.now() + 6000 },
        }
      })
    }
    const onMessageUpdate = () => {
      if (!active) return
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
    channel.bind('typing', onTyping)
    channel.bind('message-update', onMessageUpdate)
    pusher.connection.bind('state_change', onConnectionState)

    return () => {
      active = false
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      channel.unbind('message', onMessage)
      channel.unbind('typing', onTyping)
      channel.unbind('message-update', onMessageUpdate)
      pusher.connection.unbind('state_change', onConnectionState)
      pusher.unsubscribe(channelName)
      pusher.disconnect()
    }
  }, [appendMessage, conversationId, currentUserId, focusMessageId, router])

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now()
      setTypingUsers((current) => {
        const next = Object.fromEntries(
          Object.entries(current).filter(([, typing]) => typing.expiresAt > now),
        )
        return Object.keys(next).length === Object.keys(current).length ? current : next
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!galleryOpen) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const query = galleryQuery.trim()
        const response = await fetch(
          `/api/messages?conversationId=${encodeURIComponent(conversationId)}&attachments=1&q=${encodeURIComponent(query)}`,
          { cache: 'no-store', signal: controller.signal },
        )
        const result = await response.json()
        if (!response.ok) throw new Error(result.error ?? 'Impossible de charger les fichiers.')
        setGalleryAttachments(result.attachments as GalleryAttachment[])
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(cause instanceof Error ? cause.message : 'Impossible de charger les fichiers.')
      }
    }, 250)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [conversationId, galleryOpen, galleryQuery])

  useEffect(() => {
    if (!reportsOpen || !canMentionAll) return
    let active = true
    void fetch('/api/messages/reports', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error ?? 'Impossible de charger les signalements.')
        if (active) setReports(result.reports as ReportView[])
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Impossible de charger les signalements.')
      })
    return () => {
      active = false
    }
  }, [canMentionAll, reportsOpen])

  useEffect(() => {
    if (!focusMessageId || focusedMessageRef.current === focusMessageId) return
    const target = document.getElementById(`message-${focusMessageId}`)
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    focusedMessageRef.current = focusMessageId
  }, [focusMessageId, messages])

  function updateBody(value: string, caret: number) {
    setBody(value)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    if (value.trim()) {
      if (Date.now() - lastTypingSentAtRef.current > 2500) {
        lastTypingSentAtRef.current = Date.now()
        void sendTypingStatus(true)
      }
      typingTimeoutRef.current = setTimeout(() => {
        void sendTypingStatus(false)
      }, 1600)
    } else if (typingActiveRef.current) {
      void sendTypingStatus(false)
    }
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

  async function sendTypingStatus(isTyping: boolean) {
    typingActiveRef.current = isTyping
    if (!isTyping) lastTypingSentAtRef.current = 0
    try {
      const response = await fetch('/api/messages/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, isTyping }),
      })
      if (!response.ok) throw new Error('Indicateur de saisie indisponible.')
    } catch (cause) {
      setRealtimeWarning(cause instanceof Error ? cause.message : 'Indicateur de saisie indisponible.')
    }
  }

  function addSelectedFiles(fileList: FileList | null) {
    if (!fileList) return
    const additions = Array.from(fileList)
    const next = [...selectedFiles, ...additions]
    if (next.length > UPLOAD_RULES.message.maxFiles) {
      setError(`Ajoute au maximum ${UPLOAD_RULES.message.maxFiles} fichiers par message.`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    const invalid = additions
      .map((file) => checkFile(file, UPLOAD_RULES.message))
      .find((result) => !result.ok)
    if (invalid && !invalid.ok) {
      setError(invalid.message)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setError(null)
    setSelectedFiles(next)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeSelectedFile(index: number) {
    setSelectedFiles((current) => current.filter((_, position) => position !== index))
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

  async function loadShareOptions() {
    if (shareOptionsLoading) return
    setShareOptionsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/messages/share-options', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Impossible de charger les annonces et échéances.')
      setShareOptions(result)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de charger les contenus à partager.')
    } finally {
      setShareOptionsLoading(false)
    }
  }

  async function scrollToMessage(messageId: string) {
    let target = document.getElementById(`message-${messageId}`)
    if (!target) {
      try {
        const response = await fetch(
          `/api/messages?conversationId=${encodeURIComponent(conversationId)}&messageId=${encodeURIComponent(messageId)}`,
          { cache: 'no-store' },
        )
        const result = await response.json()
        if (!response.ok) throw new Error(result.error ?? 'Impossible de charger ce message.')
        setMessages(result.messages as MessageView[])
        target = document.getElementById(`message-${messageId}`)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Impossible de charger ce message.')
        return
      }
    }
    requestAnimationFrame(() => {
      document.getElementById(`message-${messageId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })
  }

  async function toggleReaction(message: MessageView, emoji: string) {
    try {
      const response = await fetch(`/api/messages/${encodeURIComponent(message.id)}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Impossible d’ajouter la réaction.')
      setMessages((current) =>
        current.map((item) => {
          if (item.id !== message.id) return item
          const reactions = item.reactions ?? []
          return {
            ...item,
            reactions: result.active
              ? [...reactions, { userId: currentUserId, emoji }]
              : reactions.filter(
                  (reaction) => !(reaction.userId === currentUserId && reaction.emoji === emoji),
                ),
          }
        }),
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible d’ajouter la réaction.')
    }
  }

  async function togglePin(message: MessageView) {
    try {
      const response = await fetch(`/api/messages/${encodeURIComponent(message.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pin' }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Impossible d’épingler le message.')
      const pinned = Boolean(result.pinned)
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id
            ? { ...item, pins: pinned ? [{ id: 'local', pinnedById: currentUserId }] : [] }
            : item,
        ),
      )
      setPinnedMessages((current) => {
        if (!pinned) return current.filter((item) => item.id !== message.id)
        if (current.some((item) => item.id === message.id)) return current
        return [
          {
            id: message.id,
            body: message.body,
            createdAt: message.createdAt,
            author: message.author,
            sharedItem: message.sharedItem ? { title: message.sharedItem.title } : null,
            linkPreview: message.linkPreview ? { title: message.linkPreview.title } : null,
          },
          ...current,
        ].slice(0, 10)
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible d’épingler le message.')
    }
  }

  async function deleteMessage(message: MessageView) {
    if (!window.confirm('Supprimer ce message et ses pièces jointes ? Cette action est définitive.')) {
      return
    }
    try {
      const response = await fetch(`/api/messages/${encodeURIComponent(message.id)}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error ?? 'Impossible de supprimer le message.')
      }
      setMessages((current) => current.filter((item) => item.id !== message.id))
      setPinnedMessages((current) => current.filter((item) => item.id !== message.id))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de supprimer le message.')
    }
  }

  async function submitReport(messageId: string) {
    try {
      const response = await fetch(`/api/messages/${encodeURIComponent(messageId)}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reportReason }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Impossible de signaler le message.')
      setReportMessageId(null)
      setReportReason('')
      setError(null)
      setStatusMessage('Signalement envoyé au délégué.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de signaler le message.')
    }
  }

  async function toggleReports() {
    setReportsOpen((open) => !open)
  }

  async function resolveReport(reportId: string) {
    try {
      const response = await fetch('/api/messages/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId }),
      })
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error ?? 'Impossible de traiter le signalement.')
      }
      setReports((current) => current.filter((report) => report.id !== reportId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de traiter le signalement.')
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = body.trim()
    const url = shareLinkOpen ? shareUrl.trim() : ''
    if (shareLinkOpen && !url) {
      setError('Ajoute une adresse web pour partager un lien.')
      return
    }
    const linkPreview = url
      ? {
          url,
          title: shareTitle.trim() || safeUrlHost(url),
          description: shareDescription.trim(),
        }
      : null
    if ((!text && selectedFiles.length === 0 && !linkPreview) || sending) return

    setSending(true)
    setError(null)
    setRealtimeWarning(null)
    try {
      const formData = new FormData()
      formData.set('conversationId', conversationId)
      formData.set('body', text)
      formData.set('replyToId', replyTo?.id ?? '')
      formData.set(
        'mentionedUserIds',
        JSON.stringify(
          mentionedUserIds.filter((id) => {
            const member = members.find((candidate) => candidate.userId === id)
            if (!member) return false
            const escapedName = member.user.firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            return new RegExp(`(?:^|\\s)@${escapedName}(?=$|[\\s.,!?])`, 'iu').test(text)
          }),
        ),
      )
      if (linkPreview) formData.set('sharedLink', JSON.stringify(linkPreview))
      if (selectedShareEntity) {
        formData.set('sharedEntity', JSON.stringify(selectedShareEntity))
      }
      for (const file of selectedFiles) formData.append('attachments', file)

      const uploadError = await prepare(formData, {
        field: 'attachments',
        kind: 'message',
        forceDirect: true,
      })
      if (uploadError) throw new Error(uploadError)

      const response = await fetch('/api/messages', {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Impossible d’envoyer le message.')

      appendMessage(result.message as MessageView)
      setBody('')
      setMentionedUserIds([])
      setReplyTo(null)
      setSelectedFiles([])
      setShareLinkOpen(false)
      setShareUrl('')
      setShareTitle('')
      setShareDescription('')
      setSelectedShareEntity(null)
      setShareContentOpen(false)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      if (typingActiveRef.current) void sendTypingStatus(false)
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
  const canSend = Boolean(
    body.trim() ||
      selectedFiles.length > 0 ||
      (shareLinkOpen && shareUrl.trim()) ||
      selectedShareEntity,
  )
  const attachmentAccept = Object.values(UPLOAD_RULES.message.mimeTypes).flat().join(',')

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

      {pinnedMessages.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
          <span className="shrink-0 self-center text-xs font-semibold text-[var(--accent)]">
            Épinglés
          </span>
          {pinnedMessages.map((message) => (
            <button
              key={message.id}
              type="button"
              onClick={() => void scrollToMessage(message.id)}
              className="max-w-52 shrink-0 truncate rounded-lg bg-[var(--surface-1)] px-2.5 py-1.5 text-left text-xs text-[var(--text-2)] hover:text-[var(--text-1)]"
              title={message.body || message.sharedItem?.title || message.linkPreview?.title}
            >
              {message.body || message.sharedItem?.title || message.linkPreview?.title || 'Message'}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-[var(--border)] px-3 py-2">
        <Button
          type="button"
          size="sm"
          variant={galleryOpen ? 'subtle' : 'ghost'}
          onClick={() => setGalleryOpen((open) => !open)}
        >
          Fichiers partagés
        </Button>
        {canMentionAll ? (
          <Button
            type="button"
            size="sm"
            variant={reportsOpen ? 'subtle' : 'ghost'}
            onClick={() => void toggleReports()}
          >
            Signalements
          </Button>
        ) : null}
      </div>

      {galleryOpen ? (
        <section className="max-h-56 shrink-0 space-y-2 overflow-y-auto border-b border-[var(--border)] bg-[var(--surface-2)] p-3" aria-label="Fichiers partagés">
          <input
            type="search"
            value={galleryQuery}
            onChange={(event) => setGalleryQuery(event.target.value)}
            placeholder="Rechercher un fichier…"
            aria-label="Rechercher dans les fichiers partagés"
            className="h-9 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:border-[var(--accent)] focus:outline-none"
          />
          {galleryAttachments.length === 0 ? (
            <p className="py-2 text-center text-xs text-[var(--text-3)]">
              Aucun fichier partagé correspondant.
            </p>
          ) : (
            <ul className="grid gap-1 sm:grid-cols-2">
              {galleryAttachments.map((attachment) => (
                <li key={attachment.id}>
                  <a
                    href={`/api/messages/attachments/${encodeURIComponent(attachment.id)}/download`}
                    className="flex items-center justify-between gap-2 rounded-lg bg-[var(--surface-1)] px-3 py-2 text-xs hover:bg-[var(--surface-3)]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-[var(--text-1)]">
                        {attachment.fileName}
                      </span>
                      <span className="text-[var(--text-3)]">
                        {attachment.message.author?.firstName ?? 'Membre'} · {formatRelative(new Date(attachment.createdAt))}
                      </span>
                    </span>
                    <span className="shrink-0 text-[var(--text-3)]">
                      {formatFileSize(attachment.fileSize)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {reportsOpen && canMentionAll ? (
        <section className="max-h-56 shrink-0 space-y-2 overflow-y-auto border-b border-[var(--border)] bg-[var(--surface-2)] p-3" aria-label="Signalements à traiter">
          {reports.length === 0 ? (
            <p className="py-2 text-center text-xs text-[var(--text-3)]">
              Aucun signalement en attente.
            </p>
          ) : (
            reports.map((report) => (
              <article key={report.id} className="rounded-lg bg-[var(--surface-1)] p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--text-1)]">
                      Signalé par {report.reporter.firstName} {report.reporter.lastName}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-2)]">{report.reason}</p>
                    <p className="mt-1 truncate text-xs text-[var(--text-3)]">
                      Message de {report.message.author?.firstName ?? 'un membre'} : {report.message.body}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => void scrollToMessage(report.message.id)}
                      className="text-xs font-medium text-[var(--accent)] hover:underline"
                    >
                      Voir
                    </button>
                    <button
                      type="button"
                      onClick={() => void resolveReport(report.id)}
                      className="text-xs font-medium text-[var(--success)] hover:underline"
                    >
                      Traiter
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      ) : null}

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
                {message.body ? (
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--text-1)]">
                    {renderMessageBody(message.body, message.mentions ?? [], message.mentionAll)}
                  </p>
                ) : null}
                {message.linkPreview ? (
                  <a
                    href={message.linkPreview.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-2 block overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-1)]"
                  >
                    <div className="space-y-1 px-3 py-2.5">
                      <p className="text-sm font-semibold text-[var(--text-1)]">
                        {message.linkPreview.title}
                      </p>
                      {message.linkPreview.description ? (
                        <p className="whitespace-pre-wrap text-xs text-[var(--text-2)]">
                          {message.linkPreview.description}
                        </p>
                      ) : null}
                      <p className="break-all text-[11px] text-[var(--accent)]">
                        {safeUrlHost(message.linkPreview.url)} · Ouvrir le lien
                      </p>
                    </div>
                  </a>
                ) : null}
                {message.sharedItem ? (
                  <a
                    href={message.sharedItem.url}
                    className="mt-2 block rounded-lg border border-[var(--accent-border)] bg-[var(--surface-1)] px-3 py-2.5 hover:bg-[var(--surface-3)]"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                      {message.sharedItem.shareType === 'announcement' ? 'Annonce partagée' : 'Échéance partagée'}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[var(--text-1)]">
                      {message.sharedItem.title}
                    </p>
                    {message.sharedItem.description ? (
                      <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-[var(--text-2)]">
                        {message.sharedItem.description}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-[var(--accent)]">Ouvrir dans Classroom</p>
                  </a>
                ) : null}
                {message.attachments?.length ? (
                  <div className="mt-2 space-y-2">
                    {message.attachments.map((attachment) => {
                      const href = `/api/messages/attachments/${encodeURIComponent(attachment.id)}/download`
                      if (
                        attachment.mimeType.startsWith('image/') &&
                        !/image\/hei[cf]/i.test(attachment.mimeType)
                      ) {
                        return (
                          <a
                            key={attachment.id}
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="block overflow-hidden rounded-lg"
                          >
                            <img
                              src={href}
                              alt={attachment.fileName}
                              className="max-h-72 max-w-full rounded-lg object-contain"
                            />
                          </a>
                        )
                      }
                      if (attachment.mimeType.startsWith('video/')) {
                        return (
                          <video
                            key={attachment.id}
                            src={href}
                            controls
                            preload="metadata"
                            className="max-h-72 max-w-full rounded-lg"
                          >
                            La lecture de cette vidéo n’est pas prise en charge.
                          </video>
                        )
                      }
                      return (
                        <a
                          key={attachment.id}
                          href={href}
                          className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-xs text-[var(--text-1)] hover:bg-[var(--surface-3)]"
                        >
                          <span className="min-w-0 truncate">{attachment.fileName}</span>
                          <span className="shrink-0 text-[var(--text-3)]">
                            {formatFileSize(attachment.fileSize)}
                          </span>
                        </a>
                      )
                    })}
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {MESSAGE_REACTIONS.map((emoji) => {
                    const matching = (message.reactions ?? []).filter(
                      (reaction) => reaction.emoji === emoji,
                    )
                    const active = matching.some((reaction) => reaction.userId === currentUserId)
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => void toggleReaction(message, emoji)}
                        aria-label={`${active ? 'Retirer' : 'Ajouter'} la réaction ${emoji}${matching.length ? `, ${matching.length}` : ''}`}
                        aria-pressed={active}
                        className={`rounded-full border px-2 py-0.5 text-xs ${
                          active
                            ? 'border-[var(--accent-border)] bg-[var(--accent-soft)]'
                            : 'border-[var(--border)] bg-[var(--surface-1)] hover:bg-[var(--surface-3)]'
                        }`}
                      >
                        {emoji}{matching.length ? ` ${matching.length}` : ''}
                      </button>
                    )
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTo(message)}
                  className="mt-1 text-[11px] font-medium text-[var(--accent)] hover:underline"
                  aria-label={`Répondre au message de ${message.author?.firstName ?? 'ce membre'}`}
                >
                  Répondre
                </button>
                <div className="mt-1 flex flex-wrap gap-3">
                  {canMentionAll ? (
                    <button
                      type="button"
                      onClick={() => void togglePin(message)}
                      aria-pressed={Boolean(message.pins?.length)}
                      className="text-[11px] font-medium text-[var(--text-3)] hover:text-[var(--accent)]"
                    >
                      {message.pins?.length ? 'Désépingler' : 'Épingler'}
                    </button>
                  ) : null}
                  {message.authorId === currentUserId ? (
                    <button
                      type="button"
                      onClick={() => void deleteMessage(message)}
                      className="text-[11px] font-medium text-[var(--text-3)] hover:text-[var(--danger)]"
                    >
                      Supprimer
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setReportMessageId((current) => current === message.id ? null : message.id)
                        setReportReason('')
                        setStatusMessage(null)
                      }}
                      className="text-[11px] font-medium text-[var(--text-3)] hover:text-[var(--warning)]"
                    >
                      Signaler
                    </button>
                  )}
                </div>
                {reportMessageId === message.id ? (
                  <form
                    className="mt-2 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-2"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void submitReport(message.id)
                    }}
                  >
                    <textarea
                      required
                      minLength={3}
                      maxLength={500}
                      value={reportReason}
                      onChange={(event) => setReportReason(event.target.value)}
                      placeholder="Explique brièvement le problème…"
                      aria-label="Motif du signalement"
                      rows={2}
                      className="w-full resize-y rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 py-1.5 text-xs text-[var(--text-1)] focus:border-[var(--accent)] focus:outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setReportMessageId(null)}
                        className="text-xs text-[var(--text-3)]"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={reportReason.trim().length < 3}
                        className="text-xs font-semibold text-[var(--accent)] disabled:opacity-50"
                      >
                        Envoyer le signalement
                      </button>
                    </div>
                  </form>
                ) : null}
              </article>
            )
          })
        )}
        {Object.values(typingUsers).length > 0 ? (
          <div
            role="status"
            aria-live="polite"
            className="mr-auto flex max-w-[88%] items-center gap-2 py-1"
          >
            <div className="flex -space-x-2">
              {Object.values(typingUsers)
                .slice(0, 3)
                .map((typing) => (
                  <Avatar
                    key={typing.userId}
                    firstName={typing.firstName}
                    lastName={typing.lastName}
                    src={typing.avatarUrl}
                    size="sm"
                    className="ring-2 ring-[var(--surface-1)]"
                  />
                ))}
            </div>
            <div
              className="flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-3 py-2"
              aria-label={
                Object.keys(typingUsers).length === 1
                  ? `${Object.values(typingUsers)[0].firstName} écrit`
                  : `${Object.keys(typingUsers).length} personnes écrivent`
              }
            >
              <span className="size-1.5 animate-bounce rounded-full bg-[var(--text-3)] [animation-delay:-0.2s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-[var(--text-3)] [animation-delay:-0.1s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-[var(--text-3)]" />
            </div>
            {Object.keys(typingUsers).length > 1 ? (
              <span className="text-xs text-[var(--text-3)]">
                {Object.keys(typingUsers).length} personnes écrivent…
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="border-t border-[var(--border)] px-4 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      {statusMessage ? (
        <p role="status" className="border-t border-[var(--border)] px-4 py-2 text-sm text-[var(--success)]">
          {statusMessage}
        </p>
      ) : null}
      {realtimeWarning ? (
        <p role="status" className="border-t border-[var(--border)] px-4 py-2 text-sm text-[var(--warning)]">
          {realtimeWarning}
        </p>
      ) : null}
      <form onSubmit={send} className="border-t border-[var(--border)] p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={attachmentAccept}
            className="sr-only"
            onChange={(event) => addSelectedFiles(event.target.files)}
            aria-label="Ajouter des documents, photos ou vidéos"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Ajouter des documents, photos ou vidéos"
            title="Ajouter des documents, photos ou vidéos (100 Mo maximum par fichier)"
          >
            <IconPlus />
          </Button>
          <Button
            type="button"
            variant={shareLinkOpen ? 'subtle' : 'ghost'}
            onClick={() => {
              const open = !shareLinkOpen
              setShareLinkOpen(open)
              if (open) {
                setShareContentOpen(false)
                setSelectedShareEntity(null)
              }
            }}
          >
            <IconLink />
            Partager un lien web
          </Button>
          <Button
            type="button"
            variant={shareContentOpen ? 'subtle' : 'ghost'}
            onClick={() => {
              const open = !shareContentOpen
              setShareContentOpen(open)
              if (open) {
                setShareLinkOpen(false)
                setShareUrl('')
                void loadShareOptions()
              }
            }}
          >
            Partager une annonce ou une échéance
          </Button>
          {progress !== null ? (
            <span className="text-xs text-[var(--text-3)]">
              {uploadPendingLabel(progress, 'Envoi…')}
            </span>
          ) : null}
        </div>
        {shareContentOpen ? (
          <div className="mb-2 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
            {shareOptionsLoading ? (
              <p className="text-xs text-[var(--text-3)]">Chargement des contenus…</p>
            ) : (
              <select
                value={selectedShareEntity ? `${selectedShareEntity.type}:${selectedShareEntity.id}` : ''}
                onChange={(event) => {
                  const [type, id] = event.target.value.split(':')
                  setSelectedShareEntity(
                    (type === 'announcement' || type === 'deadline') && id ? { type, id } : null,
                  )
                }}
                aria-label="Choisir une annonce ou une échéance à partager"
                className="h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 text-sm text-[var(--text-1)] focus:border-[var(--accent)] focus:outline-none"
              >
                <option value="">Choisir un contenu de la classe…</option>
                <optgroup label="Annonces">
                  {shareOptions.announcements.map((item) => (
                    <option key={item.id} value={`announcement:${item.id}`}>{item.title}</option>
                  ))}
                </optgroup>
                <optgroup label="Échéances à venir">
                  {shareOptions.deadlines.map((item) => (
                    <option key={item.id} value={`deadline:${item.id}`}>{item.title}</option>
                  ))}
                </optgroup>
              </select>
            )}
            {selectedShareEntity ? (
              <p className="text-xs text-[var(--text-2)]">
                {selectedShareEntity.type === 'announcement'
                  ? 'Cette annonce sera affichée dans la discussion comme une carte partageable.'
                  : 'Cette échéance sera affichée dans la discussion comme une carte partageable.'}
              </p>
            ) : null}
          </div>
        ) : null}
        {shareLinkOpen ? (
          <div className="mb-2 grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <input
              type="url"
              required
              value={shareUrl}
              onChange={(event) => setShareUrl(event.target.value)}
              maxLength={2048}
              placeholder="https://…"
              aria-label="Adresse du lien à partager"
              className="h-10 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:border-[var(--accent)] focus:outline-none"
            />
            {shareUrl ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2">
                <p className="text-sm font-semibold text-[var(--text-1)]">
                  {shareTitle.trim() || safeUrlHost(shareUrl)}
                </p>
                {shareDescription.trim() ? (
                  <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--text-2)]">
                    {shareDescription}
                  </p>
                ) : null}
                <p className="mt-1 break-all text-[11px] text-[var(--accent)]">
                  {safeUrlHost(shareUrl)}
                </p>
              </div>
            ) : null}
            <input
              type="text"
              value={shareTitle}
              onChange={(event) => setShareTitle(event.target.value)}
              maxLength={120}
              placeholder="Titre du lien (facultatif)"
              aria-label="Titre de l’aperçu du lien"
              className="h-10 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:border-[var(--accent)] focus:outline-none"
            />
            <input
              type="text"
              value={shareDescription}
              onChange={(event) => setShareDescription(event.target.value)}
              maxLength={300}
              placeholder="Description (facultative)"
              aria-label="Description de l’aperçu du lien"
              className="h-10 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
        ) : null}
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
              {selectedFiles.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5 p-2" aria-label="Fichiers à joindre">
                  {selectedFiles.map((file, index) => (
                    <li
                      key={`${file.name}-${file.lastModified}-${index}`}
                      className="flex min-w-0 items-center gap-1 rounded-lg bg-[var(--surface-2)] px-2 py-1 text-[11px] text-[var(--text-2)]"
                    >
                      <span className="max-w-40 truncate">{file.name}</span>
                      <span className="shrink-0 text-[var(--text-3)]">
                        {formatFileSize(file.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeSelectedFile(index)}
                        aria-label={`Retirer ${file.name}`}
                        className="ml-1 text-[var(--text-3)] hover:text-[var(--text-1)]"
                      >
                        <IconClose className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
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
          <Button type="submit" disabled={sending || !canSend}>
            {sending ? uploadPendingLabel(progress, 'Envoi…') : 'Envoyer'}
          </Button>
        </div>
      </form>
    </Card>
  )
}

function safeUrlHost(value: string): string {
  try {
    const url = new URL(value)
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.hostname
  } catch {
    return value
  }
  return value
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
