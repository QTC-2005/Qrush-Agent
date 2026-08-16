# Qrush 第三方插件选型目录

> 官方自带插件一律不改动；本目录仅记录**可选装**的第三方插件（生态来源：GitHub `dsh-plugin` topic + 社区调研，详见 `../research-dsh-ecosystem/`）。
> ⚠️ **安全红线**：deepseek-harness 2026-08-13 才开源，生态仅约 3 天，**多数插件未经充分审计，且插件代码不受审批沙箱约束**——预装前必须源码审查 + 确认许可证。本目录按「先安全、再技能、后工具」排序，全部标注许可证与风险提示。

## 安装方式

```sh
# 插件（仅声明 dsh.bundle.patch 的包激活为 profile 层）
dsh plugin --profile web add "github:owner/repo#main"   # 或 npm 包名

# Skills（本仓库统一管理，见 SKILLS.md，不在此安装）
# 放到 <name>/SKILL.md 或 ~/.dsh/skills/<name>/SKILL.md
```

## 第一批（风险可控，可选装其一）

| 类型 | 名称 | 仓库 | 说明 | 许可证 | 风险 |
|---|---|---|---|---|---|
| 市场 | dsh-market | https://github.com/dsh-market/dsh-market | 设置页内插件市场：浏览/搜索/一键安装 | MIT | 低（需审源码） |
| 选型目录 | awesome-dsh-plugin | https://github.com/awesome-dsh-plugin/awesome-dsh-plugin | 社区精选聚合（14 类） | CC0-1.0 | 无（纯列表） |
| 中文选型目录 | beancookie/awesome-dsh-plugin | https://github.com/beancookie/awesome-dsh-plugin | 316 个中文分类插件清单 | CC0-1.0 | 无（纯列表） |
| 技能批量导入 | Jesse-njx/dsh-skillport | https://github.com/Jesse-njx/dsh-skillport | 把 Claude Code/Codex 的 SKILL.md 技能库带进 DSH | MIT | 低（审源码） |

## 第二批（Skills 预装 —— 本仓库已用 MIT 源直装，见 SKILLS.md 来源表）

- obra/superpowers（MIT）—— TDD/调试/规划/头脑风暴
- mattpocock/skills（MIT）—— 18 个工程技能
- ⚠️ anthropics/skills —— 文档处理（docx/pdf/pptx/xlsx）价值高但**许可证未核实，确认后再装**

## 第三批（按需增强，预装前逐个源码审查）

| 类型 | 名称 | 仓库 | 说明 | 许可证 |
|---|---|---|---|---|
| 工具 | dsh-toolkit | https://github.com/omdsh-dev/dsh-toolkit | 零依赖 10 件套（time/encoding/json/calc/csv/regex/markdown/diff 等） | MIT |
| 工具 | dsh-tool-git | https://github.com/lxj808624/dsh-tool-git | 结构化 Git 工具 + 破坏性命令护栏 | 待确认 |
| 安全 | dsh-permissions | https://github.com/940842546/dsh-permissions | Claude Code 风格权限规则引擎 | 待确认 |
| 安全 skills | dsh-skill-pack-security | https://github.com/PerryLink/dsh-skill-pack-security | 8 个安全审计 skills，零运行时 | Apache-2.0 |
| Provider | llm-adaptive | https://github.com/dylan121322/llm-adaptive | flash/pro 自适应模型路由（与缓存策略方向一致） | MIT |
| Provider | dsh-polyglot | https://github.com/Jesse-njx/dsh-polyglot | OpenAI 兼容端点 + 自动回退 | MIT |
| 研究 | dsh-deep-research | https://github.com/omdsh-dev/dsh-deep-research | 自适应深度研究编排（基于官方 workflow） | MIT |
| 上下文 | dsh-context | https://github.com/bowenliang123/dsh-context | 上下文构成/趋势/压缩洞察面板 | Apache-2.0 |
| 文档 | dsh-plugin-anydoc | https://github.com/beancookie/dsh-plugin-anydoc | Word/PPT/Excel/PDF/EPUB → Markdown | 待确认 |

## 不建议/待核实

- 大批量合集（alirezarezvani/claude-skills 345 个、dhicoc/dsh-reverse-skill 85 个）：质量未逐条核实
- 桥接/IM 类（QQ/飞书/Claude Code 桥）：按需、审源码后装
- GitHub search topic:dsh-plugin 的结果不可信（混入无关仓库），以逐仓 API 核实为准

## 预装检查清单（每个插件装前必过）

1. 源码审查：clone 后人工读一遍 `cordis.patch.yml` / `src/`，确认没有恶意行为（网络外传、密钥收集、文件破坏）；
2. 许可证确认：仓库 LICENSE 文件存在且允许再分发（MIT/Apache/CC 优先）；
3. 依赖最小化：零依赖或少量已审计依赖优先；
4. 与官方能力不重复（web 搜索/MCP 已内置）。
