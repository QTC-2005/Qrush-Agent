/**
 * Qrush cache panel: a compact strip in the composer's input dock showing the
 * session's cache hit rate and the anchor-reset count. Both facts arrive as
 * whole projected snapshots (`tokenUsage` and `cacheAnchor`); this plugin owns
 * no store, no event listener, and no refresh chain — the input.dock renderer
 * supplies `useProjection` and re-renders when either projection moves.
 */

import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the cacheAnchor SessionProjectionMap merge (useProjection key).
import type {} from '@deepseek-ai/dsh-qrush-cache-anchor/client'
import type { TokenUsageProjection } from '@deepseek-ai/dsh-token-meter/client'
import css from './CachePanel.module.css'

/** Dock entry props: the input.dock owner share (useProjection) plus the locale seat. */
export type CacheDockProps = PropsRuntime<'conversation.input.dock'> & PropsLocale<'cache'>

/** Whole-number cache hit percentage over billed input tokens; null when nothing is billed. */
function cacheHitPercent(usage: TokenUsageProjection): number | null {
  const billed = usage.cacheReadTokens + usage.uncachedInputTokens
  if (billed <= 0) return null
  return Math.round((usage.cacheReadTokens / billed) * 100)
}

/** Dock adapter: reads the two host-computed projections and renders the strip. */
export function CacheDock({ useProjection, t }: CacheDockProps) {
  const usage = useProjection('tokenUsage')
  const anchor = useProjection('cacheAnchor')
  const hit = usage === null || usage === undefined ? null : cacheHitPercent(usage)
  // Nothing to show until at least one projection carries a value.
  if (hit === null && (anchor === null || anchor === undefined)) return null
  return <CachePanel hit={hit} resets={anchor?.resets ?? 0} t={t} />
}

interface CachePanelProps {
  hit: number | null
  resets: number
  t: PropsLocale<'cache'>['t']
}

/** Pure presentation: two stat cells, no subscriptions. */
export function CachePanel({ hit, resets, t }: CachePanelProps) {
  return (
    <div className={css.dock} data-cache-panel>
      {hit !== null && <span className={css.stat}>{t('strip.hit', { percent: hit })}</span>}
      <span className={css.stat}>{t('strip.resets', { count: resets })}</span>
    </div>
  )
}
