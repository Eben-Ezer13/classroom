import { z } from 'zod'

/**
 * Schemas de validation appliques a TOUTES les entrees serveur.
 * Aucune Server Action ni route API ne fait confiance au client.
 */

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} : ${min} caractere(s) minimum.`)
    .max(max, `${label} : ${max} caracteres maximum.`)

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caracteres maximum.`)
    .optional()
    .transform((v) => (v === '' ? undefined : v))

/** Champ <select> optionnel : "" devient undefined. */
const optionalId = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === '' || v === undefined ? undefined : v))

const dateField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} est obligatoire.`)
    .refine((v) => !Number.isNaN(Date.parse(v)), `${label} est invalide.`)
    .transform((v) => new Date(v))

const optionalDateField = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === '' || v === undefined ? undefined : v))
  .refine((v) => v === undefined || !Number.isNaN(Date.parse(v)), 'Date invalide.')
  .transform((v) => (v === undefined ? undefined : new Date(v)))

const timeField = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, `${label} doit etre au format HH:MM.`)

const booleanField = z
  .union([z.literal('on'), z.literal('true'), z.literal('false'), z.literal('')])
  .optional()
  .transform((v) => v === 'on' || v === 'true')

// ---------------------------------------------------------------------------
// Authentification
// ---------------------------------------------------------------------------

export const passwordSchema = z
  .string()
  .min(10, 'Le mot de passe doit contenir au moins 10 caracteres.')
  .max(128, 'Mot de passe trop long.')
  .regex(/[a-z]/, 'Le mot de passe doit contenir une minuscule.')
  .regex(/[A-Z]/, 'Le mot de passe doit contenir une majuscule.')
  .regex(/[0-9]/, 'Le mot de passe doit contenir un chiffre.')

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Adresse email invalide.')
  .max(180)

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mot de passe obligatoire.'),
})

export const registerSchema = z
  .object({
    firstName: trimmed(2, 60, 'Prenom'),
    lastName: trimmed(2, 60, 'Nom'),
    email: emailSchema,
    studentId: optionalText(40),
    // Facultatif : on peut creer son compte puis creer sa classe ou la
    // rejoindre ensuite.
    classCode: optionalText(40),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['confirmPassword'],
  })

export const forgotPasswordSchema = z.object({ email: emailSchema })

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, 'Jeton invalide.'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['confirmPassword'],
  })

export const updateProfileSchema = z.object({
  firstName: trimmed(2, 60, 'Prenom'),
  lastName: trimmed(2, 60, 'Nom'),
  phone: optionalText(30),
  studentId: optionalText(40),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Mot de passe actuel obligatoire.'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['confirmPassword'],
  })

// ---------------------------------------------------------------------------
// Classes (multi-tenant)
// ---------------------------------------------------------------------------

/** Creation d'une classe par un delegue : son espace de travail complet. */
export const classCreateSchema = z.object({
  name: trimmed(1, 80, 'Nom de la classe'),
  schoolName: trimmed(2, 140, 'Ecole / etablissement'),
  programName: optionalText(140),
  levelName: optionalText(80),
  academicYearLabel: trimmed(4, 20, 'Annee academique'),
  description: optionalText(500),
})

export const classUpdateSchema = z.object({
  name: trimmed(1, 80, 'Nom de la classe'),
  schoolName: trimmed(2, 140, 'Ecole / etablissement'),
  programName: optionalText(140),
  levelName: optionalText(80),
  description: optionalText(500),
})

export const joinClassSchema = z.object({
  code: trimmed(4, 40, "Code d'invitation").transform((v) => v.toUpperCase()),
  studentId: optionalText(40),
})

export const switchClassSchema = z.object({
  classGroupId: z.string().min(1, 'Classe obligatoire.'),
})

export const invitationSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER']),
  label: optionalText(80),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(180)
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v))
    .refine((v) => v === undefined || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), {
      message: 'Adresse email invalide.',
    }),
  maxUses: z.coerce.number().int().min(0).max(500).catch(0),
  days: z.coerce.number().int().min(1).max(365).catch(14),
})

export const memberRoleSchema = z.object({
  membershipId: z.string().min(1),
  role: z.enum(['ADMIN', 'MEMBER']),
})

export const memberStudentIdSchema = z.object({
  membershipId: z.string().min(1),
  studentId: optionalText(40),
})

// ---------------------------------------------------------------------------
// Structure academique
// ---------------------------------------------------------------------------

export const institutionSchema = z.object({
  name: trimmed(2, 120, 'Nom'),
  code: trimmed(2, 20, 'Code').transform((v) => v.toUpperCase()),
  city: optionalText(80),
  country: optionalText(80),
})

export const programSchema = z.object({
  institutionId: z.string().min(1, 'Etablissement obligatoire.'),
  name: trimmed(2, 120, 'Nom'),
  code: trimmed(1, 20, 'Code').transform((v) => v.toUpperCase()),
  description: optionalText(500),
})

export const levelSchema = z.object({
  programId: z.string().min(1, 'Filiere obligatoire.'),
  name: trimmed(1, 80, 'Nom'),
  rank: z.coerce.number().int().min(1, 'Rang minimum : 1.').max(12),
})

export const classSchema = z.object({
  levelId: z.string().min(1, 'Niveau obligatoire.'),
  name: trimmed(1, 80, 'Nom'),
  code: trimmed(2, 40, 'Code').transform((v) => v.toUpperCase()),
})

export const academicYearSchema = z
  .object({
    label: trimmed(4, 20, 'Libelle'),
    startsAt: dateField('Date de debut'),
    endsAt: dateField('Date de fin'),
    isCurrent: booleanField,
  })
  .refine((d) => d.endsAt > d.startsAt, {
    message: 'La date de fin doit suivre la date de debut.',
    path: ['endsAt'],
  })

export const semesterSchema = z
  .object({
    academicYearId: z.string().min(1, 'Annee academique obligatoire.'),
    number: z.coerce.number().int().min(1).max(12),
    label: trimmed(2, 60, 'Libelle'),
    startsAt: dateField('Date de debut'),
    endsAt: dateField('Date de fin'),
    isCurrent: booleanField,
  })
  .refine((d) => d.endsAt > d.startsAt, {
    message: 'La date de fin doit suivre la date de debut.',
    path: ['endsAt'],
  })

export const moduleSchema = z.object({
  classGroupId: optionalId,
  semesterId: z.string().min(1, 'Semestre obligatoire.'),
  code: trimmed(1, 20, 'Code').transform((v) => v.toUpperCase()),
  name: trimmed(2, 120, 'Nom'),
  description: optionalText(1000),
  teacherName: optionalText(120),
  teacherEmail: optionalText(180),
  credits: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : Number(v)))
    .refine((v) => v === undefined || (Number.isInteger(v) && v >= 0 && v <= 60), {
      message: 'Credits invalides (0 a 60).',
    }),
  color: optionalText(20),
})

// ---------------------------------------------------------------------------
// Programme / emploi du temps
// ---------------------------------------------------------------------------

export const scheduleSchema = z
  .object({
    classGroupId: optionalId,
    semesterId: z.string().min(1, 'Semestre obligatoire.'),
    moduleId: optionalId,
    type: z.enum(['COURS', 'TD', 'TP', 'EXAMEN', 'SOUTENANCE', 'AUTRE']),
    title: optionalText(140),
    date: dateField('Date'),
    startTime: timeField('Heure de debut'),
    endTime: timeField('Heure de fin'),
    room: optionalText(60),
    teacherName: optionalText(120),
    note: optionalText(500),
    isPublished: booleanField,
  })
  .refine((d) => d.endTime > d.startTime, {
    message: "L'heure de fin doit suivre l'heure de debut.",
    path: ['endTime'],
  })

/** Emploi du temps televerse (photo du planning officiel, PDF...). */
export const scheduleDocumentSchema = z.object({
  semesterId: optionalId,
  title: trimmed(2, 140, 'Titre'),
  note: optionalText(500),
})

// ---------------------------------------------------------------------------
// Ressources
// ---------------------------------------------------------------------------

export const resourceKindEnum = z.enum([
  'COURS',
  'TD',
  'TP',
  'EXAMEN',
  'PROJET',
  'CORRECTION',
  'PRESENTATION',
  'ADMINISTRATIF',
  'AUTRE',
])

export const resourceCreateSchema = z.object({
  classGroupId: optionalId,
  semesterId: z.string().min(1, 'Semestre obligatoire.'),
  moduleId: optionalId,
  projectId: optionalId,
  title: trimmed(2, 160, 'Titre'),
  description: optionalText(1000),
  kind: resourceKindEnum,
})

export const resourceUpdateSchema = z.object({
  id: z.string().min(1),
  title: trimmed(2, 160, 'Titre'),
  description: optionalText(1000),
  kind: resourceKindEnum,
  moduleId: optionalId,
})

// ---------------------------------------------------------------------------
// Annonces
// ---------------------------------------------------------------------------

export const announcementSchema = z.object({
  classGroupId: optionalId,
  moduleId: optionalId,
  title: trimmed(3, 160, 'Titre'),
  content: trimmed(3, 5000, 'Contenu'),
  level: z.enum(['NORMAL', 'IMPORTANT', 'URGENT']),
  category: z.enum([
    'GENERALE',
    'MODULE',
    'ADMINISTRATIF',
    'CHANGEMENT_SALLE',
    'CHANGEMENT_HORAIRE',
    'ABSENCE_PROFESSEUR',
    'REUNION',
    'EVENEMENT',
  ]),
  isPinned: booleanField,
  expiresAt: optionalDateField,
  // Identifiants des membres mentionnes : valides cote serveur contre la
  // liste reelle des membres de la classe.
  mentionedUserIds: z.array(z.string().min(1)).max(200).default([]),
  mentionsAll: booleanField,
})

// ---------------------------------------------------------------------------
// Projets et echeances
// ---------------------------------------------------------------------------

export const projectSchema = z
  .object({
    classGroupId: optionalId,
    semesterId: z.string().min(1, 'Semestre obligatoire.'),
    moduleId: optionalId,
    title: trimmed(3, 160, 'Titre'),
    description: optionalText(2000),
    instructions: optionalText(5000),
    teacherName: optionalText(120),
    startsAt: optionalDateField,
    dueAt: dateField('Date limite'),
  })
  .refine((d) => !d.startsAt || d.dueAt > d.startsAt, {
    message: 'La date limite doit suivre la date de debut.',
    path: ['dueAt'],
  })

export const projectLinkSchema = z.object({
  projectId: z.string().min(1),
  label: trimmed(1, 80, 'Libelle'),
  url: z.string().trim().url('URL invalide.').max(500),
})

export const deadlineSchema = z.object({
  classGroupId: optionalId,
  moduleId: optionalId,
  projectId: optionalId,
  title: trimmed(3, 160, 'Titre'),
  description: optionalText(1000),
  category: z.enum(['EXAMEN', 'DEVOIR', 'PROJET', 'PRESENTATION', 'RAPPORT', 'AUTRE']),
  dueAt: dateField('Date limite'),
  reminderAt: optionalDateField,
})

// ---------------------------------------------------------------------------
// Sondages
// ---------------------------------------------------------------------------

export const pollSchema = z
  .object({
    classGroupId: optionalId,
    title: trimmed(3, 160, 'Question'),
    description: optionalText(1000),
    allowMultiple: booleanField,
    isAnonymous: booleanField,
    endsAt: dateField('Date de cloture'),
    options: z
      .array(z.string().trim().min(1).max(160))
      .min(2, 'Au moins deux options sont necessaires.')
      .max(12, 'Douze options maximum.'),
  })
  .refine((d) => new Set(d.options.map((o) => o.toLowerCase())).size === d.options.length, {
    message: 'Les options doivent etre distinctes.',
    path: ['options'],
  })

export const voteSchema = z.object({
  pollId: z.string().min(1),
  optionIds: z.array(z.string().min(1)).min(1, 'Selectionnez au moins une option.'),
})

// ---------------------------------------------------------------------------
// Reclamations
// ---------------------------------------------------------------------------

export const complaintSchema = z.object({
  title: trimmed(3, 160, 'Titre'),
  category: z.enum(['COURS', 'PROFESSEUR', 'SALLE', 'PROGRAMME', 'ADMINISTRATIF', 'AUTRE']),
  description: trimmed(10, 5000, 'Description'),
  priority: z.enum(['BASSE', 'NORMALE', 'HAUTE', 'CRITIQUE']),
})

export const complaintMessageSchema = z.object({
  complaintId: z.string().min(1),
  body: trimmed(1, 3000, 'Message'),
})

export const complaintStatusSchema = z.object({
  complaintId: z.string().min(1),
  status: z.enum(['EN_ATTENTE', 'EN_COURS', 'RESOLU', 'FERME']),
})

// ---------------------------------------------------------------------------
// Administration des utilisateurs
// ---------------------------------------------------------------------------

export const adminUserCreateSchema = z.object({
  firstName: trimmed(2, 60, 'Prenom'),
  lastName: trimmed(2, 60, 'Nom'),
  email: emailSchema,
  role: z.enum(['ADMIN', 'DELEGUE', 'ETUDIANT']),
  studentId: optionalText(40),
  classGroupId: optionalId,
  password: passwordSchema,
})

export const adminUserUpdateSchema = z.object({
  userId: z.string().min(1),
  firstName: trimmed(2, 60, 'Prenom'),
  lastName: trimmed(2, 60, 'Nom'),
  role: z.enum(['ADMIN', 'DELEGUE', 'ETUDIANT']),
  studentId: optionalText(40),
  classGroupId: optionalId,
  isActive: booleanField,
})

// ---------------------------------------------------------------------------
// Recherche et pagination
// ---------------------------------------------------------------------------

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
})

export const searchSchema = z.object({
  q: z.string().trim().max(120).optional(),
  moduleId: z.string().trim().optional(),
  semesterId: z.string().trim().optional(),
  kind: z.string().trim().optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
})

// ---------------------------------------------------------------------------
// Aide au parsing des FormData
// ---------------------------------------------------------------------------

export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; fieldErrors: Record<string, string[]>; message: string }

/** Parse un FormData avec un schema zod et renvoie des erreurs par champ. */
export function parseForm<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData,
  arrayFields: string[] = [],
): ParseResult<z.infer<T>> {
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue
    if (arrayFields.includes(key)) {
      const existing = raw[key]
      if (Array.isArray(existing)) existing.push(value)
      else raw[key] = [value]
    } else {
      raw[key] = value
    }
  }
  // Un champ tableau absent du FormData doit exister sous forme de tableau vide.
  for (const field of arrayFields) {
    if (!(field in raw)) raw[field] = []
  }

  const result = schema.safeParse(raw)
  if (result.success) return { success: true, data: result.data }

  const flattened = result.error.flatten()
  const first =
    Object.values(flattened.fieldErrors).flat()[0] ??
    flattened.formErrors[0] ??
    'Formulaire invalide.'

  return {
    success: false,
    fieldErrors: flattened.fieldErrors as Record<string, string[]>,
    message: first,
  }
}
