/**
 * Pure types of the Qrush cache-anchor diagnostic.
 * @module @deepseek-ai/dsh-qrush-cache-anchor/types
 */

/**
 * Per-session state the live service reports. The fingerprint is the sha256 of
 * the canonical (system + tools) prefix; `resets` counts how many times that
 * prefix changed after the first observation, each change being a cache-anchor
 * reset for DeepSeek's automatic prefix cache.
 */
export interface CacheAnchorSnapshot {
  /** sha256 of the last observed `{ system, tools }` prefix. */
  fingerprint: string
  /** Number of times the prefix changed after the first observation. */
  resets: number
  /** Wall-clock time of the most recent prefix change, ms epoch; undefined before the first change. */
  lastChangedAt: number | undefined
}

/**
 * Client-facing value of the `cacheAnchor` projection: the durable equivalent
 * of {@link CacheAnchorSnapshot} folded from the session's `request/header`
 * events, so it is replayable after a process restart and visible to the
 * browser through the projection registry.
 */
export interface CacheAnchorProjection {
  /** sha256 of the newest `{ system, tools }` prefix; null before any request. */
  fingerprint: string | null
  /** Number of times the prefix changed after the first observation. */
  resets: number
  /** Session-log seq of the most recent prefix change; null before the first change. */
  lastChangedSeq: number | null
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /** Qrush cache-anchor diagnostic over the durable request header. */
    cacheAnchor: CacheAnchorProjection
  }
}
