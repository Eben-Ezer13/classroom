export const MESSAGE_REACTIONS = ['👍', '❤️', '😂', '👀', '🎉'] as const
export type MessageReactionEmoji = (typeof MESSAGE_REACTIONS)[number]

export function isMessageReactionEmoji(value: unknown): value is MessageReactionEmoji {
  return (
    typeof value === 'string' &&
    (MESSAGE_REACTIONS as readonly string[]).includes(value)
  )
}
