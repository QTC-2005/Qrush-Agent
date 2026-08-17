/**
 * Qrush anchor: keep the FIRST model request of each session on a minimal
 * tool catalog with automatic injections suppressed, then promote to the full
 * catalog after the first durable promotion signal.
 *
 * The phase is derived from durable session events (resume and reload
 * preserve it). While a session is unpromoted:
 *   - the assembled tool catalog narrows to the `bootstrapTools` work set, so
 *     the first request is cheaper and its trajectory is not pulled around by
 *     a 25-tool dump (DeepSeek conditions strongly on the API tool catalog);
 *   - the assembly's dynamic runtime-context contributions are blanked (the
 *     whole `SystemPrompt.context()` family);
 *   - the pre-step waterfall keeps only the CLAIMED message batch plus the
 *     `allowKinds` entries — the skill catalog, the AGENTS.md digest,
 *     time/tmux context, hooks, and any unknown third-party injection are
 *     stripped by default (a user-initiated skill gesture survives).
 * After the first durable `tool/call` OR `assistant/message` (`promoteOn:
 * 'either'`, the default) the gate opens and the full catalog returns — the
 * loop's own snapshot projection diffs exactly ONE fresh runtime-context
 * message into the next request. A `compaction/end` boundary re-closes the
 * gate the same way (epoch-aware), with the `compactionTools` work set
 * available so mid-task work can continue.
 *
 * Adapted from dsh-anchored-standard (MIT, xiaobright): the tool-bootstrap
 * catalog filter, the claimed-baseline pre-step gate, and the
 * runtime-context blanking are ported with their degradation behavior (a
 * missing bootstrap tool or an internal bug exposes the full catalog, never
 * bricks a request).
 *
 * @module @deepseek-ai/dsh-qrush-anchor
 */

import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the scoped event declarations and the AssembleContext
// `agent` merge from the agent / system-prompt / session packages.
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { createEpochPromotion } from './epoch.ts'
import type { AnchorEventLike, AnchorSessionLike, EpochPromotion } from './epoch.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'qrush-anchor'

/** Deliberately NO inject list: the listeners only touch services at event time. */
export const inject: readonly string[] = []

/** Durable session event types that count as a promotion signal per mode. */
const PROMOTE_EVENTS: Record<'tool-call' | 'assistant-message' | 'either', readonly string[]> = {
  'tool-call': ['tool/call'],
  'assistant-message': ['assistant/message'],
  either: ['tool/call', 'assistant/message'],
}

/** Every config key this plugin accepts — anything else is a typo. */
const ALLOWED_KEYS = new Set([
  'enabled',
  'promoteOn',
  'includeSubagents',
  'allowKinds',
  'bootstrapTools',
  'compactionTools',
])

/**
 * Plugin config. All fields optional; defaults are the anchored-standard
 * values rebased onto Qrush's Windows-first tool catalog.
 */
export interface Config {
  /** Master switch for both interception paths (A/B testing). Default true. */
  enabled?: boolean
  /** Promotion trigger: 'either' (default) | 'tool-call' | 'assistant-message'. */
  promoteOn?: 'tool-call' | 'assistant-message' | 'either'
  /** When true, subagents follow the same anchor phase. Default false. */
  includeSubagents?: boolean
  /** Message `source.kind` names allowed beyond the claimed batch. Default ['skill-invocation']. */
  allowKinds?: readonly string[]
  /** The unpromoted catalog: a non-empty set of tool names. Defaults to the core filesystem set. */
  bootstrapTools?: readonly string[]
  /** Extra tools exposed after a compaction, before re-promotion. Default core work set. */
  compactionTools?: readonly string[]
}

/** Resolved runtime switches. */
export interface ResolvedConfig {
  enabled: boolean
  promoteEvents: readonly string[]
  includeSubagents: boolean
  allowKinds: ReadonlySet<string>
  bootstrapTools: readonly string[]
  compactionTools: readonly string[]
}

/** The default first-request catalog: Qrush's cross-platform core filesystem set. */
export const DEFAULT_BOOTSTRAP_TOOLS: readonly string[] = ['read', 'write', 'edit', 'glob', 'grep']

/** The default post-compaction work set: core filesystem plus task controls. */
export const DEFAULT_COMPACTION_TOOLS: readonly string[] = [
  'read', 'write', 'edit', 'glob', 'grep', 'todo_write', 'ask_user_question',
]

/** Message kinds allowed through the pre-step gate beyond the claimed batch. */
const DEFAULT_ALLOW_KINDS: readonly string[] = ['skill-invocation']

function stringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some(item => typeof item !== 'string' || item.length === 0)) {
    throw new TypeError(`${name}: ${field} must be a non-empty array of non-empty strings`)
  }
  return [...new Set(value)]
}

function parsePromoteOn(value: unknown): readonly string[] {
  if (value === undefined || value === 'either') return PROMOTE_EVENTS.either
  if (value === 'tool-call' || value === 'assistant-message') return PROMOTE_EVENTS[value]
  throw new TypeError(`${name}: promoteOn must be one of "tool-call", "assistant-message", "either"; got ${JSON.stringify(value)}`)
}

function booleanOption(value: unknown, field: string, fallback: boolean): boolean {
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') throw new TypeError(`${name}: ${field} must be a boolean`)
  return value
}

function allowKindList(value: unknown): ReadonlySet<string> {
  // An explicitly empty array is meaningful: keep ONLY the claimed batch.
  if (value === undefined) return new Set(DEFAULT_ALLOW_KINDS)
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || item.length === 0)) {
    throw new TypeError(`${name}: allowKinds must be an array of non-empty strings`)
  }
  return new Set(value)
}

