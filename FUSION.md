# Qrush 融合清单（Fusion Catalog）

> Qrush 的目标：**海纳百川**——把开源 DSH 生态的二开/插件/重实现项目，按「借鉴融合」纳入 Qrush。
> 原则：① 项目要开源；② 许可证记录清楚（MIT/Apache 直接融合；GPL 可融合但 Qrush 相应部分随之开源，用户已确认接受；无许可证一律不融）；③ 融合方式分三档：**直接集成**（代码进 Qrush）/ **一键插件**（Qrush 提供安装脚本）/ **参考思路**（只借鉴架构不抄代码）。
> 调研依据：`research/dsh_projects/DSH_第三方二开调研报告.md`（子代理 2026-08 全量调研：20 个指定项目 + ~40 个补充发现，star/许可证均经 GitHub API 核实）。

## 可融合项目（已核实）

| 项目 | Star | 许可证 | 功能 | 融合方式 | 状态 |
|---|---|---|---|---|---|
| [anywhere-labs/deepseek-harness-desktop](https://github.com/anywhere-labs/deepseek-harness-desktop) | 9875 | MIT | in-process Electron 桌面：在 Electron main 启动 Host Cordis 根、复用 loopback Web carrier、托盘、profile 切换、内置 pnpm、桌面终端、更新检查（「壳即插件」路线） | 直接集成 / 参考思路 | 待融合 |
| [magian1127/deepseek-harness-zh_pro](https://github.com/magian1127/deepseek-harness-zh_pro) | 6 | MIT | 中文界面增强：中文补全、思考自动展开、统计全显示、对话宽度 | 一键插件 | 已安装（verified） |
| [shaobeichen/dsh-pocket](https://github.com/shaobeichen/dsh-pocket) | 18 | GPL-2.0 | 手机访问：局域网二维码 + cloudflared 公网隧道 + 移动端 UI（dsh 拒绝 0.0.0.0，必须走代理/隧道） | 一键插件 | 已提供脚本 |
| [Qinling-Melon-Farmers/dsh-memoir](https://github.com/Qinling-Melon-Farmers/dsh-memoir) | 8 | Apache-2.0 | **项目持久记忆**：回合收尾自动归纳（work/lessons/actions）→ `PROJECT_MEMORY.md` + 全局索引 `~/.dsh/dsh-memoir.json` → 新会话按 token 预算自动注入 Hot Memory（**冻结快照，prompt 前缀稳定，命中 DeepSeek 前缀缓存**）；Web「记忆」面板（项目/全局/检索/手动维护）；纯 TS 零外部依赖 | 一键插件 | **已安装（verified）** |

## 记忆增强（Qrush 核心方向，2026-08 落地）

> 用户需求：「记忆增强也很重要，如果能有记忆，那就会越用越好用」。DSH 自带只有会话持久化/AGENTS.md/设置，**没有跨会话长期记忆**——这是 Qrush 与官方拉开差距的关键方向。

### 已融合：dsh-memoir（Apache-2.0，首选）

- **为什么选它**：① 与 Qrush「缓存优化」主题同频——v0.4 专门做了 cache-aware 注入（每会话冻结一次 Hot Memory 快照，同会话后续组装复用同一文本，最大化 DeepSeek 前缀缓存命中）；② 纯 TS、零外部依赖、无二进制/无服务；③ 中文优先，作者把「会话做了什么/踩了什么坑/下一步怎么走」沉淀为可继承的项目知识，正是「越用越好用」的形态。
- **安装**：`pwsh scripts/install-memory.ps1 [-Headless]`（vendored 在仓库外的 `../vendored/dsh-memoir`，`file:` 协议安装使 peer 依赖从 profile 解析；已把 peer 从 rc.6 降到 rc.5——memoir 用到的 API `tools.register` / `systemPrompt.section`（函数 text）/ `agent.steer` / `agent/turn-stopping` / `webServer.register` 在 Qrush rc.5 全部存在，boot 验证通过）。
- **验证**：web boot HTTP 200（插件完整加载）；自带测试 **70/73 通过**（3 个失败为 Windows 盘符大小写断言 `c:/` vs `C:\`，非功能问题），关键闭环全过：apply 挂载、record→read 工具闭环、**prompt 快照稳定性**、注入 budget 硬上限、BM25 召回 ≥90%。
- **已知问题**：Qrush headless profile 在当前 Windows 环境下跑真实任务会报 `spawn powershell.exe ENOENT`（与 memoir 无关，纯对话任务同样触发，待查）。

### 记忆类候选（按方向备选）

| 项目 | Star | 许可证 | 特点 | 评估 |
|---|---|---|---|---|
| [ZSeven-W/dsh-noema](https://github.com/ZSeven-W/dsh-noema) | 90 | MIT | 长期记忆 + Noema MCP 服务器（Rust 二进制）：`noema_recall/search/browse/remember` 等 14 工具；**从 9 种 AI 编码工具导入记忆**（Codex/Claude Code/Cursor/Grok…）；设置页管理；崩溃保活 | 社区最主流；按需召回型（不自动注入）；依赖 noema-mcp 二进制 + 常驻子进程，跨平台构建有成本；适合做「导入旧记忆」的进阶件 |
| [adoresever/graph-memory](https://github.com/adoresever/graph-memory) | 530 | MIT | 图记忆：会话知识→TASK/SKILL/EVENT 节点 + 类型化边；局部子图检索；SQLite 本地默认；语义向量 + FTS5 兜底 | 检索更聪明但更重；可作 memoir 的升级路线 |
| [Quophic/dsh-persona-memory](https://github.com/Quophic/dsh-persona-memory) | 2 | MIT | MEMORY/USER/failures 三文件持久化、预算化注入、FTS5+向量 RRF、后台自动学习、纠正检测、111 项测试 | 工程质量高；README 的「借鉴来源四档分级」是 Qrush 融合合规的最佳模板（子代理报告已人工核验 MIT） |
| [Aik358/dsh-auto-memory](https://github.com/Aik358/dsh-auto-memory) | 11 | BSD-3 | 三层记忆（用户级/项目/每日日志）+ 每轮小 subagent 自动沉淀（限频）+ 日历提醒/问候 | 人性化最全；BSD-3 兼容；依赖 rc.6 需同样降 peer |
| [MetheusNull/dsh-passive-memory](https://github.com/MetheusNull/dsh-passive-memory) | 0 | MIT | 「对话是证据，记忆是派生视图」：L0 全量证据 → 确定性 L1 分段 → 可选 LLM 压缩 | 思路参考（0.1.0-alpha） |
| [UnKnownFish125/dsh-deepmemory](https://github.com/UnKnownFish125/dsh-deepmemory) | 0 | **AGPL-3.0** | 每轮自动抽取 + 三路检索 RRF + Obsidian 图谱 UI + 每日衰减/归档 | AGPL 传染性强，如需融合必须独立仓库/进程隔离 |
| mbj733/dsh-hermes-memory 等 | 1 | **无许可证** | Hermes 风格跨会话记忆 | 红线：不融 |

## 融合方式速查

### 一键插件（推荐，保持 Qrush 仓库 MIT 纯净）

```sh
# 项目持久记忆（Apache-2.0）★ 已装
pwsh scripts/install-memory.ps1 [-Headless]   # dsh-memoir（vendored 于 ../vendored/）

# 手机访问（GPL-2.0，第三方）
pwsh scripts/install-mobile-access.ps1        # dsh-pocket

# 中文界面增强（MIT）
dsh plugin --profile web add deepseek-harness-zh_pro

# 桌面端增强（MIT，in-process Electron）
# 见下方「桌面端」说明
```

### 直接集成（代码进 Qrush，Qrush 对应部分随之按该项目许可证开源）

- 适合：MIT/Apache 且与 Qrush 核心方向强相关（如 anywhere-labs 桌面端、anchored-standard 场景路由、dsh-web-ui 皮肤）。
- 做法：vendor 到 `vendor/` 或 `packages/`，标注来源与许可证，随 upstream 同步。

### 参考思路（只借鉴不抄）

- 适合：实现复杂、与 Qrush 结构差异大（如 Tauri 桌面、云服务类）。
- 做法：记录架构要点到 `docs/`，Qrush 自研实现。

## 子代理调研：5 个优先融合项目（2026-08）

> 综合「与 Qrush 现状方向契合度 × 成熟度/star × 许可合规」排序，全部 MIT/Apache-2.0。

| # | 项目 | Star | 方向 | 融合建议 |
|---|---|---|---|---|
| 1 | [anywhere-labs/deepseek-harness-desktop](https://github.com/anywhere-labs/deepseek-harness-desktop) | 9875★ MIT | 桌面壳 | 直接复用其 Electron 壳（窗口/托盘/更新/子进程托管），替换其固定 DSH 子模块为 Qrush fork；采纳「桌面服务接口」开放给插件 |
| 2 | [xiaobright/dsh-anchored-standard](https://github.com/xiaobright/dsh-anchored-standard) | 3189★ MIT | 场景路由 | 「首轮 Minimal 锚定轨迹 → 首个持久事件后 promote 完整工具」预设家族（7 模式）+ `context-gate` 注入抑制 + `skill_search`/`skill_load` 按需解锁——与 Qrush 场景路由 + 45 技能天然衔接（⚠️ 作者已停更仅维护，机制仍有效） |
| 3 | [zhu1090093659/dsh-web-ui](https://github.com/zhu1090093659/dsh-web-ui) | 3641★ Apache-2.0 | 个性化 UI | 10 款皮肤中心 + 任务看板(cron) + Git 图谱 + 右侧面板 + 移动端远程(SSE) + 实时吞吐；全部走官方 profile 机制；移动端优先于 dsh-pocket（Apache 优于 GPL） |
| 4 | [Quophic/dsh-persona-memory](https://github.com/Quophic/dsh-persona-memory) | 2★ MIT | 记忆 | 见「记忆类候选」；其「借鉴来源四档分级」即 Qrush 融合合规模板 |
| 5 | [omdsh-dev/DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) | 1722★ MIT | 工作台+缓存 | 服务化侧边栏：`ctx.betterSidebar` 开放 API、文件/终端/Git/子代理页、**懒加载 chunk（核心 ~325KB）**——缓存优化方向直接借鉴 |

## 其他高价值候选（浓缩）

| 方向 | 项目 | 说明 |
|---|---|---|
| 插件生态 | [dsh-market/dsh-market](https://github.com/dsh-market/dsh-market) 649★ MIT + [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 5951★ CC0 | 内置插件市场 + 热禁用 + 备份；数据源 registry（CC0 可融） |
| TUI/性能 | [ccch1mneyyy/dsh-TUI](https://github.com/ccch1mneyyy/dsh-TUI) 1641★ MIT（官方收录） | 上下文进度条/TPS/**缓存命中率**实时显示、有界缓存（差分输出/消息虚拟化/回放合并） |
| 上下文观测 | [bowenliang123/dsh-context](https://github.com/bowenliang123/dsh-context) 116★ Apache-2.0 | 六类上下文堆叠条 + 逐 turn 增长图 + 压缩标记——「谁吃掉上下文预算」 |
| 视觉 | [liustack/modlens](https://github.com/liustack/modlens) 2491★ MIT / [Anionex/dsh-vision-toolkit](https://github.com/Anionex/dsh-vision-toolkit) 559★ MIT | 文本模型补视觉：粘贴即读、OCR、UI 还原（免费 Gemini 3.7 Flash 兜底） |
| 多代理 | [NanmiCoder/dsh-agent-teams](https://github.com/NanmiCoder/dsh-agent-teams) 439★ MIT | 单会话变多代理团队（captain + 任务 DAG + 邮箱通信 + 活动面板） |
| 浏览器桥 | [Lum1104/dsh-browser](https://github.com/Lum1104/dsh-browser) 215★ MIT | Chrome MV3 扩展控制真实标签页（9 工具，登录态保留） |
| 移动端 | [kelai141/dsh-mobile-apk](https://github.com/kelai141/dsh-mobile-apk) 60★ MIT / [icodesign/orbis](https://github.com/icodesign/orbis) 9★ Apache-2.0 | 真 APK（嵌入式 Termux 运行时，离线）vs iOS E2E 远程壳 |
| 模型路由 | [dylan121322/llm-adaptive](https://github.com/dylan121322/llm-adaptive) 2★ MIT + [Jesse-njx/dsh-polyglot](https://github.com/Jesse-njx/dsh-polyglot) 3★ MIT | 分类器分级路由（120s 决策缓存）+ provider 回退 |
| 综合套件 | [alex04130/dsh-forge](https://github.com/alex04130/dsh-forge) 1★ MIT | 市场 + 路由 + 技能管理 + 插件面板一站式 |
| 认知控制 | [Tiger3807861189/J-Space-Cognition-Suite-V3.6](https://github.com/Tiger3807861189/J-Space-Cognition-Suite-V3.6) 718★ Apache-2.0 | 推理时认知控制层，以 Skill 打包（anchored-standard 推荐） |
| 桌面补充 | [dataelement/dsh-desktop](https://github.com/dataelement/dsh-desktop) 608★ MIT（`.dshpreset` 便携预设）、[ChisaAlter/Deepseek-Harness-Desktop](https://github.com/ChisaAlter/Deepseek-Harness-Desktop) 103★ MIT（主题/托盘/工作区） | Electron 壳互补参考 |
| 桥接 | [cpj-dev/dsh-plugin-cc](https://github.com/cpj-dev/dsh-plugin-cc) 3★ MIT / [Lixiaoyiao/deepseek-harness-action](https://github.com/Lixiaoyiao/deepseek-harness-action) 11★ MIT | Claude Code 桥接 / GitHub Action（CI 审查） |

## 许可证红线（不可直接融合）

- **无许可证**（仅可读思路）：mbj733/dsh-hermes-memory、LayneChai/superpowers-dsh、hikariming/dshfind、zouyuxuan122/Deepseek-Harness-EAC、alchaincyf/deepseek-harness-orange-book、Electricitysheep/dsh-handbook。
- **MIT 变体（含非商业条款）**：hairyf/deepseek-harness-desktop（Tauri 2 架构可参考，代码不可商用复用）。
- **AGPL-3.0**：UnKnownFish125/dsh-deepmemory（如需融合必须独立仓库/进程隔离）。
- 其余候选（README 标注「未核实」者）融合前必须复查 LICENSE 全文。

## 桌面端融合决策

Qrush 现有 `desktop/`（Electron 壳 + spawn dsh web，简单 wrapper）。anywhere-labs 的 `dsh-plugin-desktop` 是 **in-process Electron**（更原生、更完整：托盘/profile/内置 pnpm/终端/更新）。两个选择：

1. **保持 wrapper**：Qrush desktop 简单够用，升级交给 anywhere-labs（`dsh plugin add dsh-plugin-desktop` 或其可执行 `npx dsh-plugin-desktop`）。
2. **升级 in-process**：借鉴 anywhere-labs 架构，把 Qrush desktop 升级为 in-process（工作量大，但桌面体验完整）。

> 建议：先验证 anywhere-labs 能否作为插件/可执行直接跑在 Qrush 上（它依赖官方 DSH 的 profile 结构，Qrush 是 fork 需适配）；能则用，不能则参考架构自研。

## 下一步候选（按用户方向）

1. **记忆增强深化**：memoir 已装；下一步可加 noema 导入（把 Claude Code/Codex 旧记忆搬进来）或 graph-memory 升级检索。
2. **场景路由升级**：融合 anchored-standard 的「锚定-晋升」机制 + context-gate 注入抑制，配合现有 scene-router。
3. **皮肤/工作台**：dsh-web-ui 皮肤中心 + DSH-better-sidebar 懒加载工作台。
4. **视觉**：modlens 粘贴即读，贴合用户 ML/图像处理主业。
