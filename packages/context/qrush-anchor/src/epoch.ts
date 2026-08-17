/**
 * Epoch-aware promotion state machine for the Qrush anchor phase.
 *
 * A compaction rewrites the model-visible surface: the pre-compaction
 * conversation collapses into one synthetic summary message. The first
 * post-compaction request is therefore a "second first request" — the same
 * first-token conditions the anchor exists to control. Promotion is
 * epoch-aware: only a durable promotion signal (`tool/call` and/or
 * `assistant/message`, per the caller's `promoteEvents`) recorded AFTER the
 * last `compaction/end` boundary counts as promoted. Before any compaction
 * the boundary is -1, which preserves the original one-shot semantics.
 *
 * State is memoized per session id and maintained incrementally through
 * `observe()`; a cold session scans its durable log once (so resume and
 * reload reconstruct the same phase), then O(1).
 *
 * By default subagents (`delegationDepth > 0`) are treated as already
 * promoted so their first request can use tools. Set `includeSubagents: true`
 * to make subagents follow the same anchor phase as top-level sessions.
 *
 * Adapted from dsh-anchored-standard's `compaction-epoch.mjs` (MIT,
 * xiaobright): the phase model and the durable-event derivation are kept
 * verbatim; only the types are narrowed to this package's needs.
 *
 * @module @deepseek-ai/dsh-qrush-anchor/epoch
 */

/** The durable event fields the tracker reads. */
export interface AnchorEventLike {
  /** Durable event type (e.g. `tool/call`, `assistant/message`, `compaction/end`). */
  readonly type: string
  /** Monotonic log position; events without one count as post-boundary. */
  readonly seq?: number
}

/** A minimal view of the durable session log the tracker scans. */
export interface AnchorSessionLike {
  /** The session id keying the memoized state. */
  readonly id: string
  /** The append-only durable event log. */
  readonly events: readonly AnchorEventLike[]
}

/** The current phase of one session. */
export interface PromotionStatus {
  /** Seq of the last `compaction/end` boundary, or -1 before any compaction. */
  readonly boundary: number
  /** Whether a durable promotion signal exists after that boundary. */
  readonly promoted: boolean
}

/** Options for {@link createEpochPromotion}. */
export interface EpochPromotionOptions {
  /** When true, subagents follow the same anchor phase as top-level sessions. */
  includeSubagents?: boolean
}

/** One epoch-aware promotion tracker. */
export interface EpochPromotion {
  /**
   * The current phase of the agent's session.
   * @param agent - the assembly/pre-step agent, or undefined outside an agent.
   * @returns the promotion status; unknown sessions are scanned once.
   */
  status(agent: { session?: AnchorSessionLike } | undefined): PromotionStatus
  /** Incremental feed: call on every durable session event. */
  observe(session: AnchorSessionLike, event: AnchorEventLike): void
}

/** Build one epoch-aware promotion tracker. */
export function createEpochPromotion(
  promoteEvents: readonly string[],
  options: EpochPromotionOptions = {},
): EpochPromotion {
  const includeSubagents = options.includeSubagents === true
  const promote = new Set(promoteEvents)
  /** sessionId -> { boundary, promoted } */
  const state = new Map<string, { boundary: number; promoted: boolean }>()

  /** Scan a session's durable log from scratch (cold start / resume). */
  const scan = (session: AnchorSessionLike): { boundary: number; promoted: boolean } => {
    let boundary = -1
    let promoted = false
    for (const event of session.events) {
      const seq = event.seq ?? 0 // events without a seq are treated as post-boundary
      if (event.type === 'compaction/end') {
        boundary = seq
        promoted = false
        continue
      }
      if (promote.has(event.type) && seq > boundary) promoted = true
    }
    const entry = { boundary, promoted }
    state.set(session.id, entry)
    return entry
  }

  return {
    status(agent) {
      if (agent === undefined) return { boundary: -1, promoted: true }
      const session = agent.session
      if (session === undefined) return { boundary: -1, promoted: true }
      // By default subagents keep the full catalog from their very first
      // request; includeSubagents makes them follow the normal anchor phase.
      const header = (session as { header?: { delegationDepth?: number } }).header
      if (!includeSubagents && (header?.delegationDepth ?? 0) > 0) {
        return { boundary: -1, promoted: true }
      }
      return state.get(session.id) ?? scan(session)
    },
    observe(session, event) {
      const entry = state.get(session.id)
      if (entry === undefined) return
      const seq = event.seq ?? 0
      if (event.type === 'compaction/end') {
        state.set(session.id, { boundary: seq, promoted: false })
        return
      }
      if (promote.has(event.type) && seq > entry.boundary && !entry.promoted) {
        state.set(session.id, { ...entry, promoted: true })
      }
    },
  }
}
