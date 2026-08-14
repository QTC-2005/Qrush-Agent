/**
 * Qrush cache panel plugin, browser half: a compact cache strip in the
 * conversation.input.dock. Projection-mode surface — the hit rate and anchor
 * reset count arrive through `useProjection('tokenUsage')` /
 * `useProjection('cacheAnchor')`, so this plugin owns no store and no event
 * listener.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the ui-conversation SlotMap merge (the input.dock entry).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { CacheDock } from './CachePanel.tsx'
import { en, zh, type CacheKey } from './locales.ts'

export { CacheDock, CachePanel } from './CachePanel.tsx'
export type { CacheKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The cache panel strip's copy. */
    cache: CacheKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'cache'

/** Required services: slot registration and copy. */
export const inject = ['slots', 'locale']

/**
 * Client plugin body: the cache panel dock entry.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-cache-panel: dictionaries')

  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock',
    id: 'cache',
    order: 30,
    locale: NS,
  }, CacheDock))
}
