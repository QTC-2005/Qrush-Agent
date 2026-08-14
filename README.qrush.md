# Qrush Agent

> DeepSeek 优先的个性化 AI Agent，基于 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)（`@deepseek-ai/dsh`，v0.1.0-rc.5）二开。

Qrush Agent 是对 DeepSeek 官方 Agent Harness 的品牌化定制：保持上游"一切皆插件"的 Cordis 架构与 DeepSeek 前缀缓存优化不变，在其上叠加品牌、默认预设与缓存命中调优，并规划 Web + 桌面双端。

## 与上游（deepseek-harness）的差异

当前阶段（Phase 0/1）的定制点：

| 文件 | 改动 |
|---|---|
| `apps/web/index.html` | 页面标题 `DeepSeek Harness` → `Qrush Agent` |
| `apps/web/public/manifest.webmanifest` | PWA 名称 → `Qrush Agent` / `Qrush` |
| `apps/cli/config/agent-presets/qrush-standard/` | **新增**默认预设：Qrush 品牌 persona + 缓存调优 |
| `packages/bundle/web-app/cordis.patch.yml` | Web 默认预设 `standard` → `qrush-standard` |

`qrush-standard` 预设相对上游 `standard` 的两处 delta：

1. **persona**：助手自述为 Qrush Agent（字节稳定，不扰动缓存前缀）；
2. **compaction-basic**：`thresholdRatio: 0.7`（更早压缩）+ `retainRatio: 0.2`（保留更多近期原文）——近期原文是下一个请求要扩展的前缀，更大的保留区能跨压缩保持更多热缓存前缀。

## 缓存命中设计（继承上游）

上游已实现的 DeepSeek 前缀缓存友好设计全部继承，Qrush 不破坏它们：

- **追加式请求派生**：`agent-loop` 从 session log 的 `deriveMessages()` 投影历史，相邻请求字节级前缀一致；
- **确定性 prompt 组装**：sections 按 order 升序、`PromptContext` 为 cache-safe 设计；
- **压缩缓存对齐**：`compaction-basic` 摘要请求完整重放上一轮前缀 + 尾部追加压缩指令；
- **动态上下文只在变化时落快照**（`runtime-context.ts`）；
- **Spill + 确定性剪枝**（无 LLM、字节确定）；
- **用量透传**：`llm-deepseek` 映射 `prompt_cache_hit_tokens` → `cacheReadTokens`，UI 显示"缓存命中 %"。

DeepSeek 前缀缓存命中比未命中便宜 30–120 倍（v4-flash 50×、v4-pro 120×），详见 `../research/deepseek-cache-hit-report.md`。

## 环境要求

- Node.js `^22.19 || >=24`（本机已验证 v24）
- pnpm `11.7.0`（仓库已锁定，经 corepack 启用）
- DeepSeek API Key（运行需要）

## 构建与运行

```sh
# 1. 启用 pnpm（若未全局安装，可用 corepack 装到用户目录）
corepack enable --install-directory "$env:LOCALAPPDATA/corepack-bin"   # Windows
$env:PATH = "$env:LOCALAPPDATA/corepack-bin;$env:PATH"

# 2. 安装依赖
pnpm install

# 3. 构建（tsc + tsdown + vite）
pnpm run build

# 4. 配置 API Key（二选一）
$env:DEEPSEEK_API_KEY = "sk-..."

# 5. 启动 Web UI（默认 http://127.0.0.1:3080）
pnpm dsh web

# 或从源码直接跑（无需 build，走 tsx ESM hook）
pnpm dsh web
```

> `pnpm dsh` = `node --import tsx/esm apps/cli/src/bin.ts`，从源码运行；`pnpm run build` 后产物在 `apps/cli/lib`、各 `packages/*/*/lib`、`apps/web/dist`。

## 与上游同步

本仓库是 deepseek-harness 的 fork，`upstream` 远端指向官方：

```sh
git remote -v          # upstream → https://github.com/deepseek-ai/deepseek-harness.git
git fetch upstream
git merge upstream/main   # 或 rebase
```

上游处于 0.1.0-rc 快速演进期，存在破坏性变更；升级时优先走组合层（patch/preset），尽量少改 `packages/` 源码。

## 后续路线（规划）

- **Phase 1**：缓存命中仪表盘 client 插件 + 锚点指纹（`sha256(tools+system)`）诊断；
- **Phase 2**：桌面端 —— 按上游预留的 Electron + IPC fetch carrier 路线，新增 `apps/qrush-desktop`，复用全部 `dsh-client-*` 浏览器插件；
- **Phase 3**：onboarding 文案/图标品牌化、会话管理增强、成本报告、发布渠道。

调研报告见仓库外 `../Qrush-Agent-调研报告.md` 与 `../research/`。
