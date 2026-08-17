# @deepseek-ai/dsh-qrush-anchor

Qrush anchor：把每个会话的**第一个模型请求**保持在最小工具目录上、并抑制全部自动注入，出现第一个持久信号（`tool/call` 或 `assistant/message`）后晋升到完整工具目录。从 [dsh-anchored-standard](https://github.com/xiaobright/dsh-anchored-standard)（MIT）移植：tool-bootstrap 目录过滤、claimed 基线 pre-step 门、runtime-context 清空，保留其降级行为（bootstrap 工具缺失或内部出错时暴露完整目录，绝不卡死请求）。

## Model Experience（模型可见行为）

- **请求 #1（bootstrap 阶段）**：模型只看到 `bootstrapTools`（默认 `read`/`write`/`edit`/`glob`/`grep`）——无 shell、无 web/subagent/workflow 等重型工具；系统提示词里没有自动注入的 runtime context（沙箱/审批策略快照），pre-step 消息批里没有技能目录、AGENTS.md 摘要、time/tmux 上下文、hooks 等自动注入（用户主动的 `skill-invocation` 手势保留）。
- **请求 #2 起（resident 阶段）**：完整上下文恢复，工具目录为**全集减去重型工具**（`heavyTools`，默认 web_search/subagent/workflow/ralph/goal/jobs/read_image/多代理控制等），重型工具通过 `dev_tool_search` 按需解锁（下一请求生效，session 内保持）；第三方插件工具（如 memoir_record）自动保留，不会被误伤。loop 的 snapshot 投影恰好差分注入一条新的 runtime-context 消息。
- **`dev_tool_search`**：resident 阶段常驻的发现工具——`query` 搜索完整目录（返回工具名 + 简介），`toolNames` 解锁重型工具（durable 事件驱动，resume 保留）。
- **compaction 之后**：会话回到受控阶段（bootstrap 集 + `compactionTools` 工作集），直到 compaction 边界之后出现新的持久信号。
- 阶段从持久 session 事件推导，resume/reload 不丢失。

### 与 Qrush 缓存策略的关系

bootstrap 与 resident 是两个**字节级稳定**的工具/上下文前缀段：每个会话的请求 #1 复用 bootstrap 段（极小、便宜），晋升后的请求复用 resident 段——两段各自命中 DeepSeek 前缀缓存，段间切换只 miss 一次。

### 与 qrush-scene-router 的关系

scene-router 在 pre-step 注入场景技能提醒（`source.kind: plugin`）——bootstrap 阶段会被 anchor 的 claimed 基线门剥离，晋升后恢复。因此首轮模型面对极简提示，第二轮起才看到场景提示与完整目录。

## 配置

在挂载行加 `config`（全部可省略）：

```yaml
- id: qrush-anchor
  name: '@deepseek-ai/dsh-qrush-anchor'
  config:
    enabled: true              # 总开关（两条拦截路径）
    promoteOn: either          # either | tool-call | assistant-message
    includeSubagents: false    # true 让子代理同样走锚定阶段
    allowKinds: [skill-invocation]  # pre-step 门放行的 source.kind
    bootstrapTools: [read, write, edit, glob, grep]   # 首请求目录
    compactionTools: [read, write, edit, glob, grep, todo_write, ask_user_question]
    heavyTools: [web_search, subagent, workflow, ...] # resident 阶段隐藏的重型工具
```

未知键在挂载时报错。`allowKinds: []` 显式表示只保留 claimed 批次；`heavyTools: []` 表示 resident 阶段不隐藏任何工具。

## Known Limitations and Deferred Work

- **skill_search/skill_load 未移植**：anchored-standard 的按需技能发现未做——Qrush 的 `skill` 工具 + scene-router 场景提示已经承担技能选择，resident 阶段技能目录恢复注入。后续如需要可补。
- **promoteOn 'either' 陷阱**：纯文字首答（无工具调用）也会触发晋升（`assistant/message`），这是设计意图（避免困在 bootstrap），但意味着"首轮极简"只保证第一个请求。
- **技能目录/AGENTS.md 摘要的剥离**依赖它们走 `agent/pre-step`（当前 Qrush 实现如此）；若未来注入路径改为 system-prompt section，需要同步扩展本插件。
