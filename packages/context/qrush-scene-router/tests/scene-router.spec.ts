import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
// Type-only: pulls the scoped 'agent/pre-step' event declaration.
import type {} from '@deepseek-ai/dsh-agent'
import { apply, classifyScene, name, reminderFor, SCENES } from '@deepseek-ai/dsh-qrush-scene-router'

describe('classifyScene', () => {
  it('routes ML/deep-learning messages (Chinese and English keywords)', () => {
    expect(classifyScene('我要微调一个 LLM 模型')?.id).toBe('ml-deep-learning')
    expect(classifyScene('pytorch 训练循环怎么写')?.id).toBe('ml-deep-learning')
  })

  it('routes data-analysis messages', () => {
    expect(classifyScene('帮我分析这个 csv 数据的分布')?.id).toBe('data-analysis')
  })

  it('routes image-processing messages', () => {
    expect(classifyScene('图像分割项目的预处理怎么做')?.id).toBe('image-processing')
  })

  it('routes security messages', () => {
    expect(classifyScene('检查仓库里有没有泄露的密钥')?.id).toBe('security')
  })

  it('routes git messages', () => {
    expect(classifyScene('解决一下 git 合并冲突')?.id).toBe('git')
  })

  it('routes debugging and testing messages', () => {
    expect(classifyScene('这个 bug 一直复现')?.id).toBe('debugging')
    expect(classifyScene('帮我写测试用例')?.id).toBe('testing')
  })

  it('returns undefined for unrelated text', () => {
    expect(classifyScene('今天天气怎么样')).toBeUndefined()
    expect(classifyScene('')).toBeUndefined()
  })

  it('matches English keywords case-insensitively', () => {
    expect(classifyScene('Fix the segfault in my C code')?.id).toBe('debugging')
  })
})

describe('SCENES', () => {
  it('every scene has skills that exist in the preinstalled library', () => {
    const known = new Set(SCENES.flatMap(scene => scene.skills))
    expect(known.size).toBeGreaterThan(20)
    for (const scene of SCENES) {
      expect(scene.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(scene.skills.length).toBeGreaterThan(0)
    }
  })
})

describe('reminderFor', () => {
  it('builds a system-reminder naming the scene and skills', () => {
    const scene = SCENES[0]!
    const reminder = reminderFor(scene)
    expect(reminder).toContain('<system-reminder>')
    expect(reminder).toContain('skill 工具')
    expect(reminder).toContain(scene.skills[0])
  })
})

describe('apply / agent/pre-step', () => {
  it('splices one scene reminder into the front of the claimed messages', async () => {
    const ctx = new Context()
    await ctx.plugin({ name, inject: [], apply })
    const user = createUserMessage({
      content: [{ type: 'text', text: '我要微调一个 LLM 做 RAG' }],
      source: { kind: 'user' },
    })
    const fakeAgent = { id: 'sess-1' } as never
    // Mirrors the real agent-loop fallback: it reads the (shared) payload.messages.
    const fallback = ((p: { messages: unknown[] }) => Promise.resolve({ kind: 'enter', messages: p.messages })) as never
    const decision = await ctx.waterfall(
      'agent/pre-step',
      { agent: fakeAgent, messages: [user], turn: 1, step: 1, signal: new AbortController().signal },
      fallback,
    ) as { kind: 'enter'; messages: Array<{ content: unknown[] }> }
    expect(decision.messages.length).toBe(2)
    const text = decision.messages[0]!.content.map(b => (b as { type: string; text?: string }).text ?? '').join('')
    expect(text).toContain('识别到当前任务场景')
    expect(text).toContain('llm-finetuning')
    await ctx.fiber.dispose()
  })

  it('does not splice twice for the same scenario', async () => {
    const ctx = new Context()
    await ctx.plugin({ name, inject: [], apply })
    const fallback = ((p: { messages: unknown[] }) => Promise.resolve({ kind: 'enter', messages: p.messages })) as never
    const agent = { id: 'sess-2' } as never
    const msg = createUserMessage({
      content: [{ type: 'text', text: '训练一个 pytorch 模型' }],
      source: { kind: 'user' },
    })
    const first = await ctx.waterfall(
      'agent/pre-step', { agent, messages: [msg], turn: 1, step: 1, signal: new AbortController().signal }, fallback,
    ) as { messages: unknown[] }
    expect(first.messages.length).toBe(2)
    const second = await ctx.waterfall(
      'agent/pre-step', { agent, messages: [msg], turn: 1, step: 2, signal: new AbortController().signal }, fallback,
    ) as { messages: unknown[] }
    // Same scenario: no new reminder spliced.
    expect(second.messages.length).toBe(1)
    await ctx.fiber.dispose()
  })
})
