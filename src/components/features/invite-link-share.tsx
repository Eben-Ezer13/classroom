'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { IconCheck, IconLink, IconUsers } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

export type InviteLinkShareProps = {
  code: string
  className?: string
  schoolName?: string
  variant?: 'primary' | 'secondary' | 'ghost' | 'subtle'
  size?: 'sm' | 'md' | 'lg'
  label?: string
  fullMessage?: boolean
}

function getInviteUrl(code: string): string {
  if (typeof window !== 'undefined' && window.location.origin) {
    return `${window.location.origin}/rejoindre?code=${code}`
  }
  return `/rejoindre?code=${code}`
}

/**
 * Bouton de copie / partage du lien d'invitation direct de la classe.
 */
export function CopyInviteLinkButton({
  code,
  className,
  variant = 'primary',
  size = 'sm',
  label = 'Copier le lien d’invitation',
  fullMessage = false,
}: InviteLinkShareProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const url = getInviteUrl(code)
    const textToCopy = fullMessage
      ? `Rejoins notre classe sur Classroom : ${url}`
      : url

    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      // Si refusé ou context non sécurisé, sélectionne ou affiche prompt
      window.prompt('Copiez le lien d’invitation ci-dessous :', textToCopy)
    }
  }

  const handleShare = async () => {
    const url = getInviteUrl(code)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Rejoindre la classe sur Classroom',
          text: 'Rejoins notre classe sur Classroom via ce lien :',
          url,
        })
        return
      } catch {
        // Annulé ou non supporté, on bascule sur la copie
      }
    }
    handleCopy()
  }

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <Button
        type="button"
        variant={copied ? 'secondary' : variant}
        size={size}
        onClick={handleCopy}
        className={cn(
          'transition-all duration-200',
          copied && 'border-[var(--success-border)] text-[var(--success-strong)] bg-[var(--success-soft)]',
        )}
      >
        {copied ? (
          <>
            <IconCheck className="size-4 text-[var(--success)] animate-scale-in" />
            <span>Lien copié !</span>
          </>
        ) : (
          <>
            <IconLink className="size-4" />
            <span>{label}</span>
          </>
        )}
      </Button>

      {canShare ? (
        <Button
          type="button"
          variant="secondary"
          size={size}
          onClick={handleShare}
          title="Partager sur WhatsApp, message..."
        >
          Partager
        </Button>
      ) : null}
    </div>
  )
}

/**
 * Bannière d'invitation complète pour le tableau de bord ou l'espace administration.
 */
export function InviteBanner({
  code,
  className,
  schoolName,
}: {
  code: string
  className?: string | null
  schoolName?: string | null
}) {
  return (
    <div className="rounded-2xl border border-[var(--accent-border)] bg-[var(--surface-1)] p-4 sm:p-5 shadow-[var(--shadow-sm)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex items-start gap-3.5">
        <span className="size-10 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] grid place-items-center shrink-0 mt-0.5">
          <IconUsers className="size-5" />
        </span>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[14.5px] font-semibold text-[var(--text-1)]">
              Inviter les étudiants
            </h3>
            <span className="inline-flex items-center rounded-md bg-[var(--surface-3)] px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-[var(--text-2)]">
              CODE : {code}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-[var(--text-3)] leading-relaxed max-w-xl">
            Envoyez simplement le lien d’invitation : vos étudiants n’auront qu’à créer leur
            compte pour rejoindre immédiatement {className ? <strong>{className}</strong> : 'votre classe'}
            {schoolName ? <> à <strong>{schoolName}</strong></> : null}.
          </p>
        </div>
      </div>

      <div className="w-full md:w-auto shrink-0 flex items-center justify-end">
        <CopyInviteLinkButton
          code={code}
          variant="primary"
          size="md"
          label="Copier le lien d’invitation"
          className="w-full md:w-auto"
        />
      </div>
    </div>
  )
}
