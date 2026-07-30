# Kimi Code Desktop 0.4.0：执行透明化与变更审阅设计

日期：2026-07-30  
状态：用户已确认，待实施

## 1. 背景

Kimi Code Desktop 0.3.0 已经形成可用的本机任务闭环：识别系统 Kimi Code CLI、管理本地服务、选择工作区、创建和恢复会话、发送任务、切换模型与运行策略、处理中断、上下文压缩、撤回、分叉、归档，以及基础审批和提问。

当前最大体验缺口已经从“不能操作”转变为“看不清发生了什么”：

- Transcript 投影只保留工具名称、简单状态和字符串化输出，丢弃 `toolCallId`、输入、结构化 display、实时 progress、文件路径、任务引用和审批锚点。
- 审批虽然可处理，但只集中在右侧详情栏，无法自然地和触发它的工具调用对应。
- 文件写入和编辑缺少可读的差异视图，用户难以判断将要修改什么。
- ExitPlanMode 的计划审阅被压缩成普通审批，不能体现计划内容、审阅选项和反馈语义。
- 后台任务、子 Agent 和普通工具活动在视觉上没有明确区分。

上游 Kimi Code 0.31.0 已继续扩展自定义 Agent 和后台任务能力，但 0.4.0 不追求一次覆盖所有 CLI 菜单，而是优先建立稳定的“执行透明层”。

## 2. 目标

### 2.1 用户目标

用户在任务执行过程中可以：

1. 按原始执行顺序查看思考、回复、工具调用、审批、任务进度和结果。
2. 快速识别 Shell、读取、写入、编辑、搜索、网络请求、子 Agent 等常见工具。
3. 展开工具卡片查看输入、工作目录、文件路径、进度、输出和错误。
4. 在对应工具调用附近处理审批，而不是在界面其他位置寻找。
5. 审阅 Shell 命令、文件操作和文件差异后再决定批准或拒绝。
6. 阅读 ExitPlanMode 计划，选择批准实施或要求修改，并可提交反馈。
7. 从右侧详情面板查看完整文件差异、后台任务和待办进度。
8. 当 CLI 返回未知的新工具或新 display 结构时，仍能看到安全的通用展示。

### 2.2 产品目标

- 让任务时间线成为真实的执行记录，而不只是聊天气泡列表。
- 建立独立于上游前端实现的桌面端工具展示契约。
- 为后续文件浏览、Git 变更中心、自定义 Agent、插件和多 Agent 工作区提供基础。
- 保持桌面端与系统 CLI 解耦，不复制执行引擎，不混入上游仓库。

## 3. 非目标

0.4.0 不包含：

- 在桌面端直接修改、保存或回滚文件。
- 完整 Git 状态、暂存、提交和分支管理。
- 内嵌终端或持久交互式 Shell。
- 自定义 Agent 创建、编辑和选择器。
- 插件、MCP、Skills 配置中心。
- 多会话并行执行或多窗口工作区。
- 直接依赖 `@moonshot-ai/transcript` 或上游 Monorepo 内部包。
- 复制或嵌入 Vue 版本的 Kimi Web。

## 4. 方案选择

### 4.1 采用：桌面端稳定投影层

继续使用当前结构：

`Kimi CLI / kap-server -> Electron main KimiClient -> defensive projector -> shared Zod contracts -> preload IPC -> React renderer`

扩展 Electron main 中的 Transcript 投影器，将原始开放内容转换为桌面端稳定领域对象。React 只消费经过校验的数据。

优点：

- 不要求桌面项目安装上游源码。
- 可同时兼容 CLI 0.30.0、0.31.0 和未来安全降级版本。
- UI 可以保持 Codex 风格而不受 Kimi Web Vue 组件约束。
- 原始未知字段不会直接穿过 Electron 安全边界。

### 4.2 不采用：直接依赖 Transcript 包

`@moonshot-ai/transcript` 是上游内部快速演进的数据层。桌面端直接依赖会让独立发布和 CLI 版本兼容变得困难，因此本轮不采用。

### 4.3 不采用：嵌入 Kimi Web

Kimi Web 与当前 React/Electron 架构、窗口交互和产品定位不一致。嵌入会退化为网页套壳，也无法满足 Windows 原生桌面体验要求。

## 5. 数据模型

### 5.1 Rich Tool Timeline Entry

扩展 `DesktopTimelineEntry` 的 `tool` 分支：

