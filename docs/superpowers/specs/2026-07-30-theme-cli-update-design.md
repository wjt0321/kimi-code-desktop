# Kimi Code Desktop 主题与 CLI 更新中心设计

- 日期：2026-07-30
- 目标版本：0.6.0
- 状态：已完成交互方案确认，等待规格复核

## 1. 背景

Kimi Code Desktop 0.5.0 已建立 CLI 与本地服务能力检测层，并继续兼容系统中已安装的 Kimi Code CLI 0.30.x。当前桌面端只有深色视觉方案，同时只能展示本机 CLI 版本，不能主动检查官方更新或安全地帮助用户升级。

本阶段优先解决两个用户可直接感知的问题：

1. 增加浅色、深色、跟随系统三种主题模式，并让 Electron 原生标题栏、窗口背景、菜单、弹窗和 React 工作台保持一致。
2. 增加 CLI 更新中心：每天自动检查一次官方版本，发现新版本后提醒；用户确认后按实际安装来源一键升级，并安全处理桌面端启动的本地服务。

完成后，再在同一设置架构中继续接入模型、账户、用量和服务诊断。

## 2. 设计原则

- Windows 优先，行为必须在 Windows 10/11 x64 上验证。
- CLI 是能力来源，桌面端不打包、不替换上游 CLI。
- 不静默安装更新；安装必须由用户明确确认。
- 不假定所有用户都通过 npm 安装，必须识别实际安装来源。
- 不擅自结束用户自行启动的外部 CLI 服务。
- 主题不是颜色反转，浅色和深色分别使用经过设计的语义色板。
- 主进程管理系统级事实，渲染进程只消费经过校验的 IPC 数据。
- 继续兼容 CLI 0.30.x；新接口缺失不能影响已有工作区和任务功能。
- 对齐上游更新协议和安全边界，但不让桌面仓库依赖上游源码目录。

## 3. 范围

### 3.1 本阶段包含

- 主题偏好：`system`、`light`、`dark`。
- 主题持久化与 Windows 系统主题实时监听。
- Electron 标题栏、窗口背景和 React 界面同步切换。
- 浅色模式完整语义色板。
- 设置中心中的外观入口。
- 命令面板中的主题命令。
- 官方 CLI 版本检查。
- 24 小时检查缓存。
- 安装来源识别。
- 更新提醒、确认、进度、成功和失败状态。
- npm、pnpm、yarn、bun 全局安装的一键升级。
- 无法自动升级时的手动命令与官方安装入口。
- 更新前停止桌面端管理的本地服务，更新后重新检测并按需恢复。
- 更新日志的安全摘要与复制手动命令。

### 3.2 本阶段不包含

- 静默自动安装 CLI 更新。
- 自动更新 Kimi Code Desktop 自身。
- 强制结束用户从外部终端启动的服务。
- 自动回滚到任意历史 CLI 版本。
- 修改 Kimi Code CLI 自己的 `[upgrade]` 配置。
- 完整的模型、账户、用量和 Agent Profile 编辑器；这些进入后续 0.6.0 阶段。
- macOS 和 Linux 的完整实机发布验证；数据结构保留跨平台扩展空间。

## 4. 方案选择

### 4.1 未采用：渲染进程 CSS 切换 + npm Registry

该方案实现最少，但标题栏与内容可能不同步，也无法正确处理 pnpm、yarn、bun 和上游分批发布，因此不采用。

### 4.2 采用：Electron 原生主题 + 上游兼容更新协议

- 主进程以 Electron `nativeTheme` 作为系统主题事实来源。
- 主进程持久化用户偏好并广播实际主题。
- 渲染进程通过 `data-theme` 和语义化 CSS 变量渲染。
- 更新检查读取上游官方 CDN 的 `latest.json`，失败时降级到纯文本 `latest`。
- 安装来源识别和安装命令语义与上游 CLI 保持一致。
- 安装过程由桌面端独立实现并测试，不直接导入上游仓库私有模块。

### 4.3 未采用：完全依赖 CLI 自身启动时更新

该方案无法在桌面端提供稳定的一键升级、进度、错误说明和服务恢复，不满足需求，因此不采用。

## 5. 主题系统

### 5.1 数据模型

