import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
// Type-only: pulls the scoped event declarations (system-prompt/assemble and
// agent/pre-step) so the waterfall calls type-check against real contracts.
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { apply, DEFAULT_BOOTSTRAP_TOOLS, name, resolveConfig } from '@deepseek-ai/dsh-qrush-anchor'

/** An assembled tool schema (name/description/parameters, per ToolSchema). */
function tool(name: string): { name: string; description: string; parameters: Record<string, unknown> } {
  return { name, description: `tool ${name}`, parameters: {} }
}

/** A fake agent whose session carries a durable event log. */
function fakeAgent(id: string, events: Array<{ type: string; seq?: number }>): never {
  return {
    id,
    session: { id, events },
  } as never
}

/** Assemble a prompt through the anchor filter for one agent. */
async function assembleThrough(ctx: Context, agent: never) {
  const assembly = {
    sections: [],
    contexts: [{ name: 'sandbox:policy', text: 'sandbox snapshot' }],
    tools: [
      tool('read'), tool('write'), tool('edit'), tool('glob'), tool('grep'),
      tool('pwsh'), tool('web_search'), tool('subagent'), tool('skill'),
      tool('todo_write'), tool('ask_user_question'),
    ],
    variables: {},
  }
  return ctx.waterfall(
    'system-prompt/assemble',
    assembly,
    { agent },
    (() => Promise.resolve(assembly)) as never,
  ) as Promise<{ contexts: Array<{ name: string }>; tools: Array<{ name: string }> }>
}

describe('resolveConfig', () => {
  it('applies defaults for an absent config', () => {
    const value = resolveConfig(undefined)
    expect(value.enabled).toBe(true)
    expect(value.bootstrapTools).toEqual([...DEFAULT_BOOTSTRAP_TOOLS])
    expect(value.compactionTools.length).toBeGreaterThanOrEqual(value.bootstrapTools.length)
    expect(value.allowKinds.has('skill-invocation')).toBe(true)
  })

  it('rejects unknown config keys', () => {
    expect(() => resolveConfig({ bootstrapz: true } as never)).toThrow(/unknown config key/)
  })

  it('rejects invalid promoteOn and empty tool lists', () => {
    expect(() => resolveConfig({ promoteOn: 'nope' } as never)).toThrow(/promoteOn/)
    expect(() => resolveConfig({ bootstrapTools: [] } as never)).toThrow(/bootstrapTools/)
    expect(() => resolveConfig({ bootstrapTools: [42] } as never)).toThrow(/bootstrapTools/)
  })

  it('accepts an explicitly empty allowKinds (only the claimed batch survives)', () => {
    const value = resolveConfig({ allowKinds: [] })
    expect(value.allowKinds.size).toBe(0)
  })
})

describe('apply / system-prompt/assemble', () => {
  it('narrows the catalog to the bootstrap set and blanks contexts while unpromoted', async () => {
    const ctx = new Context()
    await ctx.plugin({ name, inject: [], apply })
    const result = await assembleThrough(ctx, fakeAgent('s1', []))
    expect(result.contexts).toEqual([])
    expect(result.tools.map(t => t.name).sort()).toEqual([...DEFAULT_BOOTSTRAP_TOOLS].sort())
    await ctx.fiber.dispose()
  })

  it('keeps the full catalog and contexts after promotion', async () => {
    const ctx = new Context()
    await ctx.plugin({ name, inject: [], apply })
    const agent = fakeAgent('s1', [{ type: 'assistant/message', seq: 2 }])
    const result = await assembleThrough(ctx, agent)
    expect(result.tools).toHaveLength(11)
    expect(result.contexts).toHaveLength(1)
    await ctx.fiber.dispose()
  })

  it('exposes the full catalog when a bootstrap tool is missing from the universe', async () => {
    const ctx = new Context()
    await ctx.plugin({ name, inject: [], apply })
    const assembly = {
      sections: [],
      contexts: [],
      tools: [tool('pwsh'), tool('web_search')], // no read/write/... at all
      variables: {},
    }
    const result = await ctx.waterfall(
      'system-prompt/assemble',
      assembly,
      { agent: fakeAgent('s2', []) },
      (() => Promise.resolve(assembly)) as never,
    ) as { tools: Array<{ name: string }> }
    // Degradation: keep everything rather than brick the request.
    expect(result.tools.map(t => t.name).sort()).toEqual(['pwsh', 'web_search'])
    await ctx.fiber.dispose()
  })

  it('a compaction boundary falls back to the bootstrap + compaction work set', async () => {
    const ctx = new Context()
    await ctx.plugin({ name, inject: [], apply })
    const agent = fakeAgent('s1', [
      { type: 'assistant/message', seq: 2 },
      { type: 'compaction/end', seq: 9 },
    ])
    const result = await assembleThrough(ctx, agent)
    const names = new Set(result.tools.map(t => t.name))
    expect(names.has('read')).toBe(true)
    expect(names.has('todo_write')).toBe(true)
    expect(names.has('web_search')).toBe(false)
    await ctx.fiber.dispose()
  })
})

