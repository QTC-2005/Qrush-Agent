/**
 * Qrush cache-anchor diagnostic: observe every request's (system + tools) prefix
 * and report its sha256 fingerprint and reset count.
 *
 * DeepSeek's automatic prefix cache anchors on a byte-identical prefix rendered
 * from tools + system + messages. The stable part a session can control is
 * `{ system, tools }`; when that prefix changes, the provider cache misses the
 * following request. This service fingerprints that prefix per request and
 * counts the changes, so a consumer (dashboard, telemetry) can show exactly
 * when and how often the cache anchor reset.
 *
 * @module @deepseek-ai/dsh-qrush-cache-anchor
 */

import { Context, Service } from '@deepseek-ai/cordis'
import { createHash } from 'node:crypto'
import type { GenerateOptions, ToolSchema } from '@deepseek-ai/dsh-llm'
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

/**
 * Per-session prefix observation service. Tracks the newest fingerprint and how
 * many times it changed, keyed by session id.
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