```ts
type ThemePreference = 'system' | 'light' | 'dark';
type ResolvedTheme = 'light' | 'dark';

interface DesktopThemeSnapshot {
  preference: ThemePreference;
  resolved: ResolvedTheme;
}
```

所有 IPC 输入和输出通过 Zod 校验。

### 5.2 状态所有权

主进程拥有主题偏好：

- 偏好写入 Electron `userData` 下的桌面端设置文件。
- 不写入 CLI 配置，不写入项目工作区。
- 启动时在创建窗口前读取偏好。
- 将偏好映射到 `nativeTheme.themeSource`。
- 监听 `nativeTheme.updated`，在 `system` 模式下实时更新实际主题。
- 向所有窗口广播快照。

渲染进程：

- 启动时读取主题快照。
- 在 `document.documentElement` 上设置 `data-theme`。
- 监听主进程主题事件。
- 设置页只提交偏好，不自行推断最终系统主题。

### 5.3 启动无闪烁

窗口创建前，主进程根据已保存偏好设置：

- `nativeTheme.themeSource`
- `BrowserWindow.backgroundColor`
- `titleBarOverlay.color`
- `titleBarOverlay.symbolColor`

预加载阶段在 React 挂载前应用实际主题。CSS 默认值使用系统媒体查询作为异常降级，避免异步 IPC 失败时出现纯白或纯黑闪屏。

### 5.4 浅色视觉规范

浅色模式采用“编辑纸张 + 冷灰结构层 + 克制紫色强调”的方向：

- 应用背景：暖灰白，不使用纯白。
- 主画布：接近纸张白，内容区域保持长时间阅读舒适度。
- 导航与侧边栏：冷灰蓝浅层次，与主画布形成轻微分区。
- 主文字：深墨灰，不使用纯黑。
- 次要文字：中性蓝灰。
- 强调色：沿用 Kimi Desktop 的紫色识别，但降低大面积饱和度。
- 成功、警告、错误状态分别提供浅色背景、边框和文字色。
- Diff 增删行在浅色背景下重新配置，保证对比度。
- 输入框使用轻柔阴影和边界，不使用厚重描边。

### 5.5 语义 Token

现有 CSS 颜色逐步收口到语义变量：

```css
--app-bg
--canvas-bg
--sidebar-bg
--surface-1
--surface-2
--surface-hover
--border-subtle
--border-strong
--text-primary
--text-secondary
--text-muted
--accent
--accent-hover
--accent-soft
--success
--warning
--danger
--shadow-window
--shadow-popover
```

组件不得直接通过“把深色值反转”生成浅色值。暂时无法一次迁移的旧变量可映射到新 Token，避免大范围无关重构。

### 5.6 交互入口

设置中心显示三段式外观选择：

- 跟随系统
- 浅色
- 深色

命令面板增加对应命令。切换立即生效，无需重启。

## 6. CLI 更新中心

### 6.1 数据模型

```ts
type CliInstallSource =
  | 'npm-global'
  | 'pnpm-global'
  | 'yarn-global'
  | 'bun-global'
  | 'native'
  | 'unsupported';

type CliUpdatePhase =
  | 'idle'
  | 'checking'
  | 'current'
  | 'available'
  | 'awaiting-confirmation'
  | 'stopping-service'
  | 'installing'
  | 'verifying'
  | 'restarting-service'
  | 'succeeded'
  | 'failed';

interface DesktopCliUpdateSnapshot {
  phase: CliUpdatePhase;
  currentVersion?: string;
  latestVersion?: string;
  checkedAt?: string;
  installSource?: CliInstallSource;
  installCommand?: string;
  canAutoInstall: boolean;
  updateAvailable: boolean;
  error?: string;
  detail?: string;
}
```

安装请求只接受主进程最近一次检查并保存的目标版本，不允许渲染进程任意提交包名、命令或版本字符串。

### 6.2 版本检查

版本来源对齐上游：

1. 请求官方 `latest.json`。
2. 校验 SemVer、发布时间和 rollout 数组。
3. JSON 不可用或格式异常时，降级到官方纯文本 `latest`。
4. 两者都失败时保留旧缓存，并将当前检查标记为失败。

自动检查：

- CLI 发现完成后异步执行。
- 最近一次成功检查不足 24 小时时直接使用缓存。
- 不阻塞工作区和本地服务启动。
- 不因网络失败弹出阻断式错误。

手动检查：

