import 'server-only'
import { randomBytes } from 'crypto'
import path from 'path'
import { prisma } from '@/lib/db'
import { env } from '@/lib/env'
import { AppError } from '@/lib/errors'
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  AVATAR_MAX_SIZE,
  AVATAR_MIME_TYPES,
  MAX_FILE_SIZE,
  SCHEDULE_DOC_MAX_SIZE,
  SCHEDULE_DOC_MIME_TYPES,
} from '@/lib/constants'
import { formatFileSize } from '@/lib/utils'
import * as localDriver from './local'
import * as blobDriver from './blob'

/**
 * Abstraction de stockage.
 *
 * PostgreSQL ne contient que les metadonnees : le binaire vit dans le driver
 * choisi par STORAGE_DRIVER (deduit du jeton disponible). Deux
 * implementations :
 *   - "vercel-blob" en production ;
 *   - "local" en developpement, pour travailler sans compte Vercel.
 *
 * Le chemin retourne (`filePath`) est opaque et n'est JAMAIS envoye au
 * navigateur : les telechargements passent par une route qui verifie
 * d'abord l'appartenance a la classe.
 *
 * Cloisonnement : toutes les cles sont prefixees par la classe
 * (`classes/<classId>/...`), et le compteur `storageUsed` de la classe est
 * tenu a jour a chaque ecriture et suppression.
 */

export type StoredFile = {
  filePath: string
  fileName: string
  fileSize: number
  mimeType: string
}

function driver() {
  return env.storageDriver === 'vercel-blob' ? blobDriver : localDriver
}

/**
 * Le driver local ecrit sur le disque de la machine : sur Vercel ce disque
 * est en lecture seule et disparait entre deux invocations. Mieux vaut un
 * message explicite au premier upload qu'un fichier perdu silencieusement.
 */
function assertUsableDriver(): void {
  if (env.storageDriver === 'local' && env.isProduction) {
    throw new AppError(
      'Stockage non configure : renseignez BLOB_READ_WRITE_TOKEN (Vercel Blob) ' +
        'pour activer le depot de fichiers en production.',
      503,
    )
  }
}

function extensionOf(fileName: string): string {
  return path.extname(fileName).toLowerCase()
}

/** Nettoie un nom de fichier : pas de chemin, pas de caractere de controle. */
export function sanitizeFileName(fileName: string): string {
  const base = Array.from(path.basename(fileName))
    .filter((ch) => ch.charCodeAt(0) > 31 && ch.charCodeAt(0) !== 127)
    .join('')
  const cleaned = base.replace(/[^a-zA-Z0-9._ -]/g, '_').trim()
  return (cleaned || 'fichier').slice(0, 180)
}

function assertType(
  file: File,
  allowed: Record<string, string[]>,
  maxSize: number,
  label: string,
): void {
  if (file.size === 0) {
    throw new AppError('Le fichier est vide.')
  }
  if (file.size > maxSize) {
    throw new AppError(
      `Fichier trop volumineux (${formatFileSize(file.size)}). ` +
        `Maximum autorise : ${formatFileSize(maxSize)}.`,
    )
  }
  const allowedExts = allowed[file.type]
  if (!allowedExts) {
    throw new AppError(
      `Type de fichier non autorise : ${file.type || 'inconnu'}. ${label}`,
    )
  }
  const ext = extensionOf(file.name)
  if (!allowedExts.includes(ext)) {
    throw new AppError(
      `L'extension ${ext || '(aucune)'} ne correspond pas au type ${file.type}.`,
    )
  }
}

/**
 * Validation d'upload appliquee cote serveur.
 * On verifie a la fois le type MIME declare ET l'extension : un des deux
 * seul est trivial a falsifier.
 */
export function assertValidUpload(file: File): void {
  assertType(
    file,
    ALLOWED_MIME_TYPES,
    MAX_FILE_SIZE,
    `Extensions acceptees : ${ALLOWED_EXTENSIONS.join(', ')}.`,
  )
}

export function assertValidScheduleDocument(file: File): void {
  assertType(
    file,
    SCHEDULE_DOC_MIME_TYPES,
    SCHEDULE_DOC_MAX_SIZE,
    'Formats acceptes : PDF, PNG, JPEG, WEBP.',
  )
}

export function assertValidAvatar(file: File): void {
  if (file.size > AVATAR_MAX_SIZE) {
    throw new AppError(`Image trop volumineuse (max ${formatFileSize(AVATAR_MAX_SIZE)}).`)
  }
  if (!AVATAR_MIME_TYPES.includes(file.type)) {
    throw new AppError('Formats acceptes pour la photo : PNG, JPEG, WEBP.')
  }
}

/**
 * Verifie que la classe a encore de la place avant d'ecrire.
 * Le quota est par classe : une classe ne peut pas saturer l'espace des
 * autres, et le delegue voit sa consommation dans l'administration.
 */
export async function assertClassQuota(
  classGroupId: string,
  incomingBytes: number,
): Promise<void> {
  const classGroup = await prisma.classGroup.findUnique({
    where: { id: classGroupId },
    select: { storageUsed: true, storageQuota: true },
  })
  if (!classGroup) throw new AppError('Classe introuvable.', 404)

  const used = Number(classGroup.storageUsed)
  const quota = Number(classGroup.storageQuota)
  if (quota > 0 && used + incomingBytes > quota) {
    throw new AppError(
      `Espace de stockage insuffisant pour cette classe : ` +
        `${formatFileSize(used)} utilises sur ${formatFileSize(quota)}. ` +
        `Supprimez des ressources ou demandez une augmentation du quota.`,
    )
  }
}

/** Met a jour le compteur de stockage de la classe (delta en octets). */
export async function trackClassStorage(
  classGroupId: string,
  deltaBytes: number,
): Promise<void> {
  if (deltaBytes === 0) return
  await prisma.$executeRaw`
    UPDATE "classes"
    SET "storageUsed" = GREATEST(0, "storageUsed" + ${BigInt(deltaBytes)}::bigint)
    WHERE "id" = ${classGroupId}
  `
}

/** Enregistre un fichier et retourne ses metadonnees. */
export async function storeFile(file: File, prefix: string): Promise<StoredFile> {
  assertUsableDriver()
  const safeName = sanitizeFileName(file.name)
  const key = `${prefix}/${Date.now()}-${randomBytes(8).toString('hex')}-${safeName}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const filePath = await driver().put(key, buffer, file.type)
  return {
    filePath,
    fileName: safeName,
    fileSize: file.size,
    mimeType: file.type,
  }
}

/** Prefixe de stockage d'une classe : les fichiers restent cloisonnes. */
export function classPrefix(classGroupId: string, folder: string): string {
  return `classes/${classGroupId}/${folder}`
}

export async function readFile(filePath: string): Promise<Buffer> {
  return driver().read(filePath)
}

/** Flux de lecture, pour relayer un fichier sans le charger en memoire. */
export async function readStream(
  filePath: string,
): Promise<ReadableStream<Uint8Array>> {
  return driver().stream(filePath)
}

/** Suppression best-effort : l'echec ne doit pas bloquer la suppression en base. */
export async function removeFile(filePath: string): Promise<void> {
  try {
    await driver().remove(filePath)
  } catch (error) {
    console.error('[storage] suppression impossible', filePath, error)
  }
}
