import 'server-only'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/db'
import { env } from '@/lib/env'
import { AppError } from '@/lib/errors'
import { formatFileSize } from '@/lib/utils'
import {
  UPLOAD_RULES,
  checkFile,
  directUploadField,
  displayFileName,
  fileExtension,
  storageFileName,
  uploadPrefix,
  type DirectUploadRef,
  type UploadKind,
  type UploadRule,
} from '@/lib/uploads'
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
 * Deux chemins d'arrivee des fichiers, qui aboutissent au meme controle :
 *   - envoi DIRECT (Vercel Blob) : le navigateur depose le fichier dans le
 *     stockage avec un jeton a usage unique (/api/uploads), puis transmet sa
 *     reference. Indispensable en production : une requete vers une fonction
 *     Vercel est plafonnee a 4,5 Mo ;
 *   - envoi CLASSIQUE (driver local, photo de profil) : le fichier traverse
 *     la Server Action.
 *
 * Le chemin retourne (`filePath`) est opaque et n'est JAMAIS envoye au
 * navigateur : les telechargements passent par une route qui verifie
 * d'abord l'appartenance a la classe.
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
      'Stockage non configuré : renseignez BLOB_READ_WRITE_TOKEN (Vercel Blob) ' +
        'pour activer le dépôt de fichiers en production.',
      503,
    )
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
        `${formatFileSize(used)} utilisés sur ${formatFileSize(quota)}. ` +
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

/**
 * Enregistre un fichier recu par le serveur. Le type MIME est celui deduit
 * de l'extension (checkFile), jamais celui annonce par le navigateur.
 */
