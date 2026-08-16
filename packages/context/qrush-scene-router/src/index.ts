/**
 * Qrush scene router: classify each user message into a usage scenario and
 * inject a model-facing reminder listing the skills that scenario maps to.
 *
 * The skill catalog remains the source of truth — the model still picks and
 * loads skills itself via the `skill` tool. This plugin only makes the
 * scenario match explicit and repeatable: one lightweight reminder per
 * session-scenario change, so the model's first step of a new scenario starts
 * with the right skills in mind. No duplicate reminders for the same scenario
 * within one session, and no reminder when the message matches nothing.
 *
 * @module @deepseek-ai/dsh-qrush-scene-router
 */

import { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
// Type-only: pulls the cordis Context merge and the scoped 'agent/pre-step'
// event declaration from the agent package.
import type {} from '@deepseek-ai/dsh-agent'

/** One scenario: id, human label, trigger keywords, and the skills it suggests. */
export interface SceneDefinition {
  /** kebab-case scenario id. */
  id: string
  /** Human label injected in the reminder (Chinese). */
  label: string
  /** Substrings that signal this scenario; matched case-insensitively against user text. */
  keywords: readonly string[]
  /** Skill names (must exist in the preinstalled library) suggested for this scenario. */
  skills: readonly string[]
}

/**
 * The scenario table. Keyword lists are deliberately inclusive of both
 * Chinese and English terms; ordering matters — the FIRST scene whose keyword
 * hits wins, so put the most specific scenes first.
 */
export const SCENES: readonly SceneDefinition[] = [
  {
    id: 'ml-deep-learning',
    label: '机器学习 / 深度学习 / 大模型',
    keywords: [
      '机器学习', '深度学习', '神经网络', '大模型', '训练', '模型', '微调', 'pytorch', 'tensorflow',
      'llm', '数据集', 'epoch', 'loss', '梯度', '推理', '部署模型', 'fine-tun', 'finetun', '调参',
      'batch', '学习率', 'gpu', 'transformer', 'rnn', 'cnn', 'yolo', '分割模型', '检测模型',
    ],
    skills: [
      'pytorch-training-loop', 'llm-finetuning', 'model-evaluation', 'ml-debugging',
      'hyperparameter-tuning', 'imbalanced-data', 'reproducible-ml', 'experiment-tracking',
      'model-serving', 'rag-pipeline',
    ],
  },
  {
    id: 'data-analysis',
    label: '数据分析 / 数据科学',
    keywords: [
      '数据分析', '可视化', 'pandas', '清洗', 'eda', '探索性', '特征工程', '统计', 'csv',
      '数据表', 'sklearn', '数据预处理', '相关性', '分布',
    ],
    skills: ['exploratory-data-analysis', 'data-cleaning', 'pandas-patterns', 'feature-engineering', 'sklearn-pipelines'],
  },
  {
    id: 'image-processing',
    label: '图像处理 / 计算机视觉',
    keywords: [
      '图像', '图片', '视觉', '分割', 'opencv', 'cv2', '轮廓', '阈值', '形态学', '颜色空间',
      '滤波', '去噪', '锐化', '直方图', '感兴趣区域', 'roi', '图像预处理',
    ],
    skills: [
      'image-fundamentals', 'preprocessing-decisions', 'thresholding-strategy',
      'morphology-toolkit', 'contour-analysis',
    ],
  },
  {
    id: 'security',
    label: '安全审计 / 漏洞排查',
    keywords: [
      '安全', '漏洞', '密钥', '审计', '渗透', '依赖', '供应链', '提示注入', '威胁', '凭据',
      'gitleaks', 'trivy', 'cve', '权限', '越权', 'xss', 'sql注入',
    ],
    skills: ['secret-scan', 'dependency-audit', 'supply-chain-review', 'prompt-injection-review', 'threat-model'],
  },
  {
    id: 'git',
    label: 'Git 工作流',
    keywords: [
      'git', '合并', '冲突', '分支', 'worktree', '提交', 'pr', 'pull request', 'rebase',
      'cherry-pick', 'stash', '回滚',
    ],
    skills: ['resolving-merge-conflicts', 'using-git-worktrees', 'finishing-a-development-branch'],
  },
  {
    id: 'debugging',
    label: '调试 / 问题排查',
    keywords: ['bug', '报错', '异常', '失败', '崩溃', '调试', '修复', '错误', '栈', 'trace', 'segfault'],
    skills: ['systematic-debugging', 'ml-debugging'],
  },
  {
    id: 'testing',
    label: '测试 / TDD',
    keywords: ['测试', 'tdd', '用例', '单测', '覆盖率', 'test', '断言', '回归'],
    skills: ['test-driven-development'],
  },
  {
    id: 'planning',
    label: '规划 / 方案',
    keywords: ['计划', '规划', '方案', '路线', '步骤', '安排', 'roadmap', '里程碑', '清单'],
    skills: ['writing-plans', 'executing-plans'],
  },
  {
    id: 'software-dev',
    label: '软件开发 / 代码',
    keywords: [
      '开发', '实现', '重构', '架构', '代码', '软件', '功能', '需求', '接口', '模块',
      '编程', '前端', '后端', '数据库', 'api', '函数', '类',
    ],
    skills: [
      'to-spec', 'to-tickets', 'implement', 'code-review', 'codebase-design',
      'improve-codebase-architecture', 'triage', 'domain-modeling', 'prototype',
    ],
  },
]

/**
 * Classify a user message into its first matching scene.
 * @param text - the user message text.
 * @returns the first scene whose keyword appears in the text, or undefined.
 */
export function classifyScene(text: string): SceneDefinition | undefined {
  const lower = text.toLowerCase()
  for (const scene of SCENES) {
    for (const keyword of scene.keywords) {
      if (lower.includes(keyword.toLowerCase())) return scene
    }
  }
  return undefined
}

/** Extract plain text from a message's content blocks. */
function textOf(content: readonly ContentBlock[] | undefined): string {
  if (content === undefined) return ''
  return content
    .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
    .map(block => block.text)
    .join('')
}

/** The reminder injected before the next step of a new scenario. */
export function reminderFor(scene: SceneDefinition): string {
  return `<system-reminder>识别到当前任务场景：${scene.label}。建议优先用 skill 工具加载以下技能来指导工作（按需取用，非必须全部加载）：${scene.skills.join('、')}。若任务并不需要这些技能，忽略本提示。\n</system-reminder>`
}

/** Cordis plugin name. */
export const name = 'qrush-scene-router'

/**
 * Plugin body: at each pre-step, classify the claimed user messages and, when
 * the scenario changes, splice a suggested-skills reminder into the front of
 * the message batch so the model's next request starts with it in context.
 *
 * `agent/pre-step` is a scoped waterfall fired in the agent scope; `global`
 * lets this host-plane plugin observe every session. The reminder is inserted
 * once per session-scenario change (tracked by the last-scene map), so long
 * tool loops do not re-inject it.
 * @param ctx - Cordis context carrying `ctx.agents`.
 */
export function apply(ctx: Context): void {
  // Remembers the last injected scenario per session to avoid repeating the
  // same reminder on every step of a long scenario.
  const lastScene = new Map<string, string>()

  ctx.on('agent/pre-step', async (payload, next) => {
    const { agent, messages } = payload
    const text = messages
      .map(message => textOf(message.content))
      .filter(part => part.trim() !== '')
      .join(' ')
    const scene = classifyScene(text)
    const key = String(agent.id)
    if (scene === undefined || lastScene.get(key) === scene.id) return next()
    lastScene.set(key, scene.id)
    const hint = createUserMessage({
      content: [{ type: 'text', text: reminderFor(scene) }],
      source: { kind: 'plugin', plugin: 'qrush-scene-router' },
    })
    // In-place splice: the waterfall shares this array reference, so the
    // terminal fallback (`[...claimed, context]`) sees the reminder first.
    messages.splice(0, 0, hint)
    return next()
  }, { global: true })
}
