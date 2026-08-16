/**
 * Qrush skill toolview plugin, browser half: owns how the `skill` tool's calls
 * render inside a turn — an explicit "skill loaded" card instead of the
 * generic tool row. Pure presentation registered into the keyed
 * `tool.call.toolview` hole that ui-tool declares.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the ui-conversation SlotMap merge and the locale merge.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { SkillToolview } from './SkillToolview.tsx'
import { en, zh, type SkillToolviewKey } from './locales.ts'

export { SkillToolview } from './SkillToolview.tsx'
export type { SkillToolviewKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The skill toolview row's copy. */
    skill: SkillToolviewKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'skill'

/** Required services: slot registration and copy. */
export const inject = ['slots', 'locale']

/**
 * Client plugin body: register the `skill` tool's keyed toolview.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-skill-toolview: dictionaries')

  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
    name: 'tool.call.toolview',
    key: 'skill',
    locale: NS,
  }, SkillToolview))
}
