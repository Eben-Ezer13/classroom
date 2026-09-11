import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  AVATAR_MAX_SIZE,
  COMPLAINT_ATTACHMENT_MAX_SIZE,
  COMPLAINT_MAX_ATTACHMENTS,
  MAX_FILE_SIZE,
  SCHEDULE_DOC_MAX_SIZE,
  SCHEDULE_DOC_MIME_TYPES,
} from '@/lib/constants'
import { formatFileSize } from '@/lib/utils'

/**
 * Regles de televersement, partagees par le navigateur (retour immediat) et
 * le serveur (controle qui fait foi). Aucune dependance Node : ce module est
 * importable depuis un composant client.
 *
 * Le type MIME enregistre est DEDUIT de l'extension, jamais repris du
 * navigateur : celui-ci est falsifiable, et varie selon le systeme (un .csv
 * est annonce "application/vnd.ms-excel" sous Windows avec Excel installe).
 */

export const UPLOAD_KINDS = ['resource', 'schedule', 'complaint'] as const
export type UploadKind = (typeof UPLOAD_KINDS)[number]

export type UploadRule = {
  /** Sous-dossier de stockage dans l'espace de la classe. */
  folder: string
  mimeTypes: Record<string, string[]>
  maxSize: number
  maxFiles: number
  /** Reserve aux delegues de la classe. */
  adminOnly: boolean
  /** Formats acceptes, pour les messages d'erreur. */
  formats: string
}

export const UPLOAD_RULES: Record<UploadKind, UploadRule> = {
  resource: {
    folder: 'resources',
    mimeTypes: ALLOWED_MIME_TYPES,
    maxSize: MAX_FILE_SIZE,
    maxFiles: 1,
    adminOnly: true,
    formats: ALLOWED_EXTENSIONS.join(', '),
  },
  schedule: {
    folder: 'schedule',
    mimeTypes: SCHEDULE_DOC_MIME_TYPES,
    maxSize: SCHEDULE_DOC_MAX_SIZE,
    maxFiles: 1,
    adminOnly: true,
    formats: 'PDF, PNG, JPEG, WEBP',
  },
  complaint: {
    folder: 'complaints',
    mimeTypes: ALLOWED_MIME_TYPES,
    maxSize: COMPLAINT_ATTACHMENT_MAX_SIZE,
    maxFiles: COMPLAINT_MAX_ATTACHMENTS,
    adminOnly: false,
    formats: ALLOWED_EXTENSIONS.join(', '),
  },
}

/** Photo de profil : envoyee par le serveur, elle tient dans une requete. */
export const AVATAR_RULE: UploadRule = {
  folder: 'avatars',
  mimeTypes: {
    'image/png': ['.png'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/webp': ['.webp'],
  },
  maxSize: AVATAR_MAX_SIZE,
  maxFiles: 1,
  adminOnly: false,
  formats: 'PNG, JPEG, WEBP',
}

export function isUploadKind(value: unknown): value is UploadKind {
  return typeof value === 'string' && (UPLOAD_KINDS as readonly string[]).includes(value)
}

/**
 * Dossier de stockage d'un utilisateur dans une classe. L'identifiant de
 * l'auteur fait partie du chemin : un fichier envoye directement au stockage
 * ne peut etre rattache qu'au compte qui l'a depose.
 */
export function uploadPrefix(kind: UploadKind, classGroupId: string, userId: string): string {
  return `classes/${classGroupId}/${UPLOAD_RULES[kind].folder}/${userId}`
}

function baseName(name: string): string {
  const parts = name.split(/[\\/]/)
  return parts[parts.length - 1] ?? ''
}

/** Nom affiche et propose au telechargement : sans chemin ni caractere de controle. */
export function displayFileName(name: string): string {
  const cleaned = Array.from(baseName(name))
    .filter((ch) => {
      const code = ch.charCodeAt(0)
      return code > 31 && code !== 127
    })
    .join('')
    .trim()
  return (cleaned || 'fichier').slice(0, 180)
}

/**
 * Nom utilisable dans une cle de stockage : ASCII strict, sans chemin.
 * Idempotent : la route d'envoi direct compare un nom a sa version nettoyee.
 */
export function storageFileName(name: string): string {
  const cleaned = displayFileName(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(-120)
    .replace(/^[._-]+/, '')
  return cleaned || 'fichier'
}

export function fileExtension(name: string): string {
  const base = baseName(name)
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot).toLowerCase() : ''
}

export type FileCheck = { ok: true; mimeType: string } | { ok: false; message: string }

/** Verifie taille et extension, et renvoie le type MIME a enregistrer. */
export function checkFile(file: { name: string; size: number }, rule: UploadRule): FileCheck {
  if (file.size <= 0) return { ok: false, message: 'Le fichier est vide.' }
  if (file.size > rule.maxSize) {
    return {
      ok: false,
      message:
        `Fichier trop volumineux (${formatFileSize(file.size)}). ` +
        `Maximum autorisé : ${formatFileSize(rule.maxSize)}.`,
    }
  }
  const extension = fileExtension(file.name)
  const mimeType = Object.keys(rule.mimeTypes).find((type) =>
    rule.mimeTypes[type].includes(extension),
  )
  if (!mimeType) {
    return {
      ok: false,
      message: `Format non autorisé (${extension || 'sans extension'}). Formats acceptés : ${rule.formats}.`,
    }
  }
  return { ok: true, mimeType }
}

/**
 * Champ portant, dans le formulaire, les references des fichiers deja
 * envoyes directement au stockage par le navigateur.
 */
export function directUploadField(field: string): string {
  return `${field}__blob`
}

export type DirectUploadRef = { url: string; name: string }

/** Route qui delivre les jetons d'envoi direct. */
export const UPLOAD_TOKEN_ROUTE = '/api/uploads'
