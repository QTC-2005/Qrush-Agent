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

## 已预装清单（45 个，2026-08，按使用场景分类）

> 全部来自 MIT / Apache-2.0 许可仓库，可自由再分发；技能为「一次性加载的指令」，正文不进常驻前缀，仅 `name`+`description` 进技能目录。

### 场景 1：软件开发全流程（需求 → 规格 → 工单 → 实现 → 审查）

| 技能 | 来源 | 用途 |
|---|---|---|
| `to-spec` | mattpocock | 把当前对话整理成规格并发布到 issue/任务系统 |
| `to-tickets` | mattpocock | 把计划/规格拆成可执行的工单（tracer-bullet） |
| `implement` | mattpocock | 基于规格或工单实现一块工作 |
| `prototype` | mattpocock | 做一次性原型来回答设计问题 |
| `domain-modeling` | mattpocock | 构建并打磨项目的领域模型 |
| `codebase-design` | mattpocock | 深模块设计的共享词汇 |
| `improve-codebase-architecture` | mattpocock | 扫描代码库找深化机会，提架构改进 |
| `triage` | mattpocock | 把 issue 和外部 PR 推进分诊状态机 |

### 场景 2：调试与测试

| 技能 | 来源 | 用途 |
|---|---|---|
| `systematic-debugging` | superpowers | 遇到 bug/测试失败/异常行为，先诊断再修复 |
| `test-driven-development` | superpowers | 实现功能或修复前，先写测试 |

### 场景 3：规划与代码审查

| 技能 | 来源 | 用途 |
|---|---|---|
| `writing-plans` | superpowers | 有规格/需求、多步骤任务时，先写计划 |
| `executing-plans` | superpowers | 已有书面实现计划时，按计划执行 |
| `requesting-code-review` | superpowers | 完成任务/实现大功能/合并前，请求审查 |
| `receiving-code-review` | superpowers | 收到审查反馈后，先理解再改 |
| `code-review` | mattpocock | 从固定点（commit/branch/tag）审查变更 |
| `verification-before-completion` | superpowers | 声称"完成/修复/通过"前，先跑验证、用证据说话 |

### 场景 4：Git 工作流

| 技能 | 来源 | 用途 |
|---|---|---|
| `using-git-worktrees` | superpowers | 需要与当前分支隔离的功能开发时用 git worktree |
| `finishing-a-development-branch` | superpowers | 实现完成、测试通过后，收尾分支 |
| `resolving-merge-conflicts` | mattpocock | 解决进行中的 git merge/rebase 冲突 |

### 场景 5：创意与协作

| 技能 | 来源 | 用途 |
|---|---|---|
| `brainstorming` | superpowers | 任何创意工作前使用（功能设计、方案权衡） |

### 场景 6：安全审计（Apache-2.0，零运行时，来自 [dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security)）

| 技能 | 用途 |
|---|---|
| `secret-scan` | 凭据/密钥暴露审计（gitleaks/trivy 全历史扫描、告警分级、脱敏报告） |
| `dependency-audit` | 依赖供应链审计（pnpm/npm audit、license 与投毒风险检查） |
| `supply-chain-review` | PR/新依赖快速供应链评审（危险 install/postinstall 脚本、typosquat） |
| `prompt-injection-review` | 面向 agent 项目的提示注入面审查（AGENTS.md、技能目录、工具描述、MCP/网页来源） |
| `threat-model` | 新功能/新系统的轻量威胁建模（对象→信任边界→资产→STRIDE 威胁表） |

### 场景 7：机器学习 / 深度学习 / 数据科学（MIT，来自 [agent-ml-skills](https://github.com/param087/agent-ml-skills)）

| 技能 | 用途 |
|---|---|
| `exploratory-data-analysis` | 探索性数据分析（EDA 决策流程） |
| `data-cleaning` | 数据清洗决策框架 |
| `pandas-patterns` | pandas 常用模式与陷阱 |
| `feature-engineering` | 特征工程决策 |
| `sklearn-pipelines` | scikit-learn 管线构建 |
| `pytorch-training-loop` | PyTorch 训练循环最佳实践 |
| `hyperparameter-tuning` | 超参调优策略 |
| `model-evaluation` | 模型评估指标与协议 |
| `ml-debugging` | ML 调试（欠拟合/过拟合/数据问题定位） |
| `imbalanced-data` | 类别不平衡处理 |
| `reproducible-ml` | 可复现 ML 实验 |
| `experiment-tracking` | 实验追踪（指标/配置/产物） |
| `llm-finetuning` | LLM 微调（数据/训练/评估） |
| `rag-pipeline` | RAG 管线构建 |
| `model-serving` | 模型服务化部署 |

### 场景 8：图像处理 / 计算机视觉（MIT，来自 [image-processing-skills](https://github.com/aeren23/image-processing-skills)）

| 技能 | 用途 |
|---|---|
| `image-fundamentals` | 颜色空间/格式/坐标陷阱（CV 基础） |
| `preprocessing-decisions` | 预处理决策：滤波选择树、噪声识别 |
| `thresholding-strategy` | 阈值策略：全局 vs Otsu vs 自适应决策矩阵 |
| `morphology-toolkit` | 形态学工具：开/闭运算、结构元素选择 |
| `contour-analysis` | 轮廓分析：形状度量、医学分类比例 |

**未预装 / 待确认**
- `anthropics/skills`（docx/pdf/pptx/xlsx 文档处理 + mcp-builder）：价值高，**许可证未核实**，确认后再装（覆盖"文档/表格"场景的缺口）；
- **网页模板/设计类**：暂无干净 MIT 源——`skill-site-generator` 无 LICENSE、anthropics webapp-testing 许可证未核实；`anti-slop-website-prompts`（MIT）是 prompt 集非 SKILL.md 格式。需要时再评估；
- 中文汉化版（superpowers-zh 等）：正文目前为英文，需要时评估；
- 现成管理工具（dsh-skillport、dsh-skills-manage）：生态很新、审计不足，暂不引入。

### 升级 / 移除

- 升级 = 重新从源仓库拉取 `SKILL.md`（及 `references/`）覆盖即可；
- 移除 = 删除 `skills/<name>/` 目录，下个会话即不再看到；
- 同名冲突：本 preset 的 customSkillDirs 是 rank 300，用户级 `~/.dsh/skills` 是 rank 400——同名时用户级优先。

## 自动选择（规划中，暂不实现）

DSH 机制本身已支持模型**自动选择**：技能目录（`<available_skills>`）在每步注入给模型，模型按 `description`/`whenToUse` 自行决定加载哪个技能——用户只需最简表述（如"做一个个人简介网页"），模型会按 description 匹配到对应场景技能。后续可增强：

- 按会话场景（编码 / 文档 / 数据分析）预选一组默认技能；
- 技能分组与按需加载优先级。

这部分等预装技能稳定后再做。
