'use server'

import { createHash, randomBytes } from 'crypto'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import {
  clearSessionCookie,
  createSession,
  destroySession,
  pruneExpiredSessions,
  revokeAllSessions,
} from '@/lib/auth/session'
import { requireUser } from '@/lib/auth/guards'
import { sendMail } from '@/lib/mailer'
import { recordAudit } from '@/lib/audit'
import { notifyClassStaff } from '@/lib/notifications'
import { assertFileAllowed, removeFile, storeFile } from '@/lib/storage'
import { AVATAR_RULE } from '@/lib/uploads'
import { joinClass, resolveJoinCode, type JoinTarget } from '@/lib/services/classes'
import { AppError, runAction, type ActionState } from '@/lib/errors'
import { RESET_TOKEN_DURATION_MINUTES } from '@/lib/constants'
import { env } from '@/lib/env'
import {
  RATE_LIMITS,
  clearRateLimit,
  clientIp,
  formatRetryAfter,
  hitRateLimit,
  peekRateLimit,
  rateLimitKey,
} from '@/lib/rate-limit'
import { safeNextPath } from '@/lib/utils'
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  parseForm,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '@/lib/validation'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// ---------------------------------------------------------------------------
// Inscription
// ---------------------------------------------------------------------------

export async function registerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const parsed = parseForm(registerSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }
    const data = parsed.data
    const next = safeNextPath(formData.get('next'))

    // Anti creation de comptes en masse. La limite reste large : toute une
    // classe s'inscrit souvent le meme jour, depuis le meme reseau.
    const ip = await clientIp()
    if (ip) {
      const status = await hitRateLimit(`register:ip:${ip}`, RATE_LIMITS.registerPerIp)
      if (status.limited) {
        return {
          ok: false,
          message: `Trop d’inscriptions depuis ce réseau. Réessayez dans ${formatRetryAfter(status.retryAfterSeconds)}.`,
        }
      }
    }

    let existing: { id: string } | null
    try {
      existing = await prisma.user.findUnique({
        where: { email: data.email },
        select: { id: true },
      })
    } catch (error) {
      console.error('[register:lookup]', error)
      throw new AppError('La base de données est momentanément indisponible. Réessayez.')
    }
    if (existing) {
      return {
        ok: false,
        message: 'Un compte existe déjà avec cette adresse e-mail.',
        fieldErrors: { email: ['Adresse déjà utilisée.'] },
      }
    }

    // Le code de classe est facultatif : on peut créer son compte puis
    // créer sa propre classe ou en rejoindre une ensuite. S'il est fourni,
    // il est validé AVANT la création du compte pour ne pas laisser un
    // compte orphelin derrière une erreur de saisie.
    let target: JoinTarget | null = null
    if (data.classCode) {
      try {
        target = await resolveJoinCode(data.classCode)
      } catch (error) {
        const message =
          error instanceof AppError
            ? error.message
            : 'Code de classe invalide.'
        return {
          ok: false,
          message,
          fieldErrors: { classCode: [message] },
        }
      }
    }

    let user: { id: string; firstName: string; lastName: string }
    try {
      user = await prisma.user.create({
        data: {
          email: data.email,
          passwordHash: await hashPassword(data.password),
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.accountType,
          studentId: data.accountType === 'ETUDIANT' ? data.studentId ?? null : null,
        },
        select: { id: true, firstName: true, lastName: true },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return {
          ok: false,
          message: 'Cette adresse e-mail est déjà utilisée.',
          fieldErrors: { email: ['Adresse e-mail déjà utilisée.'] },
        }
      }
      console.error('[register:create-user]', error)
      throw new AppError('Le compte n’a pas pu être créé. Réessayez dans un instant.')
    }

    // Le compte existe desormais : un echec d'adhesion (classe complete,
    // invitation epuisee entre-temps) ne doit plus faire echouer
    // l'inscription, sinon l'utilisateur ne pourrait ni se connecter ni se
    // reinscrire. Il est connecte et invite a reessayer.
    let joined = false
    if (target) {
      try {
        await joinClass(user.id, target, data.studentId ?? null)
        joined = true
      } catch {
        try {
          // Numero etudiant deja pris dans la classe : on rattache le compte
          // sans numero plutot que de perdre l'adhesion.
          await joinClass(user.id, target, null)
          joined = true
        } catch (error) {
          console.warn('[register:join]', error instanceof Error ? error.message : error)
        }
      }
    }

    if (target && joined) {
      await notifyClassStaff(
        target.classGroupId,
        {
          type: 'MEMBRE',
          title: 'Nouveau membre',
          body: `${user.firstName} ${user.lastName} a rejoint la classe.`,
          url: '/admin/membres',
          entityType: 'User',
          entityId: user.id,
        },
        { excludeUserId: user.id },
      )
    }

    try {
      await createSession(user.id)
    } catch (error) {
      console.error('[register:create-session]', error)
      throw new AppError('Le compte a été créé, mais la connexion automatique a échoué.')
    }

    if (target && joined) redirect('/dashboard')
    if (target) redirect('/classes?bienvenue=1&adhesion=echec')
    redirect(next ?? '/classes?bienvenue=1')
  })
}

