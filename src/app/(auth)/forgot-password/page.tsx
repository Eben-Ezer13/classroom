import type { Metadata } from 'next'
import Link from 'next/link'
import { ForgotPasswordForm } from './forgot-form'

export const metadata: Metadata = { title: 'Mot de passe oublie' }

export default function ForgotPasswordPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[var(--text-1)]">
          Mot de passe oublie
        </h1>
        <p className="text-[13.5px] text-[var(--text-3)] mt-1.5">
          Indiquez votre adresse : vous recevrez un lien de reinitialisation
          valable une heure.
        </p>
      </div>

      <ForgotPasswordForm />

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
