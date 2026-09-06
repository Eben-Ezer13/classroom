import 'server-only'

/**
 * Transport d'emails enfichable.
 *
 * - En developpement, MAIL_DRIVER=console ecrit le message dans les logs.
 * - En production, seul Resend est accepte afin qu'un lien sensible ne soit
 *   jamais journalise et que la remise soit effectivement configuree.
 * - Avec RESEND_API_KEY renseignee, les emails partent reellement.
 *
 * Aucune dependance npm : un simple appel HTTP suffit.
 */

type Mail = {
  to: string
  subject: string
  text: string
}

export async function sendMail(mail: Mail): Promise<void> {
  const driver = process.env.MAIL_DRIVER?.trim() || 'console'

  if (driver === 'resend') {
    const apiKey = process.env.RESEND_API_KEY?.trim()
    const from = process.env.MAIL_FROM?.trim()
    if (!apiKey || !from) {
      throw new Error(
        'MAIL_DRIVER=resend necessite RESEND_API_KEY et MAIL_FROM.',
      )
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
      }),
    })
    if (!response.ok) {
      const detail = await response.text()
      throw new Error(`Envoi email echoue (${response.status}) : ${detail}`)
    }
    return
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('MAIL_DRIVER=resend est requis en production.')
  }

  console.info(
    [
      '',
      '──────────── EMAIL (driver console) ────────────',
      `A       : ${mail.to}`,
      `Objet   : ${mail.subject}`,
      '',
      mail.text,
      '────────────────────────────────────────────────',
      '',
    ].join('\n'),
  )
}