- `id`：Transcript frame id。
- `toolCallId?: string`：工具调用标识。
- `name`：原始工具名。
- `view?: string`：上游建议的视图类型。
- `category`：`shell | read | write | edit | search | web | agent | task | todo | generic`。
- `state`：`running | done | error`。
- `title`：本地化后的主标题。
- `summary`：单行摘要。
- `inputText?: string`：未解析的输入文本，用于兼容和诊断。
- `input?: DesktopDisplayValue`：经过大小限制的结构化输入。
- `output?: DesktopDisplayValue`：经过大小限制的结构化输出。
- `error?: string`。
- `progress?: DesktopToolProgress`。
- `path?: string`、`command?: string`、`cwd?: string`、`query?: string`：常见工具的规范化快捷字段。
- `approvalId?: string`、`taskId?: string`、`todoId?: string`。
- `agentRefs?: DesktopAgentRef[]`。
- `diff?: DesktopDiffTarget`：能够由参数安全生成的文件差异。

### 5.2 Display Value

开放的上游 input/output 不能原样传入渲染进程。桌面端定义受限表示：

- 标量：字符串、数字、布尔值、空值。
- 数组和对象：限制递归深度、键数量和总字符数。
- 超出限制时附加 `truncated: true`。
- 不识别值降级为安全字符串。
- 不允许函数、原型链对象或循环引用进入 IPC。

### 5.3 Tool Progress

- `kind`：`stdout | stderr | progress | status | custom`。
- `text?: string`。
- `percent?: number`，限定 0–100。
- 自定义数据仅保留经过限制的 display value。

### 5.4 Approval Block

`DesktopApproval` 扩展：

- `toolCallId?: string`。
- `agentId?: string`。
- `block` 使用判别联合：
  - `shell`：command、cwd、danger。
  - `diff`：path、diff lines。
  - `file`：path、content、language。
  - `fileop`：op、path、detail。
  - `url`：method、url。
  - `search`：query、scope。
  - `invocation`：kind2、name、description。
  - `todo`：items。
  - `plan_review`：plan、path、options。
  - `generic`：summary。
- 保留现有 `toolName`、`action`、`summary` 作为兼容字段。

### 5.5 Diff Model

- `DesktopDiffLine`：`type`、`text`、`oldNo?`、`newNo?`。
- `DesktopDiffTarget`：id、title、path、lines、fallbackOutput、truncated。
- 对单次 Edit/Write 可以从参数推导 before/after 差异。
- 多编辑、append、replace-all 或数据不足时，不伪造 Diff，改为展示原始输出。
- 设置最大计算单元，防止超大文件的 LCS 计算阻塞 UI。

## 6. Main Process 投影

### 6.1 Transcript Projector

`transcript-projector.ts` 负责：

1. 读取工具 frame 的 `toolCallId`、`view`、`input`、`inputText`、`output`、`display`、`error`、`progress` 和引用字段。
2. 通过工具名和 view 选择分类器。
3. 从常见参数中提取 command、cwd、path、query 等字段。
4. 生成本地化标题与摘要，但始终保留原始工具名。
5. 尝试为 Edit/Write 工具生成安全 Diff target。
6. 对未知工具创建 generic 卡片。

分类器必须是纯函数，便于对不同 CLI payload 做单元测试。

### 6.2 Approval Projector

审批接口中的 `request_display` / display block 是事实来源。投影器：

- 严格识别已支持的 kind。
- 校验 Diff 行、计划 options、Todo items 等子结构。
- 数据不完整时降级 generic，而不是丢弃整个审批。
- 建立 `approvalId -> toolCallId` 锚点供渲染层定位。

### 6.3 兼容策略

- CLI 0.30.0 缺少某些字段时，继续展示现有简化工具卡片。
- CLI 0.31.0 及后续返回额外字段时忽略未知键。
- 接口不存在时仅禁用对应功能，不影响聊天和服务连接。
- 不以版本号作为唯一判断，优先判断接口和字段能力。

## 7. 渲染架构

### 7.1 TaskTimeline

时间线继续保持原始 frame 顺序。新增：

- `ToolCallCard`：统一工具卡片入口。
- `InlineApprovalCard`：锚定在对应工具卡片之后。
- 未锚定审批显示在时间线尾部的“等待处理”区。
- 工具完成后默认折叠；运行中、失败和等待审批默认展开。
- 连续低信息工具可视觉分组，但 DOM 和数据顺序不改变。

### 7.2 ToolCallCard

卡片三层：

1. 摘要行：图标、标题、路径/命令摘要、状态。
2. 进度行：运行中状态、百分比、最新 stdout/stderr。
3. 展开区：结构化输入、输出、错误、Diff 入口和任务入口。

不得只用颜色表达状态；图标和中文文字同时存在。

### 7.3 Diff Review Panel

复用右侧详情区域作为审阅面板，而不是增加永久第四列。