// ---------------------------------------------------------------------------
// Connexion / deconnexion
// ---------------------------------------------------------------------------

/**
 * Empreinte bcrypt REELLE (cout 12) d'un secret aleatoire jete. Comparer a
 * cette empreinte coute le meme temps qu'une vraie verification : un
 * compte inexistant ne se distingue pas par un temps de reponse plus court.
 * (Une empreinte mal formee serait rejetee instantanement.)
 */
const DUMMY_HASH = '$2a$12$4Ui1.wafxvQukhF8yusU7OhATT6y/wggQs5wxDce4Mnv/UHaHri1O'

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const parsed = parseForm(loginSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }
    const next = safeNextPath(formData.get('next'))

    // Anti force brute : on compte les ECHECS par compte vise et par
    // adresse IP. Une connexion reussie remet le compteur du compte a zero.
    const emailKey = rateLimitKey('login:email', parsed.data.email)
    const ip = await clientIp()
    const ipKey = ip ? `login:ip:${ip}` : null
    const [emailStatus, ipStatus] = await Promise.all([
      peekRateLimit(emailKey, RATE_LIMITS.loginPerEmail),
      ipKey ? peekRateLimit(ipKey, RATE_LIMITS.loginPerIp) : null,
    ])
    const blocked = emailStatus.limited ? emailStatus : ipStatus?.limited ? ipStatus : null
    if (blocked) {
      return {
        ok: false,
        message: `Trop de tentatives de connexion. Réessayez dans ${formatRetryAfter(blocked.retryAfterSeconds)}.`,
      }
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: {
        id: true,
        passwordHash: true,
        isActive: true,
        deletedAt: true,
      },
    })

    // Message identique que l'email existe ou non : ne pas reveler
    // quelles adresses sont enregistrees.
    const genericError = {
      ok: false,
      message: 'Email ou mot de passe incorrect.',
    } satisfies ActionState

    const recordFailure = () =>
      Promise.all([
        hitRateLimit(emailKey, RATE_LIMITS.loginPerEmail),
        ipKey ? hitRateLimit(ipKey, RATE_LIMITS.loginPerIp) : null,
      ])

    if (!user || user.deletedAt) {
      // Comparaison factice pour eviter de distinguer les deux cas par le
      // temps de reponse.
      await verifyPassword(parsed.data.password, DUMMY_HASH)
      await recordFailure()
      return genericError
    }

    const valid = await verifyPassword(parsed.data.password, user.passwordHash)
    if (!valid) {
      await recordFailure()
      return genericError
    }

    if (!user.isActive) {
      return {
        ok: false,
        message: 'Ce compte est désactivé. Contactez votre administrateur.',
      }
    }

    await Promise.all([
      prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
      clearRateLimit(emailKey),
    ])

    await createSession(user.id)
    await pruneExpiredSessions()
    redirect(next ?? '/dashboard')
  })
}

export async function logoutAction(): Promise<void> {
  await destroySession()
  redirect('/login')
}

// ---------------------------------------------------------------------------
// Mot de passe oublie
// ---------------------------------------------------------------------------

