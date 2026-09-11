import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { inviteCodeFromNext, safeNextPath } from '@/lib/utils'
import { RegisterForm } from './register-form'

export const metadata: Metadata = { title: 'Créer un compte' }

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; code?: string }>
}) {
  const params = await searchParams
  const next = safeNextPath(params.next)

  if (await getCurrentUser()) redirect(next ?? '/dashboard')

  // Arrivee depuis un lien d'invitation : le code est pre-rempli et le
  // compte rejoint la classe des sa creation.
  const code = inviteCodeFromNext(next) ?? inviteCodeFromNext(`/rejoindre?code=${params.code ?? ''}`)
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : '/login'

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[var(--text-1)]">
          Créer un compte
        </h1>
        <p className="text-[13.5px] text-[var(--text-3)] mt-1.5">
          Rejoignez votre classe avec le code fourni par votre délégué.
        </p>
      </div>

      <RegisterForm defaultClassCode={code} next={next} />

      <p className="mt-6 text-center text-[13px] text-[var(--text-3)]">
        Déjà inscrit ?{' '}
        <Link
          href={loginHref}
          className="text-[var(--accent)] font-medium hover:underline underline-offset-2"
        >
          Se connecter
        </Link>
      </p>
    </div>
  )
}