- 点击 Diff 打开右侧面板。
- 再次点击同一 Diff 关闭。
- 顶部显示文件名、完整路径、增删统计。
- 内容采用虚拟友好的行结构与等宽字体。
- 支持复制路径、复制 Diff、在资源管理器中定位。
- 窄窗口下使用覆盖式抽屉。

### 7.4 Approval Card

审批卡片根据 block.kind 展示：

- Shell：命令代码块、cwd、风险说明。
- Diff：紧凑差异预览和“查看完整差异”。
- File/FileOp：路径、操作和内容摘要。
- URL/Search：目标与范围。
- Plan Review：Markdown 计划、路径、选项和反馈输入。
- Generic：安全摘要。

批准和拒绝均允许可选反馈；计划审阅按 option label 提交上游要求的 `selected_label`。

### 7.5 Context Dock

右侧详情栏继续承担全局信息：

- 待处理审批/问题摘要。
- Todo 总进度。
- 后台任务列表。
- 当前选中的 Diff 或任务详情。
- Runtime 状态。

审批主入口改为时间线内联，Context Dock 作为导航和汇总，不重复渲染整张大型卡片。

## 8. Windows 集成

新增最小化 IPC：

- `desktop:reveal-path`：只允许存在的绝对路径，使用 Electron `shell.showItemInFolder`。
- `desktop:copy-text` 不需要新增 IPC，使用受限 renderer clipboard 能力或 Electron clipboard preload 封装；优先选择 preload 封装。
- 路径必须来自当前会话工作区或工具投影结果，调用前再次规范化。

0.4.0 不提供执行任意 shell 命令的 UI API。

## 9. 视觉与交互

视觉继续沿用当前 Codex 风格深色工作台，但针对执行记录强化层级：

- 聊天正文保持宽松，工具卡片更紧凑。
- Shell/代码采用 Cascadia Code、Consolas 等系统等宽字体。
- 运行中使用克制的紫色动态指示，成功使用低饱和绿色，失败使用珊瑚红。
- Diff 新增使用低饱和绿色背景，删除使用低饱和红色背景。
- 所有弹层、菜单、审批卡片继续使用统一圆角、边框和阴影变量。
- 不使用 Emoji 充当功能图标，统一使用 Lucide SVG。
- 交互目标不小于 32px；关键审批按钮不小于 36px。
- 支持 `prefers-reduced-motion`。

## 10. 状态与错误处理

- 审批提交期间按钮进入 pending，禁止重复提交。
- 提交失败保留审批卡和反馈草稿，并显示可重试错误。
- Diff 解析失败只影响 Diff，不影响工具卡和任务时间线。
- 输出过大时显示截断提示和原始输出尾部。
- WebSocket 刷新期间保留上一个 snapshot，避免卡片闪烁。
- 同一 approval 在 Context Dock 和时间线中只能有一个提交状态来源。

## 11. 测试策略

### 11.1 Projector 单元测试

覆盖：

- Shell、Read、Write、Edit、Search、Agent、未知工具。
- input/output/progress 和错误。
- 各类 ApprovalBlock。
- 单 Edit Diff、Write 新文件 Diff、不可推导 Diff。
- 超大、循环、畸形和缺字段 payload。
- CLI 0.30.0 简化 payload 与 0.31.0 丰富 payload。

### 11.2 Renderer 测试

覆盖：

- 工具卡展开、折叠和状态。
- 运行中进度更新。
- 内联审批批准、拒绝、反馈和 pending。
- Plan Review 选项。
- 打开/关闭 Diff 面板。
- 大型 Diff 降级提示。
- Context Dock 导航。

### 11.3 IPC 与集成测试

覆盖：

- 新契约在 main/preload/renderer 的校验。
- reveal path 的绝对路径与存在性约束。
- 工具刷新后审批锚点不重复。
- 服务断开和旧 CLI 降级。

### 11.4 发布前验证

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- Windows 安装版和便携版启动。
- 本机 CLI 0.30.0 冒烟。
- 可用时使用 CLI 0.31.0 验证丰富工具数据。
- 服务启动、关闭和退出确认回归。

## 12. 交付范围

0.4.0 完成标准：

1. 常见工具调用具有明确、可展开的结构化卡片。
2. 审批可以在对应工具附近完成。
3. Shell、文件、Diff 和计划审批具有专用视图。
4. 文件差异可以在右侧面板完整审阅。
5. 未知 payload 可安全降级，不导致页面空白或 IPC 校验失败。
6. CLI 0.30.0 的现有核心功能不回退。
7. 所有新增主要界面使用中文并与现有视觉系统一致。
