import assert from 'node:assert/strict'
import { test } from 'node:test'
import { allowedTargets, canTransition, handoffComplete, sideOf, type HandoffGate } from './phases.ts'

const accepted = (kind: HandoffGate['kind'], gaps: HandoffGate['gaps'] = []): HandoffGate => ({
  kind,
  acceptedAt: new Date(),
  gaps,
})
const draft = (kind: HandoffGate['kind']): HandoffGate => ({ kind, acceptedAt: null, gaps: [] })

test('sideOf maps phases to sides', () => {
  assert.equal(sideOf('qualify'), 'presales')
  assert.equal(sideOf('live'), 'postsales')
  assert.equal(sideOf('closed'), null)
})

test('free movement within a side, both directions', () => {
  assert.ok(canTransition({ side: 'presales', phase: 'qualify' }, 'prototype').ok)
  assert.ok(canTransition({ side: 'presales', phase: 'prototype' }, 'discover').ok)
  assert.ok(canTransition({ side: 'postsales', phase: 'build' }, 'adopt').ok)
})

test('pre to post requires technical_win and a complete handoff', () => {
  assert.equal(canTransition({ side: 'presales', phase: 'scope' }, 'kickoff').ok, false)
  assert.equal(canTransition({ side: 'presales', phase: 'technical_win' }, 'kickoff').ok, false)
  assert.equal(canTransition({ side: 'presales', phase: 'technical_win' }, 'kickoff', [draft('pre_to_post')]).ok, false)
  assert.equal(
    canTransition({ side: 'presales', phase: 'technical_win' }, 'kickoff', [
      accepted('pre_to_post', [{ severity: 'blocking', resolvedAt: null }]),
    ]).ok,
    false,
  )
  assert.ok(
    canTransition({ side: 'presales', phase: 'technical_win' }, 'kickoff', [
      accepted('pre_to_post', [
        { severity: 'blocking', resolvedAt: new Date() },
        { severity: 'high', resolvedAt: null },
      ]),
    ]).ok,
  )
  // the wrong handoff kind does not unlock the gate
  assert.equal(canTransition({ side: 'presales', phase: 'technical_win' }, 'kickoff', [accepted('post_to_cs')]).ok, false)
})

test('no other cross-side moves', () => {
  assert.equal(canTransition({ side: 'presales', phase: 'technical_win' }, 'build', [accepted('pre_to_post')]).ok, false)
  assert.equal(canTransition({ side: 'postsales', phase: 'kickoff' }, 'scope').ok, false)
})

test('closing rules', () => {
  assert.ok(canTransition({ side: 'presales', phase: 'discover' }, 'closed').ok, 'lost/deferred pre-sales')
  assert.equal(canTransition({ side: 'postsales', phase: 'live' }, 'closed').ok, false)
  assert.equal(canTransition({ side: 'postsales', phase: 'handed_off' }, 'closed').ok, false)
  assert.ok(canTransition({ side: 'postsales', phase: 'handed_off' }, 'closed', [accepted('post_to_cs')]).ok)
  assert.equal(canTransition({ side: 'postsales', phase: 'closed' }, 'live').ok, false, 'closed is terminal')
})

test('handoffComplete and allowedTargets', () => {
  assert.equal(handoffComplete(null), false)
  assert.equal(handoffComplete(draft('pre_to_post')), false)
  assert.equal(handoffComplete(accepted('pre_to_post')), true)
  assert.deepEqual(allowedTargets({ side: 'presales', phase: 'qualify' }), [
    'qualify',
    'discover',
    'scope',
    'prototype',
    'technical_win',
    'closed',
  ])
  assert.ok(allowedTargets({ side: 'presales', phase: 'technical_win' }, [accepted('pre_to_post')]).includes('kickoff'))
})