- 用户点击“检查更新”时强制刷新。
- 明确显示检查中和失败原因摘要。

### 6.3 分批发布

自动提醒遵循官方 manifest 的 rollout 信息，使用稳定的本机匿名设备标识计算当前批次。

- 已到发布时间和批次延迟：显示更新。
- 尚未轮到当前批次：维持“已是当前可用版本”。
- 纯文本降级没有 rollout 信息时，视为已完全发布。

设备标识只用于本机稳定分桶，不上传桌面端账户信息。

### 6.4 安装来源识别

检测顺序：

1. 规范化当前 CLI 启动器路径。
2. 解析真实包目录。
3. 检查 pnpm、yarn、bun 的特征目录。
4. 查询 npm 全局 prefix，并验证 `@moonshot-ai/kimi-code` 包目录。
5. 识别原生安装形式。
6. 无法可靠判断时返回 `unsupported`。

Windows 首期自动安装支持：

| 来源 | 命令 | 自动安装 |
| --- | --- | --- |
| npm-global | `npm.cmd install -g @moonshot-ai/kimi-code@<version>` | 是 |
| pnpm-global | `pnpm.cmd add -g @moonshot-ai/kimi-code@<version>` | 是 |
| yarn-global | `yarn.cmd global add @moonshot-ai/kimi-code@<version>` | 是 |
| bun-global | `bun.exe add -g @moonshot-ai/kimi-code@<version>` | 是 |
| native | 官方安装入口 | Windows 首期否 |
| unsupported | 安全手动命令 | 否 |

### 6.5 安全确认

发现更新后，设置中心和全局状态区显示非阻断提醒。点击“一键升级”后打开桌面端自有确认弹窗，展示：

- 当前版本。
- 目标版本。
- 安装来源。
- 将执行的安全命令预览。
- 服务将如何停止和恢复。

只有点击“开始升级”才执行安装。

### 6.6 服务生命周期

更新前记录：

- CLI 服务是否连接。
- 服务是否由桌面端管理。
- 当前工作区与任务选择保留在渲染状态中。

桌面端管理的服务：

1. 停止实时订阅。
2. 正常停止子进程。
3. 等待退出。
4. 执行升级。
5. 使用原 CLI 路径和发现逻辑重新运行 `--version`。
6. 重新执行能力检测。
7. 若更新前服务处于连接状态，则重新启动。
8. 工作区和当前任务重新同步。

外部服务：

- 桌面端不结束外部进程。
- 如果升级可能与外部服务冲突，阻止自动安装并提示用户关闭服务后重试。
- 提供复制手动命令。

### 6.7 安装进程

安装使用可执行文件与参数数组，不拼接 shell 命令：

```ts
spawn('npm.cmd', [
  'install',
  '-g',
  '@moonshot-ai/kimi-code@0.31.0',
]);
```

安全约束：

- 包名固定为 `@moonshot-ai/kimi-code`。
- 目标版本来自校验后的官方版本清单。
- 版本必须是有效 SemVer。
- 不允许渲染进程传入命令。
- 进程输出设置上限，避免无限占用内存。
- 输出展示前过滤 Authorization、Token 和本地服务凭证。
- 安装进程有合理超时，并支持用户取消尚未开始的确认流程；安装开始后不提供可能损坏包管理器状态的强制中止按钮。

### 6.8 验证与失败恢复

安装结束码为零不等于成功。必须再次执行 CLI 验证：

- `kimi --version` 可运行。
- 版本等于目标版本，或高于目标版本。
- CLI 路径重新发现成功。

失败时：

- 显示用户可理解的失败摘要。
- 保留经过脱敏的详细日志。
- 提供复制手动命令。
- 再次检查原 CLI 是否仍可运行。
- 如果 CLI 可运行且更新前服务由桌面端管理，则恢复服务。
- 更新失败不能使工作区、任务列表和设置页不可访问。

## 7. IPC 与安全边界

新增 IPC 只暴露结构化动作：

- `desktop:theme`
- `desktop:set-theme`
- `desktop:check-cli-update`
- `desktop:cli-update`
- `desktop:confirm-cli-update`
- `desktop:copy-cli-update-command`

具体命名在实施时按现有 preload 风格统一。

禁止：

