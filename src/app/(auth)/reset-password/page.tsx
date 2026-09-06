import type { Metadata } from 'next'
import Link from 'next/link'
import { ResetPasswordForm } from './reset-form'
import { Alert } from '@/components/ui/feedback'

export const metadata: Metadata = { title: 'Nouveau mot de passe' }

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[var(--text-1)]">
          Nouveau mot de passe
        </h1>
        <p className="text-[13.5px] text-[var(--text-3)] mt-1.5">
          Choisissez un mot de passe solide et unique.
        </p>
      </div>

      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Alert tone="danger">
          Lien incomplet : le jeton de réinitialisation est absent de l’URL.
          Refaites une demande depuis la page « mot de passe oublié ».
        </Alert>
      )}

      <p className="mt-6 text-center text-[13px] text-[var(--text-3)]">
        <Link
          href="/login"
          className="text-[var(--accent)] font-medium hover:underline underline-offset-2"
        >
          Retour a la connexion
        </Link>
      </p>
    </div>
  )
}
