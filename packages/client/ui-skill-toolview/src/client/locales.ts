/**
 * Copy keys for the skill toolview.
 * @module @deepseek-ai/dsh-client-ui-skill-toolview/locales
 */

export type SkillToolviewKey =
  | 'row.title'
  | 'row.aria'

export const zh: Record<SkillToolviewKey, string> = {
  'row.title': '检索技能：{name}',
  'row.aria': '加载技能 {name}',
}

export const en: Record<SkillToolviewKey, string> = {
  'row.title': 'Skill loaded: {name}',
  'row.aria': 'Load skill {name}',
}