export async function storeFile(
  file: File,
  prefix: string,
  mimeType: string,
): Promise<StoredFile> {
  assertUsableDriver()
  const key = `${prefix}/${Date.now()}-${randomBytes(6).toString('hex')}-${storageFileName(file.name)}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const filePath = await driver().put(key, buffer, mimeType)
  return {
    filePath,
    fileName: displayFileName(file.name),
    fileSize: file.size,
    mimeType,
  }
}

/** Valide un fichier recu par le serveur contre une regle, ou leve une erreur. */
export function assertFileAllowed(file: File, rule: UploadRule): string {
  const check = checkFile(file, rule)
  if (!check.ok) throw new AppError(check.message)
  return check.mimeType
}

/** Un fichier deja rattache a une ligne ne peut pas etre reutilise. */
async function isReferenced(filePath: string): Promise<boolean> {
  const [resources, documents, attachments, avatars] = await Promise.all([
    prisma.resource.count({ where: { filePath } }),
    prisma.scheduleDocument.count({ where: { filePath } }),
    prisma.attachment.count({ where: { filePath } }),
    prisma.user.count({ where: { avatarUrl: filePath } }),
  ])
  return resources + documents + attachments + avatars > 0
}

function parseRef(raw: string): DirectUploadRef | null {
  try {
    const value = JSON.parse(raw) as Partial<DirectUploadRef>
    if (typeof value?.url === 'string' && typeof value?.name === 'string') {
      return { url: value.url, name: value.name }
    }
  } catch {
    // Reference illisible : traitee comme absente.
  }
  return null
}

/**
 * Valide un fichier envoye directement au stockage par le navigateur.
 *
 * Rien n'est repris du formulaire hormis l'URL et le nom affiche : taille et
 * type sont relus dans le stockage. Le fichier doit se trouver dans le
 * dossier de l'utilisateur pour CETTE classe : impossible de rattacher le
 * fichier d'un autre compte, meme en connaissant son URL.
 */
async function claimDirectUpload(
  ref: DirectUploadRef,
  rule: UploadRule,
  prefix: string,
): Promise<StoredFile> {
  const meta = await blobDriver.inspect(ref.url)
  if (!meta) {
    throw new AppError('Fichier introuvable dans le stockage : recommencez l’envoi.')
  }
  if (!meta.pathname.startsWith(`${prefix}/`)) {
    throw new AppError('Ce fichier ne peut pas être rattaché à votre compte.', 403)
  }
  if (await isReferenced(meta.url)) {
    throw new AppError('Ce fichier est déjà utilisé.')
  }

  const fileName = displayFileName(ref.name)
  const check = checkFile({ name: meta.pathname, size: meta.size }, rule)
  const problem = !check.ok
    ? check.message
    : check.mimeType !== meta.contentType ||
        fileExtension(fileName) !== fileExtension(meta.pathname)
      ? 'Le type du fichier ne correspond pas à son extension.'
      : null
  if (problem) {
    await removeFile(meta.url)
    throw new AppError(problem)
  }

  return { filePath: meta.url, fileName, fileSize: meta.size, mimeType: meta.contentType }
}

/** Supprime des references directes non rattachees (echec en cours de route). */
async function discardRefs(refs: DirectUploadRef[], prefix: string): Promise<void> {
  for (const ref of refs) {
    const meta = await blobDriver.inspect(ref.url).catch(() => null)
    if (meta && meta.pathname.startsWith(`${prefix}/`) && !(await isReferenced(meta.url))) {
      await removeFile(meta.url)
    }
  }
}

export type UploadTarget = {
  /** Nom du champ de fichier dans le formulaire. */
  field: string
  kind: UploadKind
  classGroupId: string
  userId: string
}

/**
 * Point d'entree unique des fichiers d'un formulaire : references d'envoi
 * direct et/ou fichiers recus par la Server Action.
 *
 * Tout est valide avant d'etre accepte ; en cas d'echec, les fichiers deja
 * ecrits sont supprimes. Les fichiers renvoyes sont stockes mais pas encore
 * rattaches : l'appelant doit appeler `discardStoredFiles` si la suite de
 * son traitement echoue.
 */
export async function receiveUploads(
  formData: FormData,
  target: UploadTarget,
): Promise<StoredFile[]> {
  const rule = UPLOAD_RULES[target.kind]
  const prefix = uploadPrefix(target.kind, target.classGroupId, target.userId)

  const refs = formData
    .getAll(directUploadField(target.field))
    .map((raw) => (typeof raw === 'string' ? parseRef(raw) : null))
    .filter((ref): ref is DirectUploadRef => ref !== null)
  const files = formData
    .getAll(target.field)
    .filter((file): file is File => file instanceof File && file.size > 0)

  try {
    if (refs.length > 0 && env.storageDriver !== 'vercel-blob') {
      throw new AppError('Envoi direct indisponible : le stockage Vercel Blob n’est pas configuré.')
    }
    if (refs.length + files.length > rule.maxFiles) {
      throw new AppError(`${rule.maxFiles} fichier(s) maximum.`)
    }
    // Controle de TOUS les fichiers avant la moindre ecriture.
    const mimeTypes = files.map((file) => assertFileAllowed(file, rule))

    const stored: StoredFile[] = []
    try {
      for (const ref of refs) stored.push(await claimDirectUpload(ref, rule, prefix))
      for (const [index, file] of files.entries()) {
        stored.push(await storeFile(file, prefix, mimeTypes[index]))
      }
    } catch (error) {
      await discardStoredFiles(stored)
      throw error
    }
    return stored
  } catch (error) {
    // Les fichiers deja deposes par le navigateur ne doivent pas rester
    // orphelins dans le stockage.
    if (refs.length > 0 && env.storageDriver === 'vercel-blob') {
      await discardRefs(refs, prefix).catch((cleanup) =>
        console.error('[storage] nettoyage impossible', cleanup),
      )
    }
    throw error
  }
}

/** Retire du stockage des fichiers qui n'ont finalement pas ete rattaches. */
export async function discardStoredFiles(files: StoredFile[]): Promise<void> {
  await Promise.all(files.map((file) => removeFile(file.filePath)))
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
