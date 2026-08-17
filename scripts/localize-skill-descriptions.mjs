// One-shot: rewrite each skill's frontmatter `description` to a Chinese
// summary so the model's skill catalog (name + description) matches Chinese
// user requests more accurately. Idempotent; run from repo root.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..', 'apps', 'cli', 'config', 'agent-presets', 'qrush-standard', 'skills')

const DESC = {
  'to-spec': '把当前对话整理成一份需求规格并发布到项目的 issue/任务系统；做多步骤开发前使用',
  'to-tickets': '把计划、规格或当前对话拆成一组按依赖排序的可执行工单（tracer-bullet）',
  'implement': '基于一份规格或一组工单实现一块具体工作',
  'prototype': '做一次性原型来回答设计问题，验证方案后再正式实现',
  'domain-modeling': '构建并打磨项目的领域模型，统一代码库术语与边界；讨论代码库概念时使用',
  'codebase-design': '深模块设计的共享词汇；设计模块边界、接口与职责时使用',
  'improve-codebase-architecture': '扫描代码库找深化/简化机会，提出可落地的架构改进方案',
  'triage': '把 issue 和外部 PR 推进分诊状态机：分类、标注、决定下一步',
  'systematic-debugging': '遇到 bug、测试失败或异常行为时，先系统化定位根因再修复，不要乱猜',
  'test-driven-development': '实现任何功能或修复前，先用 TDD 写失败测试，再让实现通过',
  'writing-plans': '有规格或需求、任务多步骤时，先写一份可执行的分阶段计划',
  'executing-plans': '已有书面实现计划时，按计划逐步执行并持续对照',
  'requesting-code-review': '完成任务、实现大功能或准备合并前，发起一次代码审查',
  'receiving-code-review': '收到代码审查反馈后，先理解每条意见的意图再动手修改',
  'code-review': '从某个固定点（commit/branch/tag）审查变更，给出结构化反馈',
  'verification-before-completion': '声称工作完成、已修复或测试通过前，先实际运行验证命令并用证据说话',
  'using-git-worktrees': '需要与当前工作分支隔离的功能开发时，用 git worktree 开独立工作区',
  'finishing-a-development-branch': '实现完成、测试通过后，规范收尾开发分支（整理提交、合并）',
  'resolving-merge-conflicts': '解决进行中的 git merge/rebase 冲突，系统化处理冲突块',
  'brainstorming': '任何创意性工作前使用：功能设计、方案权衡时先发散再收敛',
  'secret-scan': '凭据/密钥暴露审计：全历史扫描（gitleaks/trivy）、告警分级、脱敏报告',
  'dependency-audit': '依赖供应链审计：pnpm/npm audit 输出解读、许可证与投毒风险检查',
  'supply-chain-review': 'PR/新依赖快速供应链评审：危险 install/postinstall 脚本、typosquat 检查',
  'prompt-injection-review': '面向 agent 项目的提示注入面审查：AGENTS.md、技能目录、工具描述、MCP 与网页来源',
  'threat-model': '新功能/新系统的轻量威胁建模：划定信任边界、资产清单、STRIDE 威胁表',
  'exploratory-data-analysis': '探索性数据分析（EDA）：分布、缺失、异常值检查与可视化决策',
  'data-cleaning': '数据清洗决策框架：处理缺失、重复、异常值与类型问题',
  'pandas-patterns': 'pandas 常用模式与陷阱：高效数据处理写法',
  'feature-engineering': '特征工程决策：构造、选择与转换特征',
  'sklearn-pipelines': 'scikit-learn 管线构建：清洗-变换-建模-评估串联',
  'pytorch-training-loop': 'PyTorch 训练循环最佳实践：数据加载、前向/反向、优化器、日志与保存',
  'hyperparameter-tuning': '超参数调优策略：搜索空间、方法与评估协议',
  'model-evaluation': '模型评估：指标选择、切分协议与结果解读',
  'ml-debugging': 'ML 调试：定位欠拟合/过拟合、数据问题、梯度与损失异常',
  'imbalanced-data': '类别不平衡处理：重采样、加权损失、评估指标选择',
  'reproducible-ml': '可复现 ML 实验：固定种子、记录配置/数据版本/产物',
  'experiment-tracking': '实验追踪：用 MLflow/W&B 记录指标、配置与产物，做实验对比',
  'llm-finetuning': 'LLM 微调：数据准备、SFT 训练、评估与部署全流程',
  'rag-pipeline': 'RAG 管线构建：检索、生成与评估（recall、faithfulness）',
  'model-serving': '模型服务化部署：接口设计、推理优化与监控',
  'image-fundamentals': '图像处理基础：颜色空间、格式、坐标系统与常见陷阱',
  'preprocessing-decisions': '图像预处理决策：滤波选择树、噪声识别与增强策略',
  'thresholding-strategy': '图像阈值策略：全局 vs Otsu vs 自适应的选择矩阵',
  'morphology-toolkit': '图像形态学工具：开/闭运算、结构元素选择与用途',
  'contour-analysis': '图像轮廓分析：形状度量、特征提取与分类',
}

let updated = 0
let skipped = []
for (const dir of readdirSync(ROOT, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue
  const zh = DESC[dir.name]
  if (zh === undefined) { skipped.push(dir.name); continue }
  const file = join(ROOT, dir.name, 'SKILL.md')
  const raw = readFileSync(file, 'utf8')
  // Strip a UTF-8 BOM (PowerShell writes one) and detect the line ending.
  const text = raw.replace(/^\uFEFF/, '')
  const eol = /\r\n/.test(text) ? '\r\n' : '\n'
  // Replace the first `description:` line inside the leading frontmatter block.
  const match = text.match(/^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n)/)
  if (!match) { skipped.push(`${dir.name} (no frontmatter)`); continue }
  const head = match[2]
  if (/description:\s*[「「“"']?[\u4e00-\u9fff]/.test(head)) { skipped.push(`${dir.name} (already zh)`); continue }
  const next = head.replace(/^description:.*$/m, `description: ${zh}`)
  if (next === head) { skipped.push(`${dir.name} (no desc line)`); continue }
  writeFileSync(file, text.replace(match[0], `${match[1]}${next}${match[3]}`), 'utf8')
  updated += 1
}
console.log(`updated=${updated}`)
console.log(`skipped=${JSON.stringify(skipped)}`)
