import { describe, expect, it } from 'vitest'
import { createEpochPromotion } from '@deepseek-ai/dsh-qrush-anchor/src/epoch.ts'
import type { AnchorSessionLike } from '@deepseek-ai/dsh-qrush-anchor/src/epoch.ts'

/** Build a fake session with a durable log. */
function session(id: string, events: Array<{ type: string; seq?: number }>): AnchorSessionLike {
  return { id, events }
}

/** The agent view the tracker reads. */
function agentWith(s: AnchorSessionLike): { session: AnchorSessionLike } {
  return { session: s }
}

describe('createEpochPromotion / cold scan', () => {
  it('treats an empty log as unpromoted (boundary -1)', () => {
    const promotion = createEpochPromotion(['tool/call', 'assistant/message'])
    expect(promotion.status(agentWith(session('s1', [])))).toEqual({ boundary: -1, promoted: false })
  })

  it('promotes on the first durable tool/call', () => {
    const promotion = createEpochPromotion(['tool/call', 'assistant/message'])
    const s = session('s1', [{ type: 'tool/call', seq: 5 }])
    expect(promotion.status(agentWith(s))).toEqual({ boundary: -1, promoted: true })
  })

  it('promotes on the first durable assistant/message', () => {
    const promotion = createEpochPromotion(['tool/call', 'assistant/message'])
    const s = session('s1', [{ type: 'assistant/message', seq: 2 }])
    expect(promotion.status(agentWith(s)).promoted).toBe(true)
  })

  it('does not promote on other durable events', () => {
    const promotion = createEpochPromotion(['tool/call', 'assistant/message'])
    const s = session('s1', [{ type: 'user/message', seq: 1 }, { type: 'system/status', seq: 2 }])
    expect(promotion.status(agentWith(s)).promoted).toBe(false)
  })

  it('promoteOn tool-call ignores an assistant/message-only log', () => {
    const promotion = createEpochPromotion(['tool/call'])
    const s = session('s1', [{ type: 'assistant/message', seq: 2 }])
    expect(promotion.status(agentWith(s)).promoted).toBe(false)
  })

  it('memoizes the scan per session id', () => {
    const promotion = createEpochPromotion(['tool/call', 'assistant/message'])
    const s = session('s1', [{ type: 'tool/call', seq: 5 }])
    promotion.status(agentWith(s))
    // A second status call with an extended log still reads the memo (no rescans).
    const extended = session('s1', [{ type: 'tool/call', seq: 5 }, { type: 'compaction/end', seq: 9 }])
    expect(promotion.status(agentWith(extended))).toEqual({ boundary: -1, promoted: true })
  })

  it('returns promoted for undefined agents and sessions', () => {
    const promotion = createEpochPromotion(['tool/call'])
    expect(promotion.status(undefined)).toEqual({ boundary: -1, promoted: true })
    expect(promotion.status({} as never)).toEqual({ boundary: -1, promoted: true })
  })
})

describe('createEpochPromotion / compaction epochs', () => {
  it('a compaction/end boundary demotes and requires a NEW signal', () => {
    const promotion = createEpochPromotion(['tool/call', 'assistant/message'])
    const s = session('s1', [
      { type: 'tool/call', seq: 5 },
      { type: 'compaction/end', seq: 9 },
    ])
    expect(promotion.status(agentWith(s))).toEqual({ boundary: 9, promoted: false })
  })

  it('a signal after the boundary promotes again', () => {
    const promotion = createEpochPromotion(['tool/call', 'assistant/message'])
    const s = session('s1', [
      { type: 'tool/call', seq: 5 },
      { type: 'compaction/end', seq: 9 },
      { type: 'assistant/message', seq: 12 },
    ])
    expect(promotion.status(agentWith(s))).toEqual({ boundary: 9, promoted: true })
  })

  it('a signal before the boundary does not count after compaction', () => {
    const promotion = createEpochPromotion(['tool/call'])
    const s = session('s1', [
      { type: 'tool/call', seq: 5 },
      { type: 'compaction/end', seq: 9 },
    ])
    const status = promotion.status(agentWith(s))
    // observe() must not flip it back on a replayed pre-boundary event.
    promotion.observe(s, { type: 'tool/call', seq: 5 })
    expect(promotion.status(agentWith(s))).toEqual(status)
  })
})

describe('createEpochPromotion / observe', () => {
  it('incremental observe promotes on a new durable signal', () => {
    const promotion = createEpochPromotion(['tool/call', 'assistant/message'])
    const s = session('s1', [])
    promotion.status(agentWith(s)) // prime the memo
    promotion.observe(s, { type: 'tool/call', seq: 1 })
    expect(promotion.status(agentWith(s)).promoted).toBe(true)
  })

  it('incremental observe demotes on compaction/end', () => {
    const promotion = createEpochPromotion(['tool/call'])
    const s = session('s1', [{ type: 'tool/call', seq: 5 }])
    promotion.status(agentWith(s)) // primed as promoted
    promotion.observe(s, { type: 'compaction/end', seq: 9 })
    expect(promotion.status(agentWith(s))).toEqual({ boundary: 9, promoted: false })
  })

  it('ignores events for unknown sessions', () => {
    const promotion = createEpochPromotion(['tool/call'])
    promotion.observe(session('ghost', []), { type: 'tool/call', seq: 1 })
    expect(promotion.status(agentWith(session('real', []))).promoted).toBe(false)
  })
})

describe('createEpochPromotion / subagents', () => {
  it('subagents are promoted by default (delegationDepth > 0)', () => {
    const promotion = createEpochPromotion(['tool/call'])
    const s = session('s1', []) as AnchorSessionLike & { header: { delegationDepth: number } }
    s.header = { delegationDepth: 1 }
    expect(promotion.status(agentWith(s)).promoted).toBe(true)
  })

  it('includeSubagents makes subagents follow the anchor phase', () => {
    const promotion = createEpochPromotion(['tool/call'], { includeSubagents: true })
    const s = session('s1', []) as AnchorSessionLike & { header: { delegationDepth: number } }
    s.header = { delegationDepth: 1 }
    expect(promotion.status(agentWith(s)).promoted).toBe(false)
  })
})