- 渲染进程传入任意可执行文件。
- 渲染进程传入任意参数数组。
- 渲染进程直接访问官方版本 URL。
- 渲染进程读取用户目录下的更新缓存。
- 在 IPC 状态中包含服务 Token 或完整环境变量。

## 8. 设置中心信息架构

第一阶段保留现有设置容器，但调整为可扩展分类结构：

- 外观
- Kimi Code CLI
- 版本与兼容性
- 快捷键
- 关于与开源许可

当模型和账户功能接入时，再扩展：

- 模型
- Kimi 账户
- CLI 与服务诊断

若现有弹窗空间不足，实施计划允许将其升级为更宽的设置工作区，但不在主题功能中重写整个主工作台。

## 9. 用户界面状态

### 9.1 更新提醒

- 无更新：设置页显示“当前已是最新版本”。
- 有更新：状态区出现克制的更新圆点，设置页显示版本差异和升级按钮。
- 检查失败：只在设置页显示，不使用全局红色错误横幅。
- 升级中：更新确认弹窗转为不可关闭的进度视图，避免重复提交。
- 升级完成：显示新版本与服务恢复结果。

### 9.2 可访问性

- 主题选择使用单选语义。
- 所有状态不只依赖颜色，还包含图标和文字。
- 浅色与深色模式保持足够文字对比度。
- 更新确认支持键盘操作，但危险主按钮不自动获得焦点。
- 动效尊重 `prefers-reduced-motion`。

## 10. 测试策略

### 10.1 单元测试

- 主题偏好解析、持久化和无效值恢复。
- `system` 模式下系统主题变化广播。
- Light/Dark 标题栏颜色映射。
- SemVer 比较。
- 官方 manifest 解析和纯文本降级。
- 24 小时缓存策略。
- rollout 批次判断。
- npm/pnpm/yarn/bun 安装来源识别。
- 安装命令生成。
- 外部服务阻止自动更新。
- 安装成功后版本重新验证。
- 安装失败后的服务恢复。
- 敏感输出脱敏。

### 10.2 组件测试

- 三种主题入口和选中状态。
- 系统主题事件驱动界面变化。
- 更新可用、无更新、检查失败和升级中视图。
- 确认弹窗不使用原生 Windows 消息框。
- 一键升级按钮在不支持自动安装时替换为手动方案。

### 10.3 Windows 实机验证

至少验证：

- 深色 Windows + 跟随系统。
- 浅色 Windows + 跟随系统。
- 手动浅色不随系统变化。
- 手动深色不随系统变化。
- 应用重启后偏好保留。
- npm 全局安装的旧版 CLI 检查与升级。
- 服务运行时升级后自动恢复。
- 网络断开时检查失败但应用正常使用。
- 外部服务连接时不被桌面端结束。
- 打包版标题栏、弹窗、菜单和任务时间线在浅色模式下可读。

实机测试一键升级时不使用用户唯一可用的生产 CLI 作为破坏性实验对象；先通过可控测试安装目录和假包管理器验证流程，再在用户明确允许的情况下执行真实升级。

## 11. 发布与兼容

- 版本目标：0.6.0。
- CLI 0.30.x 继续可用。
- 更新检查本身不依赖本地服务启动。
- 主题功能不依赖 CLI 版本。
- 更新功能失败时不影响任务核心功能。
- README 增加主题、更新策略、自动检查和安全说明。
- GitHub Release 提供安装程序、便携包和 SHA-256。

## 12. 验收标准

1. 用户可以在浅色、深色、跟随系统之间切换，无需重启。
2. 跟随系统模式能实时响应 Windows 主题变化。
3. 标题栏、窗口背景、设置、菜单、弹窗、时间线、Diff 和输入区没有明显主题错位。
4. 应用启动时没有可感知的深浅色闪烁。
5. CLI 旧于当前可用版本时，桌面端在自动检查后显示非阻断提醒。
6. 更新绝不静默安装，必须经过用户确认。
7. npm/pnpm/yarn/bun 安装来源可以生成正确的一键升级动作。
8. 无法识别安装来源时，不执行危险命令，只提供手动方案。
9. 桌面端管理的服务在成功或可恢复的失败更新后恢复到原状态。
10. 外部服务不会被桌面端擅自结束。
11. 升级完成后以重新运行 `kimi --version` 的结果作为成功依据。
12. 全量类型检查、测试、Windows 打包和正式包冒烟验证通过。
