/**
 * Copy keys for the Qrush cache panel.
 * @module @deepseek-ai/dsh-client-ui-cache-panel/locales
 */

export type CacheKey =
  | 'strip.hit'
  | 'strip.resets'

export const zh: Record<CacheKey, string> = {
  'strip.hit': '缓存命中 {percent}%',
  'strip.resets': '锚点重置 {count} 次',
}

export const en: Record<CacheKey, string> = {
  'strip.hit': 'Cache hit {percent}%',
  'strip.resets': 'Anchor resets {count}',
}
