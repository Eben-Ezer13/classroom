/**
 * @typedef {{
 *   userId: string,
 *   classGroupId: string,
 *   role: string,
 *   isActive: boolean,
 *   user: { isActive: boolean, deletedAt: Date | null },
 *   classGroup: { isActive: boolean, deletedAt: Date | null }
 * }} ClassMembership
 */

/**
 * @param {ClassMembership | null | undefined} membership
 * @param {string} userId
 * @param {string | null} classGroupId
 * @param {{ id: string, classGroupId: string } | null | undefined} conversation
 * @param {string | null | undefined} requestedConversationId
 */
export function canAccessConversation(
  membership,
  userId,
  classGroupId,
  conversation,
  requestedConversationId,
) {
  return Boolean(
    classGroupId &&
      membership &&
      membership.userId === userId &&
      membership.classGroupId === classGroupId &&
      membership.isActive &&
      membership.user.isActive &&
      membership.user.deletedAt === null &&
      membership.classGroup.isActive &&
      membership.classGroup.deletedAt === null &&
      conversation &&
      conversation.classGroupId === classGroupId &&
      (!requestedConversationId || requestedConversationId === conversation.id),
  )
}

/** @param {string | null | undefined} role */
export function canManageMessages(role) {
  return role === 'ADMIN'
}
