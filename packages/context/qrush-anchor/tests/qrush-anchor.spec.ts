import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
// Type-only: pulls the scoped event declarations (system-prompt/assemble and
// agent/pre-step) so the waterfall calls type-check against real contracts.
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-system-prompt'
import {
  apply, DEFAULT_BOOTSTRAP_TOOLS, DEFAULT_HEAVY_TOOLS, name, resolveConfig, unlockedFor,
} from '@deepseek-ai/dsh-qrush-anchor'
import type { AnchorSessionLike } from '@deepseek-ai/dsh-qrush-anchor/src/epoch.ts'

/** An assembled tool schema (name/description/parameters, per ToolSchema). */
function tool(name: string): { name: string; description: string; parameters: Record<string, unknown> } {
  return { name, description: `tool ${name}`, parameters: {} }
}

/** A fake agent whose session carries a durable event log. */
function fakeAgent(id: string, events: Array<{ type: string; seq?: number; data?: { name?: string; arguments?: string } }>): never {
  return {
    id,
    session: { id, events },
  } as never
}

/**
 * Mount the anchor plugin on a bare cordis Context, providing a mock `tools`
 * service (the plugin injects it for `dev_tool_search` registration).
 */
async function mountAnchor(ctx: Context, config?: Parameters<typeof apply>[1]): Promise<void> {
  ctx.provide('tools' as never, {
    register: (def: never) => { void def; return () => {} },
    schemas: () => [],
  } as never)
  await ctx.plugin({ name, inject: ['tools'], apply: (c: Context) => apply(c, config) })
}