/**
 * Validate config at apply time and resolve the runtime switches.
 * @param config - raw plugin config.
 * @returns the resolved switches.
 */
export function resolveConfig(config: Config | undefined): ResolvedConfig {
  const source: Record<string, unknown> = config === undefined ? {} : { ...config }
  const unknown = Object.keys(source).filter(key => !ALLOWED_KEYS.has(key))
  if (unknown.length > 0) {
    throw new TypeError(`${name}: unknown config key(s) ${unknown.join(', ')} — allowed keys: ${[...ALLOWED_KEYS].sort().join(', ')}`)
  }
  return {
    enabled: booleanOption(source.enabled, 'enabled', true),
    promoteEvents: parsePromoteOn(source.promoteOn),
    includeSubagents: booleanOption(source.includeSubagents, 'includeSubagents', false),
    allowKinds: allowKindList(source.allowKinds),
    bootstrapTools: stringList(source.bootstrapTools ?? DEFAULT_BOOTSTRAP_TOOLS, 'bootstrapTools'),
    compactionTools: source.compactionTools === undefined
      ? DEFAULT_COMPACTION_TOOLS
      : [...new Set(stringList(source.compactionTools, 'compactionTools'))],
  }
}

/**
 * Narrow the assembled catalog to a keep-set. When a required phase tool is
 * missing from the available universe, degrade to the full catalog with a
 * one-time warning instead of bricking the session.
 */
function keepTools<A extends { tools: ReadonlyArray<{ name: string }> }>(
  assembled: A,
  keep: ReadonlySet<string>,
  missingAllowsFullCatalog: boolean,
  warnOnce: (message: string) => void,
): A {
  const available = new Set(assembled.tools.map(tool => tool.name))
  const missing = [...keep].filter(toolName => !available.has(toolName))
  if (missing.length > 0) {
    warnOnce(
      `${name}: expected every phase tool; missing=${JSON.stringify(missing)} — `
      + (missingAllowsFullCatalog ? 'bootstrap disabled, full catalog exposed' : 'continuing with what is available'),
    )
    if (missingAllowsFullCatalog) return assembled
  }
  return { ...assembled, tools: assembled.tools.filter(tool => keep.has(tool.name)) }
}

/**
 * Mount the anchor phase filters: a durable-event observer, a
 * system-prompt/assemble filter (tool catalog + runtime contexts), and a
 * claimed-baseline agent/pre-step gate.
 * @param ctx - Cordis context (host plane; the preset/base composition rows).
 * @param config - plugin config.
 */
export function apply(ctx: Context, config?: Config): void {
  const value = resolveConfig(config)
  if (!value.enabled) return

  const promotion: EpochPromotion = createEpochPromotion(value.promoteEvents, {
    includeSubagents: value.includeSubagents,
  })

  let warned = false
  const warnOnce = (message: string): void => {
    if (warned) return
    warned = true
    try {
      ctx.logger.warn(message)
    } catch {
      // Logger unavailable — the guard exists only to avoid spamming.
    }
  }

  ctx.on('session/event', (session: AnchorSessionLike, event: AnchorEventLike) => {
    promotion.observe(session, event)
  })

  // Tool catalog + runtime-context control: while unpromoted, narrow the
  // tools to the bootstrap set and blank the dynamic runtime-context
  // contributions (the whole SystemPrompt.context() family).
  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembled = await next()
    try {
      const { boundary, promoted } = promotion.status(context.agent)
      if (promoted) return assembled
      const keep = new Set<string>(value.bootstrapTools)
      if (boundary >= 0) for (const toolName of value.compactionTools) keep.add(toolName)
      const filtered = keepTools(assembled, keep, true, warnOnce)
      return Array.isArray(filtered.contexts) && filtered.contexts.length > 0
        ? { ...filtered, contexts: [] }
        : filtered
    } catch (error) {
      // A filter bug must never brick a request: degrade to the assembled value.
      warnOnce(`${name}: assembly filter failed, exposing the full catalog: ${String((error && (error as Error).message) || error)}`)
      return assembled
    }
  })

  // Claimed-baseline deny on the pre-step waterfall: the payload's `messages`
  // is the batch this step CLAIMED from the inbox — the baseline every
  // injection appends to. Keep that baseline plus the kind allowlist, strip
  // every appended message regardless of its source identity.
  ctx.on('agent/pre-step', async ({ agent, messages: claimed }, next) => {
    const decision = await next()
    if (decision.kind === 'reject') return decision
    if (promotion.status(agent).promoted) return decision
    try {
      if (!Array.isArray(decision.messages) || !Array.isArray(claimed)) return decision
      const baseline = new Set(claimed)
      const baselineIds = new Set(
        claimed
          .map(message => (message as { id?: string }).id)
          .filter((id): id is string => id !== undefined && id !== null),
      )
      const kept = decision.messages.filter(message =>
        baseline.has(message)
        || baselineIds.has((message as { id?: string }).id ?? '')
        || value.allowKinds.has((message as { source?: { kind?: string } }).source?.kind ?? ''),
      )
      return kept.length === decision.messages.length ? decision : { ...decision, messages: kept }
    } catch (error) {
      // A gate bug must never eat context: degrade to keeping every message.
      warnOnce(`${name}: pre-step gate failed, keeping injected context: ${String((error && (error as Error).message) || error)}`)
      return decision
    }
  }, { prepend: true })
}
