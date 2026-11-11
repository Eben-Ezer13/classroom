import assert from 'node:assert/strict'
import test from 'node:test'
import { canAccessConversation, canManageMessages } from '../src/lib/messages/policy.mjs'
import { checkUploadFile } from '../src/lib/upload-policy.mjs'

const activeMembership = {
  userId: 'student-1',
  classGroupId: 'class-1',
  role: 'MEMBER',
  isActive: true,
  user: { isActive: true, deletedAt: null },
  classGroup: { isActive: true, deletedAt: null },
}
const conversation = { id: 'conversation-1', classGroupId: 'class-1' }

test('conversation access requires an active membership in the same class', () => {
  assert.equal(
    canAccessConversation(activeMembership, 'student-1', 'class-1', conversation),
    true,
  )
  assert.equal(
    canAccessConversation(activeMembership, 'other-student', 'class-1', conversation),
    false,
  )
  assert.equal(
    canAccessConversation(activeMembership, 'student-1', 'class-2', conversation),
    false,
  )
  assert.equal(
    canAccessConversation(activeMembership, 'student-1', null, conversation),
    false,
  )
})

test('inactive or deleted accounts and classes cannot access conversations', () => {
  for (const membership of [
    { ...activeMembership, isActive: false },
    { ...activeMembership, user: { isActive: false, deletedAt: null } },
    { ...activeMembership, user: { isActive: true, deletedAt: new Date() } },
    { ...activeMembership, classGroup: { isActive: false, deletedAt: null } },
    { ...activeMembership, classGroup: { isActive: true, deletedAt: new Date() } },
  ]) {
    assert.equal(
      canAccessConversation(membership, 'student-1', 'class-1', conversation),
      false,
    )
  }
})

test('conversation IDs and class ownership are checked before message access', () => {
  assert.equal(
    canAccessConversation(
      activeMembership,
      'student-1',
      'class-1',
      conversation,
      'conversation-2',
    ),
    false,
  )
  assert.equal(
    canAccessConversation(
      activeMembership,
      'student-1',
      'class-1',
      { ...conversation, classGroupId: 'class-2' },
    ),
    false,
  )
})

test('delegate-only message actions reject students', () => {
  assert.equal(canManageMessages('ADMIN'), true)
  assert.equal(canManageMessages('MEMBER'), false)
  assert.equal(canManageMessages(null), false)
})

test('message uploads enforce empty, size, and allowed-extension checks', () => {
  const rule = {
    maxSize: 100,
    mimeTypes: { 'image/png': ['.png'], 'video/mp4': ['.mp4'] },
    formats: 'PNG, MP4',
  }
  const formatSize = (bytes) => `${bytes} octets`
  assert.deepEqual(checkUploadFile({ name: 'photo.PNG', size: 20 }, rule, formatSize), {
    ok: true,
    mimeType: 'image/png',
  })
  assert.equal(checkUploadFile({ name: 'empty.png', size: 0 }, rule, formatSize).ok, false)
  assert.equal(checkUploadFile({ name: 'large.mp4', size: 101 }, rule, formatSize).ok, false)
  assert.equal(checkUploadFile({ name: 'script.exe', size: 20 }, rule, formatSize).ok, false)
  assert.equal(checkUploadFile({ name: 'no-extension', size: 20 }, rule, formatSize).ok, false)
})
