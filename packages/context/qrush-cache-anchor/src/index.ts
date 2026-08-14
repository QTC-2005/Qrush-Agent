/**
 * Qrush cache-anchor diagnostic: observe every request's (system + tools) prefix
 * and report its sha256 fingerprint and reset count.
 *
 * DeepSeek's automatic prefix cache anchors on a byte-identical prefix rendered
 * from tools + system + messages. The stable part a session can control is
 * `{ system, tools }`; when that prefix changes, the provider cache misses the
 * following request. This package fingerprints that prefix and counts changes,
 * twice: a live {@link CacheAnchor} service (per-request observation) and a
 * durable `cacheAnchor` session projection (folded from `request/header`), so
 * the count survives a process restart and reaches the browser.
 *
 * @module @deepseek-ai/dsh-qrush-cache-anchor
 */

import { Context, Service } from '@deepseek-ai/cordis'
import { createHash } from 'node:crypto'
import type { GenerateOptions, ToolSchema } from '@deepseek-ai/dsh-llm'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import { z } from 'zod'
import type { CacheAnchorSnapshot } from './types.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    cacheAnchor: CacheAnchor
  }
}

/**
 * Canonical fingerprint of a request's stable prefix. Ordering matters: tools
 * are serialized as given, so a provider-facing tool reorder is (correctly) a
 * new fingerprint.
 * @param system - the request's system prompt, if any.
 * @param tools - the request's tool schemas, if any.
 * @returns lowercase sha256 hex of the canonical `{ system, tools }` payload.
 */
export function anchorFingerprint(
  system: string | undefined,
  tools: readonly ToolSchema[] | undefined,
): string {
  return createHash('sha256')
    .update(JSON.stringify({ system: system ?? null, tools: tools ?? [] }))
    .digest('hex')
}

/** Internal projection state: the newest fingerprint plus reset accounting. */
interface CacheAnchorState {
  fingerprint: string | null
  resets: number
  lastChangedSeq: number | null
}

const cacheAnchorSchema = z.object({
  fingerprint: z.string().nullable(),
  resets: z.number().int().nonnegative(),
  lastChangedSeq: z.number().int().nonnegative().nullable(),
}).strict()

/**
 * Durable `cacheAnchor` projection: folds `request/header` events, which carry
 * the assembled `{ system, tools }` prefix, into a fingerprint and a reset
 * count. `request/header` is appended exactly when the header changes, so one
 * fold per header change matches the live service's observation exactly.
 */
export const cacheAnchorProjectionDefinition: ProjectionDefinition<'cacheAnchor', CacheAnchorState> = {
  key: 'cacheAnchor',
  schema: cacheAnchorSchema,
  init: () => ({ fingerprint: null, resets: 0, lastChangedSeq: null }),
  apply: (state, event) => {
    if (event.type !== 'request/header') return state
    const fingerprint = anchorFingerprint(event.data.header.system, event.data.header.tools)
    if (state.fingerprint === null) return { fingerprint, resets: 0, lastChangedSeq: null }
    if (state.fingerprint === fingerprint) return state
    return { fingerprint, resets: state.resets + 1, lastChangedSeq: event.seq }
  },
  view: state => ({
    fingerprint: state.fingerprint,
    resets: state.resets,
    lastChangedSeq: state.lastChangedSeq,
  }),
  stateVersion: 1,
}

/**
 * Per-session prefix observation service. Tracks the newest fingerprint and how
 * many times it changed, keyed by session id, and registers the durable
 * `cacheAnchor` projection when a projection registry is present.
 */
export class CacheAnchor extends Service {
  private readonly anchors = new Map<string, CacheAnchorSnapshot>()

  constructor(ctx: Context) {
    super(ctx, 'cacheAnchor')
    // `llm/stream` is a waterfall fired in the agent scope; `global` lets this
    // host-plane service observe every session's requests. The listener only
    // records and passes through — it never rewrites or short-circuits the call.
    ctx.on('llm/stream', (options: GenerateOptions, next) => {
      this.observe(options)
      return next()
    }, { global: true })

    // Projection registration is an optional child: compositions without the
    // generic registry keep the live service's standalone read shape.
    ctx.inject(['sessionProjections'], (projectionCtx) => {
      projectionCtx.sessionProjections.register(cacheAnchorProjectionDefinition)
    })
  }

  /**
   * Record one observed request prefix.
   * @param options - the request envelope the loop is about to stream.
   * @returns 1 when this request changed the anchor, otherwise 0.
   */
  observe(options: GenerateOptions): number {
    const sessionId = options.sessionId
    if (sessionId === undefined) return 0
    const key = String(sessionId)
    const fingerprint = anchorFingerprint(options.system, options.tools)
    const previous = this.anchors.get(key)
    if (previous === undefined) {
      this.anchors.set(key, { fingerprint, resets: 0, lastChangedAt: undefined })
      return 0
    }
    if (previous.fingerprint === fingerprint) return 0
    this.anchors.set(key, { fingerprint, resets: previous.resets + 1, lastChangedAt: Date.now() })
    return 1
  }

  /**
   * The current anchor snapshot for one session.
   * @param sessionId - session to read; undefined before its first request.
   * @returns the snapshot, or undefined when no request has been observed.
   */
  snapshot(sessionId: string): CacheAnchorSnapshot | undefined {
    return this.anchors.get(sessionId)
  }
}

export default CacheAnchor
