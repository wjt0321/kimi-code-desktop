# Kimi Code Desktop 0.3.0：任务运行控制中心设计

日期：2026-07-30
状态：已确认范围，待实施

## 1. 背景

Kimi Code Desktop 0.2.1 已具备本机 CLI 发现、服务生命周期、工作区、会话列表、任务创建、模型选择、提示词提交、执行时间线、审批/提问交互、停止任务、重命名和归档等基础闭环。

当前主要缺口不是继续增加页面，而是桌面端无法控制 Kimi Code CLI 已支持的关键会话运行状态。用户只能选择模型，不能直接调整权限、思考强度和计划模式，也无法在图形界面中压缩上下文、撤回上一轮或派生会话。

0.3.0 将优先补齐这些高频能力，并继续坚持以下边界：

- 桌面端只消费系统中已安装的 Kimi Code CLI 及其本地服务接口。
- 不复制 Agent 或 Session 执行逻辑，不修改上游源码。
- 服务端实时状态是事实来源，桌面端不自行推断运行模式。
- Windows 优先，所有主要用户界面和错误提示使用中文。

## 2. 目标

### 2.1 用户目标

用户在一个任务内可以：

1. 查看并切换模型、思考强度、权限模式和计划模式。
2. 明确知道当前配置是否已经由本机服务生效。
3. 查看上下文占用、当前运行状态和会话警告。
4. 压缩会话上下文，可选填写压缩指导语。
5. 撤回最近一轮用户输入，并把原输入恢复到编辑框中继续修改。
6. 从当前上下文派生新任务，并自动切换到新任务。
7. 在任务归档后从桌面端恢复。
8. 从顶部工具栏、输入区和命令面板获得一致的操作入口。

### 2.2 产品目标

- 将任务状态机从“是否运行”扩展到“运行策略 + 上下文状态 + 会话生命周期”。
- 为后续 Skills、MCP、插件、Goal、Swarm 和子代理 UI 建立稳定的共享 API 与状态层。
- 不让旧版 CLI 的单项接口缺失破坏现有聊天、任务和服务功能。

## 3. 非目标

0.3.0 不包含：

- Provider 添加、删除和登录。
- Skills、MCP、插件配置。
- Goal、Swarm、BTW 和子代理管理。
- 文件树、Git Diff、终端、图片或文件附件。
- 会话导出和调试包导出。
- 重做当前整体布局或更换视觉语言。

这些能力分别进入后续扩展中心和 IDE 化工作区迭代。

## 4. 上游能力映射

桌面端通过现有 `/api/v1` 接口接入能力：

| 桌面能力 | 服务接口 | 关键字段 |
| --- | --- | --- |
| 读取实时状态 | `GET /sessions/{id}/status` | `model`、`thinking_level`、`permission`、`plan_mode`、`swarm_mode`、`context_tokens`、`max_context_tokens`、`context_usage` |
| 修改运行策略 | `POST /sessions/{id}/profile` | `agent_config.model`、`thinking`、`permission_mode`、`plan_mode` |
| 会话警告 | `GET /sessions/{id}/warnings` | `warnings[]` |
| 压缩上下文 | `POST /sessions/{id}:compact` | 可选 `instruction` |
| 撤回轮次 | `POST /sessions/{id}:undo` | `count`，0.3.0 固定为 1 |
| 派生任务 | `POST /sessions/{id}:fork` | 可选 `title` |
| 恢复归档 | `POST /sessions/{id}:restore` | 无请求体 |

服务端返回值必须经过桌面端本地 Zod schema 校验，不能把未校验的 wire 数据直接暴露给渲染进程。

## 5. 共享数据模型

新增以下桌面端领域对象：

### 5.1 DesktopSessionRuntime

- `available`：当前服务是否支持实时状态接口。
- `model?: string`
- `thinkingLevel: string`
- `permission: 'manual' | 'yolo' | 'auto'`
- `planMode: boolean`
- `swarmMode: boolean`
- `contextTokens: number`
- `maxContextTokens: number`
- `contextUsage: number`
- `warnings: DesktopSessionWarning[]`

### 5.2 DesktopSessionWarning

- `code: string`
- `message: string`
- `severity: 'info' | 'warning' | 'error'`

### 5.3 DesktopModel 扩展

在现有模型信息上增加：

- `capabilities?: string[]`
- `supportEfforts?: string[]`
- `defaultEffort?: string`
- `adaptiveThinking?: boolean`

思考强度选项以模型目录返回的 `support_efforts` 为事实来源；没有该字段的旧模型只提供“关闭/开启”兼容选项，不能硬编码所有模型都支持 `low/high/max`。

### 5.4 写操作请求

分别定义并校验：

- `UpdateRuntimeRequest`
- `CompactSessionRequest`
- `UndoSessionRequest`
- `ForkSessionRequest`
- `RestoreSessionRequest`

不使用一个包含大量可选字段的通用 IPC 请求承载所有动作，避免调用方传入互相冲突的操作。

## 6. 主进程和服务客户端

`KimiDesktopClient` 增加：

- `getSessionRuntime(sessionId)`
- `updateSessionRuntime(sessionId, patch)`
- `getSessionWarnings(sessionId)`
- `compactSession(sessionId, instruction?)`
- `undoSession(sessionId, count)`
- `forkSession(sessionId, title?)`
- `restoreSession(sessionId)`

### 6.1 兼容策略

