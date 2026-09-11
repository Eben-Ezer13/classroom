import { NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { getCurrentUser } from '@/lib/auth/session'
import { assertCanManageClass, requireClassId } from '@/lib/permissions'
import { assertClassQuota } from '@/lib/storage'
import { RATE_LIMITS, formatRetryAfter, hitRateLimit } from '@/lib/rate-limit'
import { env } from '@/lib/env'
import { AppError } from '@/lib/errors'
import {
  UPLOAD_RULES,
  checkFile,
  isUploadKind,
  storageFileName,
  uploadPrefix,
} from '@/lib/uploads'

/**
 * Jetons d'envoi direct vers Vercel Blob.
 *
 * Une requete vers une fonction Vercel est plafonnee a 4,5 Mo : les fichiers
 * partent donc du navigateur directement vers le stockage, avec un jeton a
 * usage unique delivre ici APRES verification :
 *   - session valide et appartenance a la classe visee ;
 *   - droits de delegue pour les ressources et l'emploi du temps ;
 *   - chemin impose : dossier de l'utilisateur dans cette classe ;
 *   - format, taille maximale et quota restant de la classe.
 * Le jeton lie le chemin, le type et la taille : le stockage refuse tout
 * envoi qui s'en ecarte.
 *
 * Le fichier depose n'est rattache a rien tant que la Server Action du
 * formulaire ne l'a pas revalide (lib/storage : receiveUploads).
 */

type ClientPayload = { kind: unknown; classGroupId?: unknown; size?: unknown }

function parsePayload(raw: string | null) {
  let value: ClientPayload
  try {
    value = JSON.parse(raw ?? '') as ClientPayload
  } catch {
    throw new AppError('Demande d’envoi invalide.')
  }
  if (!isUploadKind(value?.kind)) throw new AppError('Type d’envoi inconnu.')
  const size = Number(value.size)
  if (!Number.isFinite(size) || size <= 0) throw new AppError('Taille de fichier invalide.')
  return {
    kind: value.kind,
    classGroupId: typeof value.classGroupId === 'string' ? value.classGroupId : null,
    size,
  }
}

export async function POST(request: Request) {
  if (env.storageDriver !== 'vercel-blob') {
    return NextResponse.json(
      { error: 'L’envoi direct n’est pas activé sur ce serveur.' },
      { status: 404 },
    )
  }

  let body: HandleUploadBody
  try {
    body = (await request.json()) as HandleUploadBody
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }
  // Seule la delivrance de jeton est geree : les fichiers sont rattaches
  // par les Server Actions, pas par un rappel du stockage.
  if (body?.type !== 'blob.generate-client-token') {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }

  try {
    const result = await handleUpload({
      body,
      request,
      token: env.blobToken,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const user = await getCurrentUser()
        if (!user) throw new AppError('Session expirée : reconnectez-vous.', 401)

        const payload = parsePayload(clientPayload)
        const rule = UPLOAD_RULES[payload.kind]

        // Appartenance reelle a la classe visee (sinon 404), puis droits.
        const classGroupId = requireClassId(user, payload.classGroupId)
        if (rule.adminOnly) assertCanManageClass(user, classGroupId)

        const prefix = uploadPrefix(payload.kind, classGroupId, user.id)
        const name = pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length + 1) : ''
        if (!name || name !== storageFileName(name)) {
          throw new AppError('Chemin de fichier refusé.', 403)
        }

        const check = checkFile({ name, size: payload.size }, rule)
        if (!check.ok) throw new AppError(check.message)

        // Retour immediat si la classe est pleine ; le quota est reverifie
        // avec la taille reelle au rattachement du fichier.
        await assertClassQuota(classGroupId, payload.size)

        const status = await hitRateLimit(`upload:user:${user.id}`, RATE_LIMITS.uploadPerUser)
        if (status.limited) {
          throw new AppError(
            `Trop d’envois successifs. Réessayez dans ${formatRetryAfter(status.retryAfterSeconds)}.`,
            429,
          )
        }

        return {
          allowedContentTypes: [check.mimeType],
          maximumSizeInBytes: rule.maxSize,
          addRandomSuffix: true,
          allowOverwrite: false,
          validUntil: Date.now() + 60 * 60 * 1000,
        }
      },
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[uploads] jeton refusé', error)
    return NextResponse.json({ error: 'Envoi impossible pour le moment.' }, { status: 500 })
  }
}
