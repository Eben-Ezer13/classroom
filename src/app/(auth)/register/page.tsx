import type { Metadata } from 'next'
import Link from 'next/link'
import { RegisterForm } from './register-form'

export const metadata: Metadata = { title: 'Créer un compte' }

export default function RegisterPage() {
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

      <RegisterForm />

      <p className="mt-6 text-center text-[13px] text-[var(--text-3)]">
        Déjà inscrit ?{' '}
        <Link
          href="/login"
          className="text-[var(--accent)] font-medium hover:underline underline-offset-2"
        >
          Se connecter
        </Link>
      </p>
    </div>
  )
}
