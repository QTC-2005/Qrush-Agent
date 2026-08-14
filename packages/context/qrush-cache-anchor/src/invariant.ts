/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-qrush-cache-anchor`.
 * @module @deepseek-ai/dsh-qrush-cache-anchor/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-qrush-cache-anchor'

/** Cordis companion plugin name. */
export const name = 'qrush-cache-anchor-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the anchor is a request-driven observation keyed by
 * session id; its map holds only the newest fingerprint and a monotonic reset
 * count, with no owned relationship to a second surface that an invariant
 * could independently check at runtime. The fingerprint function itself is a
 * pure sha256 fold covered by the package's unit tests.
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
