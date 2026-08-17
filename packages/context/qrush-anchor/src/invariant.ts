/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-qrush-anchor`.
 * @module @deepseek-ai/dsh-qrush-anchor/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-qrush-anchor'

/** Cordis companion plugin name. */
export const name = 'qrush-anchor-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the anchor phase is a phase filter over the durable
 * session log plus two assembly/pre-step transforms; its only runtime state is
 * the per-session promotion memo, whose source of truth is the durable event
 * log itself (an invariant would re-derive the same facts). The phase state
 * machine and the keep-set/gate logic are covered by the package's unit tests.
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