- `404`、`405` 或明确的未知路由错误视为“当前 CLI 不支持此能力”。
- 状态读取不支持时返回 `available: false`，现有任务仍可正常使用。
- 写操作不支持时给出中文说明，例如“当前 Kimi Code CLI 版本暂不支持计划模式切换”。
- 普通网络错误、鉴权错误和服务异常不能被误判为能力缺失。
- 更新运行策略后重新读取 `/status`，以服务端真实生效值覆盖乐观状态。

### 6.2 并发规则

- 同一会话运行策略写操作串行执行，防止快速切换导致旧响应覆盖新值。
- 会话正在运行时允许调整权限和思考强度，由服务端决定应用时机。
- 压缩、撤回和派生属于会话结构操作；任务忙碌时禁用并解释原因。

## 7. 渲染进程状态设计

`useWorkbench` 继续作为桌面工作台编排层，但将运行状态拆成独立切片：

- 当前会话实时状态。
- 状态加载和刷新状态。
- 每类写操作的 pending 状态。
- 能力可用性。
- 临时提示和错误。

### 7.1 刷新时机

以下事件触发实时状态刷新：

- 切换会话。
- 创建或派生会话。
- 运行策略写操作完成。
- 收到当前会话任务刷新事件。
- 任务从忙碌变为空闲。

连续任务事件必须合并刷新，避免每个流式事件都请求 `/status`。

### 7.2 撤回并编辑

1. 调用 `undoSession(sessionId, 1)`。
2. 使用服务端返回或撤回前快照找到最近一条真实用户输入。
3. 重新加载任务快照。
4. 将原输入写入 `TaskComposer` 草稿并聚焦。
5. 不自动重新发送。

如果会话没有可撤回轮次，显示服务端提供的不可撤回原因，不修改编辑器内容。

## 8. UI/UX 设计

### 8.1 输入区运行策略条

在当前模型选择器旁增加：

- 思考强度选择器。
- 权限模式选择器。
- 计划模式开关。

保持紧凑胶囊式控件，不把输入区变成设置表单。控件弹层继续使用与模型菜单相同的深色、圆角、边框和选中状态。

权限中文说明：

- `手动确认`：敏感操作交给用户决定。
- `YOLO`：自动批准工具操作，但模型仍可提问。
- `完全自动`：模型自行决定，不等待审批或提问。

计划模式开启时：

- 输入框边框和计划标记使用强调色。
- 提示语说明“当前只制定计划，不直接执行修改”。
- 不使用强烈警告色，避免与错误状态混淆。

### 8.2 顶部状态摘要

任务标题下方展示：

- 当前模型。
- 思考强度。
- 权限模式。
- 计划模式。
- 上下文百分比。

仅展示已经从服务端确认的值。正在更新时显示轻量进度状态，而不是立即假装已生效。

### 8.3 任务操作菜单

当前“更多任务操作”按钮改为统一菜单：

1. 撤回并编辑。
2. 压缩上下文。
3. 派生为新任务。
4. 重命名任务。
5. 归档任务。

危险或不可逆动作需要二次确认。派生和压缩使用自定义对话框，可选填写标题或压缩指导语。

任务列表标题区增加“已归档任务”入口。它通过 `GET /sessions?archived_only=true` 按需加载独立列表，允许查看标题、工作区和更新时间，并执行恢复；恢复成功后刷新正常任务列表并选中新恢复的任务。归档会话不混入日常任务列表。

### 8.4 右侧详情面板

新增“运行状态”区块：

- 上下文进度条和 token 数。
- 当前模型、思考、权限、计划状态。
- 会话警告列表。
- 手动刷新入口。

审批、提问、待办和子任务仍保持优先展示；运行状态不抢占待处理交互。

### 8.5 命令面板

增加中文命令：

- 切换权限模式。
- 切换计划模式。
- 调整思考强度。
- 撤回并编辑。
- 压缩当前会话。
- 派生当前任务。
- 刷新运行状态。

命令面板调用与可视控件相同的 action，不复制业务逻辑。

## 9. 错误和反馈

- 控件级失败：在控件附近回滚到服务端值，并显示中文错误。
- 会话结构操作失败：使用工作台顶部错误条。
- 成功操作：使用短暂、非阻塞状态提示。
- 能力缺失：控件禁用并提供原因，不持续弹出错误。
- 会话切换后，旧会话的迟到响应不得覆盖新会话。

## 10. 测试策略

严格采用测试先行：

### 10.1 主进程

- wire schema 映射。
- profile 更新字段。
- status、warnings、compact、undo、fork、restore 请求路径和请求体。
- 能力缺失与普通错误分类。

### 10.2 共享契约

- 所有新请求和响应 schema。
- 非法 permission、contextUsage 和空 session id 拒绝。

### 10.3 Hook

- 会话切换刷新。
- 迟到响应隔离。
- 更新后重新读取真实状态。
- busy 时禁用结构操作。
- undo 后恢复草稿。
- fork 后刷新并切换新任务。
- 归档列表按需加载，恢复后回到正常列表。

### 10.4 组件

- 运行策略选择器键盘操作和选中状态。
- 计划模式视觉状态。
- 更多操作菜单和确认框。
- 旧 CLI 能力缺失展示。
- 中文可访问名称。

### 10.5 完整验证

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- Windows 安装版和免安装版启动冒烟测试。
- 使用本机 Kimi Code CLI 实测权限、思考、计划、压缩、撤回和派生。

## 11. 发布

- 版本目标：`0.3.0`。
- 继续输出安装版、免安装 ZIP 和 SHA256 校验文件。
- 发布到独立仓库 `wjt0321/kimi-code-desktop`。
- README 更新功能清单和操作说明。
- 保留对上游 Kimi Code 的 MIT 来源声明和非官方客户端说明。