describe('apply / agent/pre-step gate', () => {
  function claimedMessage(id: string, kind = 'user'): never {
    return { id, content: [{ type: 'text', text: id }], source: { kind } } as never
  }

  it('keeps only the claimed batch plus allowed kinds while unpromoted', async () => {
    const ctx = new Context()
    await ctx.plugin({ name, inject: [], apply })
    const claimed = [claimedMessage('claimed-1')]
    const injected = [
      claimedMessage('injected-skill-catalog', 'skill-catalog'),
      claimedMessage('injected-agents', 'plugin'),
      claimedMessage('user-skill-gesture', 'skill-invocation'),
    ]
    const agent = fakeAgent('s1', [])
    const fallback = ((p: { messages: unknown[] }) => Promise.resolve({ kind: 'enter', messages: [...p.messages, ...injected] })) as never
    const decision = await ctx.waterfall(
      'agent/pre-step',
      { agent, messages: claimed, turn: 1, step: 1, signal: new AbortController().signal },
      fallback,
    ) as { kind: 'enter'; messages: Array<{ id: string }> }
    const ids = decision.messages.map(m => m.id).sort()
    expect(ids).toEqual(['claimed-1', 'user-skill-gesture'])
    await ctx.fiber.dispose()
  })

  it('keeps every message after promotion', async () => {
    const ctx = new Context()
    await ctx.plugin({ name, inject: [], apply })
    const claimed = [claimedMessage('claimed-1')]
    const injected = [claimedMessage('injected-skill-catalog', 'skill-catalog')]
    const agent = fakeAgent('s1', [{ type: 'tool/call', seq: 1 }])
    const fallback = ((p: { messages: unknown[] }) => Promise.resolve({ kind: 'enter', messages: [...p.messages, ...injected] })) as never
    const decision = await ctx.waterfall(
      'agent/pre-step',
      { agent, messages: claimed, turn: 1, step: 1, signal: new AbortController().signal },
      fallback,
    ) as { kind: 'enter'; messages: Array<{ id: string }> }
    expect(decision.messages.map(m => m.id).sort()).toEqual(['claimed-1', 'injected-skill-catalog'])
    await ctx.fiber.dispose()
  })

  it('passes a reject decision through untouched', async () => {
    const ctx = new Context()
    await ctx.plugin({ name, inject: [], apply })
    const agent = fakeAgent('s1', [])
    const fallback = (() => Promise.resolve({ kind: 'reject' })) as never
    const decision = await ctx.waterfall(
      'agent/pre-step',
      { agent, messages: [claimedMessage('c1')], turn: 1, step: 1, signal: new AbortController().signal },
      fallback,
    ) as { kind: 'reject' }
    expect(decision.kind).toBe('reject')
    await ctx.fiber.dispose()
  })

  it('enabled=false leaves both paths untouched', async () => {
    const ctx = new Context()
    await ctx.plugin({ name, inject: [], apply: (c: Context) => apply(c, { enabled: false }) })
    const claimed = [claimedMessage('claimed-1')]
    const injected = [claimedMessage('injected', 'skill-catalog')]
    const agent = fakeAgent('s1', [])
    const fallback = ((p: { messages: unknown[] }) => Promise.resolve({ kind: 'enter', messages: [...p.messages, ...injected] })) as never
    const decision = await ctx.waterfall(
      'agent/pre-step',
      { agent, messages: claimed, turn: 1, step: 1, signal: new AbortController().signal },
      fallback,
    ) as { kind: 'enter'; messages: Array<{ id: string }> }
    expect(decision.messages.map(m => m.id).sort()).toEqual(['claimed-1', 'injected'])
    await ctx.fiber.dispose()
  })
})
