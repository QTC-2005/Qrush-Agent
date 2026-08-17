/**
 * Skill toolview: renders a `skill(name)` tool call as an explicit
 * skill-retrieval card in the conversation — the visual cue that the model is
 * loading a skill. The row shows the skill name from the call args and, once
 * settled, a short preview of the loaded content. Pure presentation: a
 * function of the tool call node, no subscriptions.
 */

import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the `tool.call.toolview` SlotMap declaration (owner block
// shape) from ui-tool.
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import css from './SkillToolview.module.css'

/** Dock entry props: the toolview owner share plus the locale seat. */
export type SkillToolviewProps = PropsRuntime<'tool.call.toolview'> & PropsLocale<'skill-toolview'>

/** Extract the `name` argument from the call's raw JSON args; null when malformed. */
function skillNameFromArgs(argsRaw: string | null | undefined): string | null {
  if (argsRaw == null) return null
  try {
    const parsed = JSON.parse(argsRaw) as { name?: unknown }
    return typeof parsed.name === 'string' && parsed.name !== '' ? parsed.name : null
  } catch {
    return null
  }
}

/** Settled result's plain text, truncated for the preview. */
function resultPreview(content: readonly { type: string; text?: string }[], max = 200): string | null {
  const text = content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim()
  if (text === '') return null
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/** The keyed `skill` tool row. */
export function SkillToolview({ toolName, block, t }: SkillToolviewProps) {
  // ToolResultNode carries `call`; RunningToolCall does not — `in` discriminates.
  const settled = 'call' in block
  const argsRaw = settled ? block.call?.argsRaw : block.argsRaw
  const name = skillNameFromArgs(argsRaw) ?? toolName
  const preview = settled ? resultPreview(block.content) : null
  return (
    <div className={css.row} data-skill-toolview>
      <span className={css.badge} aria-hidden="true">📚</span>
      <span className={css.title} role="status" aria-label={t('row.aria', { name })}>
        {t('row.title', { name })}
      </span>
      {preview !== null && <span className={css.preview}>{preview}</span>}
    </div>
  )
}
