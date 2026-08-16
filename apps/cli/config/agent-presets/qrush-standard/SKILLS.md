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

## 来源与候选（待补充调研结果）

> 子代理调研 GitHub / B 站 / 小红书后填充。候选技能按用途分类：编码、测试、文档、Web 搜索、MCP、Git 工作流、代码审查、图片处理等。

## 自动选择（规划中，暂不实现）

DSH 机制本身已支持模型**自动选择**：技能目录（`<available_skills>`）在每步注入给模型，模型按 `description`/`whenToUse` 自行决定加载哪个技能。后续可增强：

- 按会话场景（编码 / 文档 / 数据分析）预选一组默认技能；
- 技能分组与按需加载优先级。

这部分等预装技能稳定后再做。
