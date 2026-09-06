'use server'

import { createHash, randomBytes } from 'crypto'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import {
  createSession,
  destroySession,
  getCurrentUser,
  pruneExpiredSessions,
  revokeAllSessions,
} from '@/lib/auth/session'
import { requireUser } from '@/lib/auth/guards'
import { sendMail } from '@/lib/mailer'
import { recordAudit } from '@/lib/audit'
import { assertValidAvatar, removeFile, storeFile } from '@/lib/storage'
import { joinClass, resolveJoinCode, type JoinTarget } from '@/lib/services/classes'
import { AppError, runAction, type ActionState } from '@/lib/errors'
import { RESET_TOKEN_DURATION_MINUTES } from '@/lib/constants'
import { env } from '@/lib/env'
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
    // créer sa propre classe ou en rejoindre une ensuite. S’il est fourni,
    // il est valide AVANT la creation du compte pour ne pas laisser un
    // compte orphelin derriere une erreur de saisie.
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

    let user: { id: string }
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
        select: { id: true },
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
      throw new AppError('Le compte n’a pas pu être créé. Vérifiez les migrations de la base.')
    }

    if (target) {
      try {
        await joinClass(user.id, target, data.studentId ?? null)
      } catch {
        // Numéro étudiant déjà pris dans la classe : on rattache quand même
        // le compte, sans numero, plutot que de perdre l'inscription.
        await joinClass(user.id, target, null)
      }
    }

    try {
      await createSession(user.id)
    } catch (error) {
      console.error('[register:create-session]', error)
      throw new AppError('Le compte a été créé, mais la connexion automatique a échoué.')
    }
    redirect(target ? '/dashboard' : '/classes?bienvenue=1')
  })
}

// ---------------------------------------------------------------------------
// Connexion / deconnexion
// ---------------------------------------------------------------------------

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const parsed = parseForm(loginSchema, formData)
    if (!parsed.success) {
      return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors }
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

    if (!user || user.deletedAt) {
      // Comparaison factice pour eviter de distinguer les deux cas par le
      // temps de reponse.
      await verifyPassword(parsed.data.password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu')
      return genericError
    }

    const valid = await verifyPassword(parsed.data.password, user.passwordHash)
    if (!valid) return genericError

    if (!user.isActive) {
      return {
        ok: false,
        message: 'Ce compte est desactive. Contactez votre administrateur.',
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    await createSession(user.id)
    await pruneExpiredSessions()
    redirect('/dashboard')
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

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, isActive: true, deletedAt: true, firstName: true },
    })

    // Reponse identique dans tous les cas : ne pas divulguer l'existence
    // d'un compte.
    const confirmation: ActionState = {
      ok: true,
      message:
        'Si un compte correspond a cette adresse, un lien de reinitialisation vient d etre envoye.',
    }

    if (!user || !user.isActive || user.deletedAt) return confirmation

    const token = randomBytes(32).toString('base64url')
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_DURATION_MINUTES * 60_000),
      },
    })

    const link = `${env.appUrl}/reset-password?token=${token}`

    await sendMail({
      to: parsed.data.email,
      subject: 'Reinitialisation de votre mot de passe',
      text: [
        `Bonjour ${user.firstName},`,
        '',
        'Vous avez demande la reinitialisation de votre mot de passe.',
        `Ce lien est valable ${RESET_TOKEN_DURATION_MINUTES} minutes :`,
        '',
        link,
        '',
        "Si vous n'etes pas a l'origine de cette demande, ignorez ce message.",
      ].join('\n'),
    })

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
        message: 'Lien invalide ou expire. Refaites une demande.',
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
      return { ok: false, message: 'Lien invalide ou expire. Refaites une demande.' }
    }

    return {
      ok: true,
      message: 'Mot de passe mis a jour. Vous pouvez maintenant vous connecter.',
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
          message: 'Ce numero etudiant est deja utilise dans votre classe.',
          fieldErrors: { studentId: ['Numero deja utilise.'] },
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
    return { ok: true, message: 'Profil mis a jour.' }
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
      summary: `${sessionUser.firstName} ${sessionUser.lastName} a change son mot de passe.`,
    })

    // La session courante est detruite avec les autres : l'utilisateur se
    // reconnecte avec son nouveau mot de passe.
    await revokeAllSessions(sessionUser.id)
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
      return { ok: false, message: 'Selectionnez une image.' }
    }
    assertValidAvatar(file)

    const current = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { avatarUrl: true },
    })

    const stored = await storeFile(file, `avatars/${sessionUser.id}`)

    await prisma.user.update({
      where: { id: sessionUser.id },
      data: { avatarUrl: stored.filePath },
    })

    if (current?.avatarUrl) await removeFile(current.avatarUrl)

    revalidatePath('/profil')
    revalidatePath('/dashboard')
    return { ok: true, message: 'Photo mise a jour.' }
  })
}

/** Utilise par la coque applicative pour le bouton de deconnexion. */
export async function currentUserSnapshot() {
  return getCurrentUser()
}
