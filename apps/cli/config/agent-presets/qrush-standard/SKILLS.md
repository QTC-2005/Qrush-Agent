# Qrush Skills 库 —— 统一管理说明

本 preset（`qrush-standard`）通过 `skill-filesystem` 的 `customSkillDirs` 指向本目录 `skills/`，让每个使用该预设的会话自动获得同一批预装 Skills。官方自带插件/技能**一律不改**，这里只做**增量扩充**。

## 目录与格式约定

```
qrush-standard/
├── agent.cordis.yml      # 预设组合（skill-filesystem 已指向 skills/）
├── SKILLS.md             # 本文档
└── skills/               # 统一管理的预装技能库
    ├── <skill-name>/SKILL.md        # 目录包形式（推荐）
    └── <skill-name>.md              # 平铺 Markdown 形式（简单技能可用）
```

每个 `SKILL.md` 必须带 frontmatter（`---` 包裹的 YAML）：

```markdown
---
name: <kebab-case 技能名>
description: <一句话说明何时用这个技能，会进入模型可见的技能目录>
whenToUse: <可选：更详细的适用场景提示>
metadata:
  source: <来源：GitHub 仓库 / 社区 / 原创>
  license: <许可证，如 MIT / CC-BY-4.0 / 专有>
---

# 技能正文
```

规则：

- `name` 必须 kebab-case（小写连字符），`description` 必填；
- 单层目录包（`<name>/SKILL.md`）优先，**不要**嵌套子目录（发现器只扫单层）；
- 正文用中文写说明（DSH 产品文案为中文），代码/命令保留原文；
- 不把 API 密钥、内部路径写进技能。

## 批量添加流程（新技能入库）

1. **挑选来源**：GitHub（`dsh-plugin` topic、pi 生态、anthropics/skills、社区合集）、B 站/小红书等中文渠道的推荐（见下方「来源与候选」）。
2. **转换格式**：把来源的技能内容整理成 `<name>/SKILL.md` + frontmatter（`description` 用一句话说明适用场景，模型据此自动决定是否调用）。
3. **放入目录**：`skills/<name>/SKILL.md`。
4. **验证**：
   - 用 `pnpm dsh --profile web --dump-config` 确认组合正常；
   - 启动 `dsh web` 建会话，模型可见的 `<available_skills>` 目录里应出现新技能名；
   - `skill(<name>)` 工具能加载正文。
5. **记录来源**：更新本文档「来源与候选」表 + `metadata.source/license`。

## 来源与候选（已预装 15 个）

### 已预装清单（2026-08，来源均为 MIT 许可，可自由再分发）

**来自 [obra/superpowers](https://github.com/obra/superpowers)（MIT，272k★）—— TDD/调试/规划/协作工作流（10 个）**

| 技能 | 用途 |
|---|---|
| `brainstorming` | 任何创意工作前使用（功能设计、方案权衡） |
| `systematic-debugging` | 遇到 bug/测试失败/异常行为时，先诊断再修复 |
| `test-driven-development` | 实现任何功能或修复前，先写测试 |
| `writing-plans` | 有规格/需求、多步骤任务时，先写计划 |
| `executing-plans` | 已有书面实现计划时，按计划执行 |
| `requesting-code-review` | 完成任务/实现大功能/合并前，请求审查 |
| `receiving-code-review` | 收到审查反馈后，先理解再改 |
| `verification-before-completion` | 声称"完成/修复/通过"前，先跑验证命令、用证据说话 |
| `using-git-worktrees` | 需要与当前分支隔离的功能开发时用 git worktree |
| `finishing-a-development-branch` | 实现完成、测试通过后，收尾分支 |

**来自 [mattpocock/skills](https://github.com/mattpocock/skills)（MIT，219k★）—— 工程实践（5 个）**

| 技能 | 用途 |
|---|---|
| `code-review` | 从固定点（commit/branch/tag）审查变更 |
| `codebase-design` | 深度模块设计的共享词汇（深模块设计） |
| `improve-codebase-architecture` | 扫描代码库找深化机会，提出架构改进 |
| `resolving-merge-conflicts` | 解决进行中的 git merge/rebase 冲突 |
| `triage` | 把 issue 和外部 PR 推进分诊状态机 |

**未预装 / 待确认**
- `anthropics/skills`（docx/pdf/pptx/xlsx 文档处理 + mcp-builder）：价值高，**许可证未核实**，确认后再装；
- 中文社区反复推荐的 superpowers-zh 汉化版（yibaiba/superpowers-zh 等）：需要时再评估，正文目前为英文；
- 现成管理工具（Jesse-njx/dsh-skillport、dsh-skills-manage npm 包）：生态很新、审计不足，暂不引入。

### 升级 / 移除

- 升级 = 重新从源仓库拉取 `SKILL.md` 覆盖即可（skill 是一次性加载的指令，覆盖不破坏会话）；
- 移除 = 删除 `skills/<name>/` 目录，模型下个会话即不再看到该技能；
- 同一名称冲突时，本地 rank 高的根赢（本 preset 的 customSkillDirs 是 rank 300，低于用户级 400/500，同名时用户级覆盖本目录——需要时调整）。

## 自动选择（规划中，暂不实现）

DSH 机制本身已支持模型**自动选择**：技能目录（`<available_skills>`）在每步注入给模型，模型按 `description`/`whenToUse` 自行决定加载哪个技能。后续可增强：

- 按会话场景（编码 / 文档 / 数据分析）预选一组默认技能；
- 技能分组与按需加载优先级。

这部分等预装技能稳定后再做。
