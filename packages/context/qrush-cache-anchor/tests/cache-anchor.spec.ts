import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import CacheAnchor, { anchorFingerprint, cacheAnchorProjectionDefinition } from '@deepseek-ai/dsh-qrush-cache-anchor'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'
import type { SessionEvent } from '@deepseek-ai/dsh-session'

/** Minimal request envelope: only the fields `observe` reads. */
function request(sessionId: string, system: string, tools: unknown = []): GenerateOptions {
  return { sessionId, system, tools } as unknown as GenerateOptions
}

/** Minimal `request/header` event: only the fields the projection reads. */
function headerEvent(seq: number, system: string, tools: unknown = []): SessionEvent {
  return {
    type: 'request/header',
    seq,
    time: seq * 1000,
    data: { header: { config: {}, system, tools }, reason: 'initial' },
  } as unknown as SessionEvent
}

describe('anchorFingerprint', () => {
  it('is deterministic for equal prefixes', () => {
    expect(anchorFingerprint('system', [])).toBe(anchorFingerprint('system', []))
  })

  it('distinguishes a changed system prompt', () => {
    expect(anchorFingerprint('system-A', [])).not.toBe(anchorFingerprint('system-B', []))
  })

  it('distinguishes an absent system from an empty system', () => {
    expect(anchorFingerprint(undefined, [])).not.toBe(anchorFingerprint('', []))
  })

  it('is order-sensitive over tools', () => {
    const tools = [{ name: 'a' }, { name: 'b' }] as unknown
    const reversed = [{ name: 'b' }, { name: 'a' }] as unknown
    expect(anchorFingerprint(undefined, tools as never)).not.toBe(anchorFingerprint(undefined, reversed as never))
  })
})

describe('CacheAnchor', () => {
  it('registers ctx.cacheAnchor and counts prefix resets per session', async () => {
    const ctx = new Context()
    await ctx.plugin(CacheAnchor)
    expect(ctx.cacheAnchor).toBeInstanceOf(CacheAnchor)
    expect(ctx.cacheAnchor.snapshot('s1')).toBeUndefined()

    expect(ctx.cacheAnchor.observe(request('s1', 'sys-A'))).toBe(0)
    expect(ctx.cacheAnchor.snapshot('s1')).toMatchObject({ resets: 0 })

    expect(ctx.cacheAnchor.observe(request('s1', 'sys-A'))).toBe(0)
    expect(ctx.cacheAnchor.snapshot('s1')).toMatchObject({ resets: 0 })

    expect(ctx.cacheAnchor.observe(request('s1', 'sys-B'))).toBe(1)
    expect(ctx.cacheAnchor.snapshot('s1')).toMatchObject({ resets: 1 })
    expect(ctx.cacheAnchor.snapshot('s1')?.lastChangedAt).not.toBeUndefined()

    expect(ctx.cacheAnchor.snapshot('s2')).toBeUndefined()
    ctx.cacheAnchor.observe(request('s2', 'sys-A'))
    expect(ctx.cacheAnchor.snapshot('s2')).toMatchObject({ resets: 0 })

    await ctx.fiber.dispose()
    expect(ctx.get('cacheAnchor')).toBeUndefined()
  })
})

describe('cacheAnchorProjectionDefinition', () => {
  it('folds request/header events into a durable fingerprint and reset count', () => {
    const def = cacheAnchorProjectionDefinition
    let state = def.init()

    // An unrelated event returns the same state reference.
    const unrelated = { type: 'user/message', seq: 0, time: 0, data: {} } as unknown as SessionEvent
    expect(def.apply(state, unrelated)).toBe(state)

    // First header sets the anchor without a reset.
    state = def.apply(state, headerEvent(1, 'sys-A'))
    expect(state.fingerprint).not.toBeNull()
    expect(state.resets).toBe(0)
    expect(def.view(state)).toMatchObject({ resets: 0, lastChangedSeq: null })

    // An identical header keeps the anchor stable.
    state = def.apply(state, headerEvent(2, 'sys-A'))
    expect(state.resets).toBe(0)

    // A changed header counts one reset and records its seq.
    state = def.apply(state, headerEvent(3, 'sys-B'))
    expect(state.resets).toBe(1)
    expect(def.view(state)).toMatchObject({ resets: 1, lastChangedSeq: 3 })
  })
})
