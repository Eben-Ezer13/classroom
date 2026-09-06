import type { Metadata } from 'next'
import Link from 'next/link'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Connexion' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; next?: string }>
}) {
  const params = await searchParams
  const notice =
    params.reason === 'password-changed'
      ? 'Mot de passe modifié. Reconnectez-vous.'
      : params.reason === 'reset'
        ? 'Mot de passe réinitialisé. Vous pouvez vous connecter.'
        : null

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[var(--text-1)]">
          Connexion
        </h1>
        <p className="text-[13.5px] text-[var(--text-3)] mt-1.5">
          Accédez à votre espace de classe.
        </p>
      </div>

      <LoginForm notice={notice} />

      <p className="mt-6 text-center text-[13px] text-[var(--text-3)]">
        Pas encore de compte ?{' '}
        <Link
          href="/register"
          className="text-[var(--accent)] font-medium hover:underline underline-offset-2"
        >
          Créer un compte
        </Link>
      </p>
    </div>
  )
}
