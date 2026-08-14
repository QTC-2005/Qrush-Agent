/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-cache-panel`.
 * @module @deepseek-ai/dsh-client-ui-cache-panel/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-cache-panel'

/** Cordis companion plugin name. */
export const name = 'client-ui-cache-panel-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: a single cache-panel dock registration whose disposal
 * is proven by the HMR-safety spec — the plugin owns no store (all state
 * arrives on the tokenUsage and cacheAnchor projections), emits no cordis
 * events, and holds no cross-plugin mutable state.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
