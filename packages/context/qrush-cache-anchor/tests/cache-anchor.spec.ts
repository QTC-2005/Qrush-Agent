import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import CacheAnchor, { anchorFingerprint } from '@deepseek-ai/dsh-qrush-cache-anchor'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'

/** Minimal request envelope: only the fields `observe` reads. */
function request(sessionId: string, system: string, tools: unknown = []): GenerateOptions {
  return { sessionId, system, tools } as unknown as GenerateOptions
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

    // First observation sets the anchor without counting a reset.
    expect(ctx.cacheAnchor.observe(request('s1', 'sys-A'))).toBe(0)
    expect(ctx.cacheAnchor.snapshot('s1')).toMatchObject({ resets: 0 })

    // Identical prefix keeps the anchor stable.
    expect(ctx.cacheAnchor.observe(request('s1', 'sys-A'))).toBe(0)
    expect(ctx.cacheAnchor.snapshot('s1')).toMatchObject({ resets: 0 })

    // A changed system prompt resets the anchor exactly once.
    expect(ctx.cacheAnchor.observe(request('s1', 'sys-B'))).toBe(1)
    expect(ctx.cacheAnchor.snapshot('s1')).toMatchObject({ resets: 1 })
    expect(ctx.cacheAnchor.snapshot('s1')?.lastChangedAt).not.toBeUndefined()

    // Sessions are independent.
    expect(ctx.cacheAnchor.snapshot('s2')).toBeUndefined()
    ctx.cacheAnchor.observe(request('s2', 'sys-A'))
    expect(ctx.cacheAnchor.snapshot('s2')).toMatchObject({ resets: 0 })

    await ctx.fiber.dispose()
    expect(ctx.get('cacheAnchor')).toBeUndefined()
  })
})
