/**
 * Pure types of the Qrush cache-anchor diagnostic.
 * @module @deepseek-ai/dsh-qrush-cache-anchor/types
 */

/**
 * Per-session state the anchor service reports for one session. The
 * fingerprint is the sha256 of the canonical (system + tools) prefix; `resets`
 * counts how many times that prefix changed after the first observation, each
 * change being a cache-anchor reset for DeepSeek's automatic prefix cache.
 */
export interface CacheAnchorSnapshot {
  /** sha256 of the last observed `{ system, tools }` prefix; undefined before any request. */
  fingerprint: string
  /** Number of times the prefix changed after the first observation. */
  resets: number
  /** Wall-clock time of the most recent prefix change, ms epoch; undefined before the first observation. */
  lastChangedAt: number | undefined
}