export async function forgotPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const parsed = parseForm(forgotPasswordSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }

    // Reponse identique dans tous les cas : ne pas divulguer l'existence
    // d'un compte.
    const confirmation: ActionState = {
      ok: true,
      message:
        'Si un compte correspond à cette adresse, un lien de réinitialisation vient d’être envoyé.',
    }

    const ip = await clientIp()
    if (ip) {
      const status = await hitRateLimit(`reset:ip:${ip}`, RATE_LIMITS.resetPerIp)
      if (status.limited) {
        return {
          ok: false,
          message: `Trop de demandes. Réessayez dans ${formatRetryAfter(status.retryAfterSeconds)}.`,
        }
      }
    }
    // Au-dela de quelques demandes pour une meme adresse, on n'envoie plus
    // rien, sans le signaler : la boite de reception n'est pas inondee.
    const perEmail = await hitRateLimit(
      rateLimitKey('reset:email', parsed.data.email),
      RATE_LIMITS.resetPerEmail,
    )
    if (perEmail.limited) return confirmation

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, isActive: true, deletedAt: true, firstName: true },
    })

    if (!user || !user.isActive || user.deletedAt) return confirmation

    const token = randomBytes(32).toString('base64url')
    await prisma.$transaction([
      // Seul le dernier lien envoye reste valable.
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
      prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + RESET_TOKEN_DURATION_MINUTES * 60_000),
        },
      }),
    ])

    const link = `${env.appUrl}/reset-password?token=${token}`

    try {
      await sendMail({
        to: parsed.data.email,
        subject: 'Réinitialisation de votre mot de passe',
        text: [
          `Bonjour ${user.firstName},`,
          '',
          'Vous avez demandé la réinitialisation de votre mot de passe.',
          `Ce lien est valable ${RESET_TOKEN_DURATION_MINUTES} minutes :`,
          '',
          link,
          '',
          "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
        ].join('\n'),
      })
    } catch (error) {
      // Un echec d'envoi n'est pas signale a l'utilisateur : la reponse
      // differerait selon que le compte existe ou non.
      console.error('[forgot-password] envoi impossible', error)
    }

    return confirmation
  })
}

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const parsed = parseForm(resetPasswordSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(parsed.data.token) },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    })

    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      return {
        ok: false,
        message: 'Lien invalide ou expiré. Refaites une demande.',
      }
    }

    const passwordHash = await hashPassword(parsed.data.password)
    const reset = await prisma.$transaction(async (tx) => {
      // Le marquage conditionnel rend le jeton strictement a usage unique,
      // y compris si deux requetes arrivent simultanement.
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      })
      if (claimed.count === 0) return false

      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      })
      // Toutes les sessions ouvertes sont revoquees : si un tiers avait
      // acces au compte, il perd la main immediatement.
      await tx.session.deleteMany({ where: { userId: record.userId } })
      return true
    })

    if (!reset) {
      return { ok: false, message: 'Lien invalide ou expiré. Refaites une demande.' }
    }

    return {
      ok: true,
      message: 'Mot de passe mis à jour. Vous pouvez maintenant vous connecter.',
    }
  })
}

// ---------------------------------------------------------------------------
// Profil
// ---------------------------------------------------------------------------

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser()
    const parsed = parseForm(updateProfileSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }

    // Le numero etudiant appartient a l'appartenance : il peut differer
    // d'une classe a l'autre et doit rester unique dans chacune.
    if (parsed.data.studentId && user.classGroupId) {
      const duplicate = await prisma.membership.findFirst({
        where: {
          classGroupId: user.classGroupId,
          studentId: parsed.data.studentId,
          userId: { not: user.id },
        },
        select: { id: true },
      })
      if (duplicate) {
        return {
          ok: false,
          message: 'Ce numéro étudiant est déjà utilisé dans votre classe.',
          fieldErrors: { studentId: ['Numéro déjà utilisé.'] },
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          phone: parsed.data.phone ?? null,
          studentId: parsed.data.studentId ?? null,
        },
      })
      if (user.classGroupId) {
        await tx.membership.updateMany({
          where: { userId: user.id, classGroupId: user.classGroupId },
          data: { studentId: parsed.data.studentId ?? null },
        })
      }
    })

    revalidatePath('/profil')
    return { ok: true, message: 'Profil mis à jour.' }
  })
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const sessionUser = await requireUser()
    const parsed = parseForm(changePasswordSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
    }

    const record = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { passwordHash: true },
    })
    if (!record) throw new AppError('Compte introuvable.', 404)

    const valid = await verifyPassword(parsed.data.currentPassword, record.passwordHash)
    if (!valid) {
      return {
        ok: false,
        message: 'Mot de passe actuel incorrect.',
        fieldErrors: { currentPassword: ['Mot de passe incorrect.'] },
      }
    }

    await prisma.user.update({
      where: { id: sessionUser.id },
      data: { passwordHash: await hashPassword(parsed.data.password) },
    })

    await recordAudit({
      actor: sessionUser,
      action: 'PASSWORD_CHANGED',
      entityType: 'User',
      entityId: sessionUser.id,
      summary: `${sessionUser.firstName} ${sessionUser.lastName} a changé son mot de passe.`,
    })

    // La session courante est detruite avec les autres, et son cookie
    // efface : l'utilisateur se reconnecte avec son nouveau mot de passe.
    await revokeAllSessions(sessionUser.id)
    await clearSessionCookie()
    redirect('/login?reason=password-changed')
  })
}

export async function updateAvatarAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const sessionUser = await requireUser()
    const file = formData.get('avatar')

    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: 'Sélectionnez une image.' }
    }
    const mimeType = assertFileAllowed(file, AVATAR_RULE)

    const current = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { avatarUrl: true },
    })

    const stored = await storeFile(file, `avatars/${sessionUser.id}`, mimeType)

    try {
      await prisma.user.update({
        where: { id: sessionUser.id },
        data: { avatarUrl: stored.filePath },
      })
    } catch (error) {
      await removeFile(stored.filePath)
      throw error
    }

    if (current?.avatarUrl) await removeFile(current.avatarUrl)

    revalidatePath('/', 'layout')
    return { ok: true, message: 'Photo mise à jour.' }
  })
}
