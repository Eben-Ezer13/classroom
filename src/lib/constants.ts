/**
 * Libelles et metadonnees d'affichage des enums Prisma.
 * Centralises ici pour eviter la duplication de traductions dans l'UI.
 */

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  DELEGUE: 'Délégué',
  ETUDIANT: 'Étudiant',
}

/** Roles au sein d'une classe : seule hierarchie qui compte pour les droits. */
export const CLASS_ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Délégué',
  MEMBER: 'Étudiant',
}

export const CLASS_ROLE_TONE: Record<string, string> = {
  ADMIN: 'accent',
  MEMBER: 'neutral',
}

export const SCHEDULE_TYPE_LABELS: Record<string, string> = {
  COURS: 'Cours',
  TD: 'TD',
  TP: 'TP',
  EXAMEN: 'Examen',
  SOUTENANCE: 'Soutenance',
  AUTRE: 'Autre',
}

export const SCHEDULE_TYPE_TONE: Record<string, string> = {
  COURS: 'accent',
  TD: 'info',
  TP: 'success',
  EXAMEN: 'danger',
  SOUTENANCE: 'warning',
  AUTRE: 'neutral',
}

export const RESOURCE_KIND_LABELS: Record<string, string> = {
  COURS: 'Cours',
  TD: 'TD',
  TP: 'TP',
  EXAMEN: 'Examen',
  PROJET: 'Projet',
  CORRECTION: 'Correction',
  PRESENTATION: 'Présentation',
  ADMINISTRATIF: 'Document administratif',
  AUTRE: 'Autre',
}

export const ANNOUNCEMENT_LEVEL_LABELS: Record<string, string> = {
  NORMAL: 'Normal',
  IMPORTANT: 'Important',
  URGENT: 'Urgent',
}

export const ANNOUNCEMENT_LEVEL_TONE: Record<string, string> = {
  NORMAL: 'neutral',
  IMPORTANT: 'warning',
  URGENT: 'danger',
}

export const ANNOUNCEMENT_CATEGORY_LABELS: Record<string, string> = {
  GENERALE: 'Annonce générale',
  MODULE: 'Liée à un module',
  ADMINISTRATIF: 'Information administrative',
  CHANGEMENT_SALLE: 'Changement de salle',
  CHANGEMENT_HORAIRE: "Changement d'horaire",
  ABSENCE_PROFESSEUR: 'Absence professeur',
  REUNION: 'Réunion',
  EVENEMENT: 'Événement',
}

export const DEADLINE_CATEGORY_LABELS: Record<string, string> = {
  EXAMEN: 'Examen',
  DEVOIR: 'Devoir',
  PROJET: 'Projet',
  PRESENTATION: 'Présentation',
  RAPPORT: 'Rapport',
  AUTRE: 'Autre',
}

export const COMPLAINT_CATEGORY_LABELS: Record<string, string> = {
  COURS: 'Cours',
  PROFESSEUR: 'Professeur',
  SALLE: 'Salle',
  PROGRAMME: 'Programme',
  ADMINISTRATIF: 'Administratif',
  AUTRE: 'Autre',
}

export const COMPLAINT_PRIORITY_LABELS: Record<string, string> = {
  BASSE: 'Basse',
  NORMALE: 'Normale',
  HAUTE: 'Haute',
  CRITIQUE: 'Critique',
}

export const COMPLAINT_PRIORITY_TONE: Record<string, string> = {
  BASSE: 'neutral',
  NORMALE: 'info',
  HAUTE: 'warning',
  CRITIQUE: 'danger',
}

export const COMPLAINT_STATUS_LABELS: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  EN_COURS: 'En cours',
  RESOLU: 'Résolu',
  FERME: 'Fermé',
}

export const COMPLAINT_STATUS_TONE: Record<string, string> = {
  EN_ATTENTE: 'warning',
  EN_COURS: 'info',
  RESOLU: 'success',
  FERME: 'neutral',
}

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  RESSOURCE: 'Ressource',
  ANNONCE: 'Annonce',
  PROJET: 'Projet',
  DEADLINE: 'Échéance',
  PROGRAMME: 'Programme',
  SONDAGE: 'Sondage',
  RECLAMATION: 'Réclamation',
  MENTION: 'Mention',
  MEMBRE: 'Membre',
  SYSTEME: 'Système',
}

/** Palette utilisee pour differencier visuellement les modules. */
export const MODULE_COLORS = [
  '#4f46e5',
  '#0891b2',
  '#059669',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#db2777',
  '#0284c7',
] as const

export const PAGE_SIZE = 20

/** Limites d'upload appliquees cote serveur (jamais seulement cote client). */
export const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100 Mo

export const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/zip': ['.zip'],
  'application/x-zip-compressed': ['.zip'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'text/markdown': ['.md'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
}

export const ALLOWED_EXTENSIONS = Array.from(
  new Set(Object.values(ALLOWED_MIME_TYPES).flat()),
)

export const AVATAR_MAX_SIZE = 2 * 1024 * 1024 // 2 Mo
export const AVATAR_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp']

/** Emploi du temps televerse : image ou PDF uniquement. */
export const SCHEDULE_DOC_MAX_SIZE = 50 * 1024 * 1024 // 50 Mo
export const SCHEDULE_DOC_MIME_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
}

/** Pieces jointes d'une reclamation : plus petites et en nombre limite. */
export const COMPLAINT_ATTACHMENT_MAX_SIZE = 20 * 1024 * 1024 // 20 Mo
export const COMPLAINT_MAX_ATTACHMENTS = 5

/**
 * Quota de stockage par classe, en octets.
 * Valeur volontairement explicite : le stockage n'est jamais illimite, et
 * une classe ne doit pas pouvoir saturer l'espace des autres.
 */
export const DEFAULT_CLASS_STORAGE_QUOTA = 10 * 1024 * 1024 * 1024 // 10 Go

export const SESSION_COOKIE = 'cp_session'
export const SESSION_DURATION_DAYS = 30
export const RESET_TOKEN_DURATION_MINUTES = 60

// ---------------------------------------------------------------------------
// Presence
// ---------------------------------------------------------------------------

/**
 * "En ligne" = activite constatee dans les 5 dernieres minutes.
 * La date de derniere activite n'est reecrite qu'au dela de 2 minutes : le
 * suivi coute donc au maximum une ecriture toutes les 2 minutes par
 * utilisateur, jamais une par requete.
 */
export const ONLINE_WINDOW_MS = 5 * 60_000
export const PRESENCE_REFRESH_MS = 2 * 60_000
/** Intervalle du battement envoye par l'onglet ouvert. */
export const PRESENCE_HEARTBEAT_MS = 3 * 60_000

// ---------------------------------------------------------------------------
// Classes et invitations
// ---------------------------------------------------------------------------

/** Alphabet sans caracteres ambigus (0/O, 1/I) pour les codes lus a voix haute. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const CLASS_CODE_LENGTH = 8
export const INVITATION_CODE_LENGTH = 12
export const INVITATION_DEFAULT_DAYS = 14
/** Garde-fou anti-abus : nombre de classes qu'un compte peut creer. */
export const MAX_CLASSES_PER_USER = 10
/** Nombre maximal d'etudiants actifs dans une classe. */
export const MAX_STUDENTS_PER_CLASS = 60
