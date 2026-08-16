/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-qrush-scene-router`.
 * @module @deepseek-ai/dsh-qrush-scene-router/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-qrush-scene-router'

/** Cordis companion plugin name. */
export const name = 'qrush-scene-router-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the router is a pure classification + one-shot
 * injection; its only state is the per-session last-scene map, which has no
 * second surface an invariant could cross-check at runtime. The classification
 * table is covered by the package's unit tests.
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