/** Assemble a prompt through the anchor filter for one agent. */
async function assembleThrough(ctx: Context, agent: never) {
  const assembly = {
    sections: [],
    contexts: [{ name: 'sandbox:policy', text: 'sandbox snapshot' }],
    tools: [
      tool('read'), tool('write'), tool('edit'), tool('glob'), tool('grep'),
      tool('pwsh'), tool('web_search'), tool('subagent'), tool('skill'),
      tool('todo_write'), tool('ask_user_question'), tool('dev_tool_search'),
      tool('memoir_record'), tool('workflow'),
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

describe('unlockedFor', () => {
  const session = (events: Array<{ type: string; seq?: number; data?: { name?: string; arguments?: string } }>): AnchorSessionLike =>
    ({ id: 's1', events })

  it('collects exact tool names from dev_tool_search tool/call arguments', () => {
    const unlocked = unlockedFor(session([
      { type: 'tool/call', seq: 1, data: { name: 'dev_tool_search', arguments: '{"toolNames":["web_search","subagent"]}' } },
    ]))
    expect([...unlocked].sort()).toEqual(['subagent', 'web_search'])
  })

  it('ignores non-dev_tool_search calls, malformed JSON, and non-array toolNames', () => {
    const unlocked = unlockedFor(session([
      { type: 'tool/call', seq: 1, data: { name: 'read', arguments: '{"path":"x"}' } },
      { type: 'tool/call', seq: 2, data: { name: 'dev_tool_search', arguments: 'not json' } },
      { type: 'tool/call', seq: 3, data: { name: 'dev_tool_search', arguments: '{"toolNames":"web_search"}' } },
    ]))
    expect(unlocked.size).toBe(0)
  })

  it('returns empty for undefined sessions', () => {
    expect(unlockedFor(undefined).size).toBe(0)
  })
})

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

describe('dev_tool_search', () => {
  /** Register the tool against a mock tools service and return its definition. */
  async function registeredDefinition(heavyTools: readonly string[] = [...DEFAULT_HEAVY_TOOLS]) {
    let captured: { execute: (args: unknown, exec: unknown) => Promise<{ text: string }> } | undefined
    const fakeTools = {
      schemas: () => [
        { name: 'web_search', description: 'internet search' },
        { name: 'subagent', description: 'delegate to a sub-agent' },
        { name: 'read', description: 'read a file' },
      ],
    }
    await import('@deepseek-ai/dsh-qrush-anchor/src/dev-tool-search.ts').then(async ({ registerDevToolSearch }) => {
      const ctx = {
        tools: {
          register: (def: never) => { captured = def as never; return () => {} },
          ...fakeTools,
        },
      }
      registerDevToolSearch(ctx as never, new Set(heavyTools))
    })
    if (captured === undefined) throw new Error('tool not registered')
    return captured
  }

  it('searches the full catalog by keyword', async () => {
    const def = await registeredDefinition()
    const result = await def.execute({ query: 'web' }, undefined)
    expect(result.text).toContain('web_search')
    expect(result.text).not.toContain('subagent')
  })

  it('announces unlocks for heavy tools and ignores already-available names', async () => {
    const def = await registeredDefinition(['web_search'])
    const result = await def.execute({ toolNames: ['web_search', 'read'] }, undefined)
    expect(result.text).toContain('Unlocked for the next request: web_search')
    expect(result.text).toContain('Already available (no unlock needed): read')
  })

  it('prompts for input when neither query nor toolNames is given', async () => {
    const def = await registeredDefinition()
    const result = await def.execute({}, undefined)
    expect(result.text).toContain('Provide `query` to search the catalog')
  })

  it('degrades gracefully when the catalog search is unavailable', async () => {
    let captured: { execute: (args: unknown, exec: unknown) => Promise<{ text: string }> } | undefined
    const ctx = {
      tools: {
        register: (def: never) => { captured = def as never; return () => {} },
        schemas: () => { throw new Error('registry down') },
      },
    }
    await import('@deepseek-ai/dsh-qrush-anchor/src/dev-tool-search.ts').then(async ({ registerDevToolSearch }) => {
      registerDevToolSearch(ctx as never, new Set())
    })
    const result = await captured!.execute({ query: 'web' }, undefined)
    expect(result.text).toContain('catalog search unavailable')
  })
})

describe('apply / system-prompt/assemble', () => {
  it('narrows the catalog to the bootstrap set and blanks contexts while unpromoted', async () => {
    const ctx = new Context()
    await mountAnchor(ctx)
    const result = await assembleThrough(ctx, fakeAgent('s1', []))
    expect(result.contexts).toEqual([])
    expect(result.tools.map(t => t.name).sort()).toEqual([...DEFAULT_BOOTSTRAP_TOOLS].sort())
    await ctx.fiber.dispose()
  })

  it('keeps the resident catalog after promotion: hides heavy tools, keeps third-party tools', async () => {
    const ctx = new Context()
    await mountAnchor(ctx)
    const agent = fakeAgent('s1', [{ type: 'assistant/message', seq: 2 }])
    const result = await assembleThrough(ctx, agent)
    const names = new Set(result.tools.map(t => t.name))
    // Heavy tools hidden (one dev_tool_search away).
    for (const heavy of DEFAULT_HEAVY_TOOLS) {
      if (['web_search', 'subagent', 'workflow'].includes(heavy)) expect(names.has(heavy)).toBe(false)
    }
    // Non-heavy tools stay visible, including third-party plugin tools.
    expect(names.has('read')).toBe(true)
    expect(names.has('skill')).toBe(true)
    expect(names.has('dev_tool_search')).toBe(true)
    expect(names.has('memoir_record')).toBe(true)
    expect(result.contexts).toHaveLength(1)
    await ctx.fiber.dispose()
  })

  it('restores an unlocked heavy tool on the next request', async () => {
    const ctx = new Context()
    await mountAnchor(ctx)
    const agent = fakeAgent('s1', [
      { type: 'tool/call', seq: 1 },
      { type: 'tool/call', seq: 2, data: { name: 'dev_tool_search', arguments: '{"toolNames":["web_search"]}' } },
    ])
    const result = await assembleThrough(ctx, agent)
    const names = new Set(result.tools.map(t => t.name))
    expect(names.has('web_search')).toBe(true)
    expect(names.has('workflow')).toBe(false)
    await ctx.fiber.dispose()
  })

  it('exposes the full catalog when a bootstrap tool is missing from the universe', async () => {
    const ctx = new Context()
    await mountAnchor(ctx)
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
    await mountAnchor(ctx)
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
    await mountAnchor(ctx)
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
    await mountAnchor(ctx)
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
    await mountAnchor(ctx)
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
    await mountAnchor(ctx, { enabled: false })
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
