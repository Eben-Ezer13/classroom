import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { resolveJoinCode, type JoinTarget } from '@/lib/services/classes'
import { AppError } from '@/lib/errors'
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
  const rawCode = (params.code ?? '').trim().toUpperCase()
  const code =
    rawCode && /^[A-Z0-9]{4,40}$/.test(rawCode)
      ? rawCode
      : inviteCodeFromNext(next) ?? inviteCodeFromNext(`/rejoindre?code=${params.code ?? ''}`)

  let targetClass: JoinTarget | null = null
  let codeError: string | null = null

  if (code) {
    try {
      targetClass = await resolveJoinCode(code)
    } catch (err) {
      codeError = err instanceof AppError ? err.message : 'Code d’invitation invalide ou expiré.'
    }
  }

  const loginHref = code
    ? `/login?next=${encodeURIComponent(`/rejoindre?code=${code}`)}`
    : next
      ? `/login?next=${encodeURIComponent(next)}`
      : '/login'

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[var(--text-1)]">
          {targetClass ? 'Rejoindre la classe' : 'Créer un compte'}
        </h1>
        <p className="text-[13.5px] text-[var(--text-3)] mt-1.5">
          {targetClass
            ? `Créez votre compte pour rejoindre directement ${targetClass.className}.`
            : 'Rejoignez votre classe avec le code fourni par votre délégué.'}
        </p>
      </div>

      <RegisterForm
        defaultClassCode={code}
        next={next}
        targetClass={targetClass}
        codeError={codeError}
      />

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
