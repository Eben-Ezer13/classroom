import 'server-only'
import bcrypt from 'bcryptjs'

const ROUNDS = 12

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

/**
 * Regles de robustesse appliquees a l'inscription et a la reinitialisation.
 * Retourne la liste des regles non satisfaites (vide si le mot de passe est valide).
 */
export function passwordIssues(password: string): string[] {
  const issues: string[] = []
  if (password.length < 10) issues.push('au moins 10 caractères')
  if (!/[a-z]/.test(password)) issues.push('une minuscule')
  if (!/[A-Z]/.test(password)) issues.push('une majuscule')
  if (!/[0-9]/.test(password)) issues.push('un chiffre')
  return issues
}
