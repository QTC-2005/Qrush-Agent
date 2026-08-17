# Qrush 融合清单（Fusion Catalog）

> Qrush 的目标：**海纳百川**——把开源 DSH 生态的二开/插件/重实现项目，按「借鉴融合」纳入 Qrush。
> 原则：① 项目要开源；② 许可证记录清楚（MIT/Apache 直接融合；GPL 可融合但 Qrush 相应部分随之开源，用户已确认接受；无许可证一律不融）；③ 融合方式分三档：**直接集成**（代码进 Qrush）/ **一键插件**（Qrush 提供安装脚本）/ **参考思路**（只借鉴架构不抄代码）。

## 可融合项目（已核实）

| 项目 | Star | 许可证 | 功能 | 融合方式 | 状态 |
|---|---|---|---|---|---|
| [anywhere-labs/deepseek-harness-desktop](https://github.com/anywhere-labs/deepseek-harness-desktop) | 9867 | MIT | in-process Electron 桌面：在 Electron main 启动 Host Cordis 根、复用 loopback Web carrier、托盘、profile 切换、内置 pnpm、桌面终端、更新检查（官方预留的深度桌面路线） | 直接集成 / 参考思路 | 待融合 |
| [magian1127/deepseek-harness-zh_pro](https://github.com/magian1127/deepseek-harness-zh_pro) | 6 | MIT | 中文界面增强：中文补全、思考自动展开、统计全显示、对话宽度 | 一键插件 | 推荐装 |
| [shaobeichen/dsh-pocket](https://github.com/shaobeichen/dsh-pocket) | 18 | GPL-2.0 | 手机访问：局域网二维码 + cloudflared 公网隧道 + 移动端 UI（dsh 拒绝 0.0.0.0，必须走代理/隧道） | 一键插件 | 已提供脚本 |

## 融合方式速查

### 一键插件（推荐，保持 Qrush 仓库 MIT 纯净）

```sh
# 手机访问（GPL-2.0，第三方）
pwsh scripts/install-mobile-access.ps1        # dsh-pocket

# 中文界面增强（MIT）
dsh plugin --profile web add deepseek-harness-zh_pro

# 桌面端增强（MIT，in-process Electron）
# 见下方「桌面端」说明
```

### 直接集成（代码进 Qrush，Qrush 对应部分随之按该项目许可证开源）

- 适合：MIT/Apache 且与 Qrush 核心方向强相关（如 anywhere-labs 桌面端、dsh-context 上下文洞察）。
- 做法：vendor 到 `vendor/` 或 `packages/`，标注来源与许可证，随 upstream 同步。

### 参考思路（只借鉴不抄）

- 适合：实现复杂、与 Qrush 结构差异大（如 Tauri 桌面、云服务类）。
- 做法：记录架构要点到 `docs/`，Qrush 自研实现。

## 桌面端融合决策

Qrush 现有 `desktop/`（Electron 壳 + spawn dsh web，简单 wrapper）。anywhere-labs 的 `dsh-plugin-desktop` 是 **in-process Electron**（更原生、更完整：托盘/profile/内置 pnpm/终端/更新）。两个选择：

1. **保持 wrapper**：Qrush desktop 简单够用，升级交给 anywhere-labs（`dsh plugin add dsh-plugin-desktop` 或其可执行 `npx dsh-plugin-desktop`）。
2. **升级 in-process**：借鉴 anywhere-labs 架构，把 Qrush desktop 升级为 in-process（工作量大，但桌面体验完整）。

> 建议：先验证 anywhere-labs 能否作为插件/可执行直接跑在 Qrush 上（它依赖官方 DSH 的 profile 结构，Qrush 是 fork 需适配）；能则用，不能则参考架构自研。

## 待补充

> 子代理系统调研中：UI 增强（dsh-web-ui / DSH-better-sidebar）、功能插件（dsh-context / dsh-permissions / dsh-toolkit / dsh-deep-research / dsh-polyglot）、记忆类、桥接类、GitHub Action 等。完成后更新本清单。
