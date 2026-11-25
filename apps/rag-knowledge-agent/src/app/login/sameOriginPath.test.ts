import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sameOriginPath } from './sameOriginPath.ts'

test('keeps paths on this origin', () => {
  assert.equal(sameOriginPath('/dashboard'), '/dashboard')
  assert.equal(sameOriginPath('/agents/1/chat?x=1#h'), '/agents/1/chat?x=1#h')
  assert.equal(sameOriginPath('/%2F%2Fevil.com'), '/%2F%2Fevil.com')
})

test('rejects targets a browser would send to another origin', () => {
  for (const value of [
    '//evil.com',
    '/\\evil.com',
    '/.//evil.com',
    '/a/..//evil.com',
    '/%2e//evil.com',
    '/./\\evil.com',
    '/\t/evil.com',
    'https://evil.com',
    'javascript:alert(1)',
    'dashboard',
    '',
    null,
  ]) {
    assert.equal(sameOriginPath(value), null, JSON.stringify(value))
  }
})
