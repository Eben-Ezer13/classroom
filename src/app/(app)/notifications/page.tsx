import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePageUser } from '@/lib/auth/guards'
import { prisma } from '@/lib/db'
import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/feedback'
import { Pagination } from '@/components/ui/pagination'
import { Badge } from '@/components/ui/badge'
import { ConfirmForm, IconSubmit } from '@/components/ui/confirm-form'
import { buttonClasses } from '@/components/ui/button'
import { IconBell, IconCheck, IconTrash } from '@/components/ui/icons'
import { NOTIFICATION_TYPE_LABELS, PAGE_SIZE } from '@/lib/constants'
import { cn, formatRelative } from '@/lib/utils'
import {
  deleteNotificationAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '@/app/actions/notifications'

export const metadata: Metadata = { title: 'Notifications' }

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filtre?: string }>
}) {
  const user = await requirePageUser()
  const params = await searchParams
  const onlyUnread = params.filtre === 'non-lues'
  const pageRaw = Number(params.page ?? '1')
  const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1

  const where = {
    userId: user.id,
    ...(onlyUnread ? { readAt: null } : {}),
  }

  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ])

  return (
    <>
      <PageHeader
        title="Notifications"
        description={
          unread > 0
            ? `${unread} notification${unread > 1 ? 's' : ''} non lue${unread > 1 ? 's' : ''}.`
            : 'Tout est à jour.'
        }
        actions={
          unread > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <button type="submit" className={buttonClasses('secondary', 'sm')}>
                <IconCheck className="size-4" />
                Tout marquer comme lu
              </button>
            </form>
          ) : null
        }
      />

      <div className="flex items-center gap-1.5 mb-4">
        <Link
          href="/notifications"
          className={cn(
            'rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
            !onlyUnread
              ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]'
              : 'text-[var(--text-2)] hover:bg-[var(--surface-3)]',
          )}
        >
          Toutes
        </Link>
        <Link
          href="/notifications?filtre=non-lues"
          className={cn(
            'rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
            onlyUnread
              ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]'
              : 'text-[var(--text-2)] hover:bg-[var(--surface-3)]',
          )}
        >
          Non lues {unread > 0 ? `(${unread})` : ''}
        </Link>
      </div>

      <Card>
        {items.length === 0 ? (
          <EmptyState
            icon={<IconBell />}
            title={onlyUnread ? 'Aucune notification non lue' : 'Aucune notification'}
            description={
              onlyUnread
                ? 'Vous avez tout consulte.'
                : 'Les nouvelles ressources, annonces et echeances apparaitront ici.'
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-[var(--border)]">
              {items.map((notification) => {
                const isUnread = notification.readAt === null
                return (
                  <li
                    key={notification.id}
                    className={cn(
                      'flex items-start gap-3 p-4 transition-colors',
                      isUnread ? 'bg-[var(--accent-soft)]/40' : 'hover:bg-[var(--surface-2)]',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-1.5 size-2 rounded-full shrink-0',
                        isUnread ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]',
                      )}
                      aria-hidden="true"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className={cn(
                            'text-[14px] leading-snug',
                            isUnread
                              ? 'font-semibold text-[var(--text-1)]'
                              : 'font-medium text-[var(--text-2)]',
                          )}
                        >
                          {notification.title}
                        </p>
                        <Badge>
                          {NOTIFICATION_TYPE_LABELS[notification.type] ?? notification.type}
                        </Badge>
                      </div>

                      {notification.body ? (
                        <p className="mt-1 text-[13px] text-[var(--text-2)] leading-relaxed">
                          {notification.body}
                        </p>
                      ) : null}

                      <div className="mt-1.5 flex items-center gap-3">
                        <span className="text-[12px] text-[var(--text-3)]">
                          {formatRelative(notification.createdAt)}
                        </span>
                        {notification.url ? (
                          <Link
                            href={notification.url}
                            className="text-[12px] font-medium text-[var(--accent)] hover:underline underline-offset-2"
                          >
                            Ouvrir
                          </Link>
                        ) : null}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-0.5">
                      {isUnread ? (
                        <form action={markNotificationReadAction}>
                          <input
                            type="hidden"
                            name="notificationId"
                            value={notification.id}
                          />
                          <IconSubmit label="Marquer comme lue">
                            <IconCheck className="size-[17px]" />
                          </IconSubmit>
                        </form>
                      ) : null}
                      <ConfirmForm
                        action={deleteNotificationAction}
                        hidden={{ notificationId: notification.id }}
                        message="Supprimer cette notification ?"
                      >
                        <IconSubmit label="Supprimer" tone="danger">
                          <IconTrash className="size-[17px]" />
                        </IconSubmit>
                      </ConfirmForm>
                    </div>
                  </li>
                )
              })}
            </ul>
            <Pagination
              page={page}
              pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
              total={total}
              basePath="/notifications"
              params={{ filtre: onlyUnread ? 'non-lues' : undefined }}
            />
          </>
        )}
      </Card>
    </>
  )
}
