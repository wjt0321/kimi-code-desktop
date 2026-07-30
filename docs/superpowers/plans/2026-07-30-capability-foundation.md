# Capability Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保持 Kimi Code CLI 0.30 完整可用的前提下，为桌面端增加服务能力三态检测、兼容模式展示和更准确的后台任务状态。

**Architecture:** Electron 主进程新增生命周期级 `KimiCapabilityService`，通过安全只读请求、版本补充信息和真实业务调用反馈生成能力快照；IPC/Preload 将结构化快照送入 React。后台任务继续使用上游 Transcript 事实，但投影更多任务字段，并在渲染层派生中文展示状态，不修改上游协议。

**Tech Stack:** TypeScript 7、Electron 43、React 19、Zod 4、Vitest 4、Testing Library、Radix UI、Lucide React、electron-vite。

## Global Constraints

- CLI 0.30.0 是最低兼容基线，现有工作区、任务和会话功能不能回退。
- 能力值统一使用 `supported`、`unsupported`、`unknown` 三态。
- 不自动安装、升级或替换用户的系统 CLI。
- 不启用或依赖 kap-server `--debug-endpoints`。
- 不自行实现上游 Agent Markdown 或插件 Agent 目录解析。
- 能力探测不得创建会话、提交 Prompt 或持久化配置变化。
- 未完整实现的副模型、账号和 Agent 功能不得出现操作入口。
- 用户可见的新文案使用中文。
- 所有 IPC 输入输出继续通过共享 Zod Schema 校验。
- 不记录或持久化 OAuth 令牌、API Key、账号资料和完整探测响应。
- 所有代码、提交和发布只发生在 `D:\mydev\kimi-code\desktop` 独立仓库。

---

## File Structure

- Create `src/main/server/capability-service.ts`: 能力状态机、安全探测、版本补充判断、缓存和订阅。
- Create `src/main/server/capability-service.test.ts`: 0.30、0.31、路由不存在、未登录、超时、缓存和重启测试。
- Modify `src/shared/contracts.ts`: 三态能力与能力快照 Schema；后台任务补充字段。
- Modify `src/shared/contracts.test.ts`: 新契约成功/失败样例。
- Modify `src/main/ipc.ts`: `DesktopController` 驱动能力生命周期并暴露能力端口。
- Modify `src/main/ipc.test.ts`: 连接、断开和手动刷新行为。
- Modify `src/main/main.ts`: 构造能力服务、注册 IPC、广播能力变化。
- Modify `src/preload/index.ts`: 解析、获取、刷新和订阅能力快照。
- Modify `src/preload/index.d.ts`: Window API 类型。
- Create `src/renderer/hooks/useDesktopCapabilities.ts`: 渲染层能力状态订阅。
- Create `src/renderer/hooks/useDesktopCapabilities.test.tsx`: 初始读取、推送和刷新测试。
- Modify `src/renderer/App.tsx`: 把能力快照传入工作台。
- Modify `src/renderer/components/workbench/WorkbenchShell.tsx`: 把能力快照传入设置对话框。
- Modify `src/renderer/components/workbench/SettingsDialog.tsx`: 版本与兼容性 UI。
- Create `src/renderer/components/workbench/SettingsDialog.test.tsx`: 0.30 兼容模式与三态文案测试。
- Modify `src/main/server/transcript-projector.ts`: 投影 `detached`、`agentId`、`resultSummary`、`stateReason` 和更新时间。
- Modify `src/main/server/transcript-projector.test.ts`: 新旧 Transcript 任务兼容测试。
- Modify `src/renderer/components/workbench/BackgroundTaskPanel.tsx`: 派生后台任务展示状态。
- Create `src/renderer/components/workbench/background-task-presentation.ts`: 纯函数状态映射和中文文案。
- Create `src/renderer/components/workbench/background-task-presentation.test.ts`: 运行、进展、等待通知、完成、失败、取消和未知状态测试。
- Modify `src/renderer/components/workbench/ContextDock.tsx`: 列表状态使用统一映射。
- Modify `src/renderer/styles.css`: 设置页能力列表与后台任务新增状态样式。
- Modify `package.json`: 版本提升到 `0.5.0`。
- Modify `README.md`: 说明 CLI 0.30 兼容基线和渐进能力检测。

---

### Task 1: Shared Capability and Task Contracts

**Files:**
- Modify: `src/shared/contracts.ts`
- Modify: `src/shared/contracts.test.ts`

**Interfaces:**
- Produces: `DesktopCapabilityState`, `DesktopCapabilityKey`, `DesktopCapabilitySnapshot`, `DesktopCapabilitySnapshotSchema`。
- Produces: `DesktopTask.activityHint?: 'snapshot' | 'waiting_notification'`、`detached`、`agentId`、`resultSummary`、`stateReason`、`updatedAt`。
- Consumes: 现有 `CliDiscoverySchema`、`DesktopTaskSchema`。

- [ ] **Step 1: Write failing schema tests**

```ts
it('accepts a ready capability snapshot for a compatible CLI', () => {
  expect(DesktopCapabilitySnapshotSchema.parse({
    phase: 'ready',
    desktopVersion: '0.5.0',
    cliVersion: '0.30.0',
    serverVersion: '0.30.0',
    checkedAt: '2026-07-30T08:00:00.000Z',
    compatibilityMode: true,
    capabilities: {
      sessionRuntime: 'supported',
      sessionWarnings: 'supported',
      transcript: 'supported',
      config: 'supported',
      secondaryModel: 'unsupported',
      managedUserInfo: 'unsupported',
      promptProfile: 'unsupported',
      nonBlockingTaskOutput: 'unsupported',
    },
  }).phase).toBe('ready');
});

it('accepts optional live task detail without requiring it from CLI 0.30', () => {
  expect(DesktopTaskSchema.parse({
    id: 'task-1',
    title: '检查项目',
    kind: 'subagent',
    state: 'running',
    outputTail: '已读取文件',
    detached: true,
    agentId: 'agent-2',
    activityHint: 'waiting_notification',
    updatedAt: '2026-07-30T08:00:00.000Z',
  }).activityHint).toBe('waiting_notification');
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm vitest run src/shared/contracts.test.ts`

Expected: FAIL because `DesktopCapabilitySnapshotSchema` and the new task fields do not exist.

- [ ] **Step 3: Add minimal shared schemas**

```ts
export const DesktopCapabilityStateSchema = z.enum(['supported', 'unsupported', 'unknown']);
export type DesktopCapabilityState = z.infer<typeof DesktopCapabilityStateSchema>;

export const DesktopCapabilitiesSchema = z.object({
  sessionRuntime: DesktopCapabilityStateSchema,
  sessionWarnings: DesktopCapabilityStateSchema,
  transcript: DesktopCapabilityStateSchema,
  config: DesktopCapabilityStateSchema,
  secondaryModel: DesktopCapabilityStateSchema,
  managedUserInfo: DesktopCapabilityStateSchema,
  promptProfile: DesktopCapabilityStateSchema,
  nonBlockingTaskOutput: DesktopCapabilityStateSchema,
});

export const DesktopCapabilitySnapshotSchema = z.object({
  phase: z.enum(['idle', 'detecting', 'ready']),
  desktopVersion: z.string().min(1),
  cliVersion: z.string().optional(),
  serverVersion: z.string().optional(),
  checkedAt: z.string().optional(),
  compatibilityMode: z.boolean(),
  capabilities: DesktopCapabilitiesSchema,
});
export type DesktopCapabilitySnapshot = z.infer<typeof DesktopCapabilitySnapshotSchema>;
export type DesktopCapabilityKey = keyof DesktopCapabilitySnapshot['capabilities'];
```

Extend `DesktopTaskSchema` with optional fields so old CLI payloads remain valid:

```ts
  detached: z.boolean().optional(),
  agentId: z.string().min(1).optional(),
  resultSummary: z.string().optional(),
  stateReason: z.string().optional(),
  activityHint: z.enum(['snapshot', 'waiting_notification']).optional(),
  updatedAt: z.string().optional(),
```

- [ ] **Step 4: Run tests and verify GREEN**

Run: `pnpm vitest run src/shared/contracts.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/shared/contracts.ts src/shared/contracts.test.ts
git commit -m "feat: add desktop capability contracts"
```

---

### Task 2: Main-Process Capability Service

**Files:**
- Create: `src/main/server/capability-service.ts`
- Create: `src/main/server/capability-service.test.ts`

**Interfaces:**
- Consumes: `ServerRequestPort.request(path, init?)` compatible with `KimiServerLifecycle` and `DesktopCapabilityKey` from the shared contract。
- Produces: `KimiCapabilityService.snapshot(): DesktopCapabilitySnapshot`。
- Produces: `KimiCapabilityService.refresh(cliVersion: string, force?: boolean): Promise<DesktopCapabilitySnapshot>`。
- Produces: `KimiCapabilityService.reset(cliVersion?: string): DesktopCapabilitySnapshot`。
- Produces: `KimiCapabilityService.observe(key: DesktopCapabilityKey, state: DesktopCapabilityState): void`。
- Produces: `KimiCapabilityService.onSnapshot(listener): () => void`。

- [ ] **Step 1: Write failing service tests**

```ts
it('detects a CLI 0.30 service and keeps newer features unavailable', async () => {
  const service = new KimiCapabilityService({
    desktopVersion: '0.5.0',
    request: async (path) => {
      if (path === '/meta') return { server_version: '0.30.0' };
      if (path === '/config') return { providers: {} };
      throw new LocalServiceRequestError('Route not found', 404);
    },
    now: () => new Date('2026-07-30T08:00:00.000Z'),
  });

  const snapshot = await service.refresh('0.30.0');
  expect(snapshot.capabilities.config).toBe('supported');
  expect(snapshot.capabilities.managedUserInfo).toBe('unsupported');
  expect(snapshot.capabilities.secondaryModel).toBe('unsupported');
  expect(snapshot.compatibilityMode).toBe(true);
});

it('treats an unauthenticated userinfo response as route support', async () => {
  const service = new KimiCapabilityService({
    desktopVersion: '0.5.0',
    request: async (path) => {
      if (path === '/meta') return { server_version: '0.31.1' };
      if (path === '/config') return { providers: {}, secondary_model: {} };
      throw new LocalServiceRequestError('请先登录', 401);
    },
  });
  expect((await service.refresh('0.31.1')).capabilities.managedUserInfo).toBe('supported');
});

it('keeps transport failures unknown and caches successful detection', async () => {
  let requests = 0;
  const service = new KimiCapabilityService({
    desktopVersion: '0.5.0',
    request: async () => {
      requests += 1;
      throw new Error('connection reset');
    },
  });
  const first = await service.refresh('0.30.0');
  await service.refresh('0.30.0');
  expect(first.capabilities.config).toBe('unknown');
  expect(requests).toBe(3);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm vitest run src/main/server/capability-service.test.ts`

Expected: FAIL because the service module does not exist.

- [ ] **Step 3: Implement the minimal state machine and probes**

Implement these helpers in `capability-service.ts`:

```ts
export function unknownCapabilities(): DesktopCapabilitySnapshot['capabilities'] {
  return {
    sessionRuntime: 'unknown',
    sessionWarnings: 'unknown',
    transcript: 'unknown',
    config: 'unknown',
    secondaryModel: 'unknown',
    managedUserInfo: 'unknown',
    promptProfile: 'unknown',
    nonBlockingTaskOutput: 'unknown',
  };
}

function routeState(error: unknown): DesktopCapabilityState {
  if (error instanceof LocalServiceRequestError) {
    if (error.status === 404 || error.code === 40401) return 'unsupported';
    if (error.status === 401 || error.status === 403) return 'supported';
  }
  return 'unknown';
}
```

`refresh` performs exactly three read-only requests: `/meta`, `/config`, `/oauth/userinfo`. It marks CLI 0.30 baseline session runtime, warnings and transcript as supported when server major/minor is at least 0.30, and uses at-least-0.31 only as supplemental evidence for `secondaryModel`、`promptProfile` and `nonBlockingTaskOutput`. A successful `/config` is authoritative for `config`; a successful or authentication-rejected `/oauth/userinfo` is authoritative for `managedUserInfo`.

The service must emit `detecting` before requests, `ready` afterwards, cache the ready snapshot, and discard the cache on `reset`.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `pnpm vitest run src/main/server/capability-service.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/main/server/capability-service.ts src/main/server/capability-service.test.ts
git commit -m "feat: detect local service capabilities"
```

---

### Task 3: Lifecycle, IPC, Preload, and Renderer Hook

**Files:**
- Modify: `src/main/ipc.ts`
- Modify: `src/main/ipc.test.ts`
- Modify: `src/main/main.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Create: `src/renderer/hooks/useDesktopCapabilities.ts`
- Create: `src/renderer/hooks/useDesktopCapabilities.test.tsx`

**Interfaces:**
- Consumes: `KimiCapabilityService` from Task 2。
- Produces IPC: `desktop:capabilities`、`desktop:refresh-capabilities`。
- Produces event: `desktop:capabilities-changed`。
- Produces renderer API: `window.desktop.capabilities()`、`refreshCapabilities()`、`onCapabilities()`。
- Produces hook: `useDesktopCapabilities()` returning `{ capabilities, refreshCapabilities }`。

- [ ] **Step 1: Write failing controller and hook tests**

Controller test:

```ts
it('refreshes capabilities when the server connects and resets them when it stops', async () => {
  const capabilityPort = {
    refresh: vi.fn(async () => readyCapabilities),
    reset: vi.fn(() => idleCapabilities),
  };
  const controller = new DesktopController({ discover, validate, lifecycle, feed, capabilities: capabilityPort });
  await controller.refreshCli();
  lifecycle.emit({ kind: 'connected', origin: 'http://127.0.0.1:58627' });
  await vi.waitFor(() => expect(capabilityPort.refresh).toHaveBeenCalledWith('0.30.0'));
  lifecycle.emit({ kind: 'idle' });
  expect(capabilityPort.reset).toHaveBeenCalledWith('0.30.0');
});
```

Hook test:

```tsx
it('loads and subscribes to capability snapshots', async () => {
  window.desktop.capabilities = vi.fn(async () => idleCapabilities);
  window.desktop.onCapabilities = vi.fn((listener) => {
    listener(readyCapabilities);
    return () => undefined;
  });
  const { result } = renderHook(() => useDesktopCapabilities());
  await waitFor(() => expect(result.current.capabilities.phase).toBe('ready'));
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm vitest run src/main/ipc.test.ts src/renderer/hooks/useDesktopCapabilities.test.tsx`

Expected: FAIL because the capability port, preload methods and hook do not exist.

- [ ] **Step 3: Wire capability lifecycle and IPC**

Extend `DesktopControllerOptions`:

```ts
export interface CapabilityServicePort {
  snapshot(): DesktopCapabilitySnapshot;
  refresh(cliVersion: string, force?: boolean): Promise<DesktopCapabilitySnapshot>;
  reset(cliVersion?: string): DesktopCapabilitySnapshot;
  onSnapshot(listener: (snapshot: DesktopCapabilitySnapshot) => void): () => void;
}
```

On lifecycle status:

```ts
if (status.kind === 'connected' && this.#cli.kind === 'ready') {
  void this.options.capabilities.refresh(this.#cli.version);
} else {
  this.options.capabilities.reset(this.#cli.kind === 'ready' ? this.#cli.version : undefined);
}
```

Register main IPC handlers and broadcast `desktop:capabilities-changed`. Parse every preload response through `DesktopCapabilitySnapshotSchema`.

- [ ] **Step 4: Implement the renderer hook**

```ts
const initialCapabilities = DesktopCapabilitySnapshotSchema.parse({
  phase: 'idle',
  desktopVersion: '0.5.0',
  compatibilityMode: false,
  capabilities: Object.fromEntries(capabilityKeys.map((key) => [key, 'unknown'])),
});

export function useDesktopCapabilities() {
  const [capabilities, setCapabilities] = useState(initialCapabilities);
  useEffect(() => {
    let active = true;
    void window.desktop.capabilities().then((value) => active && setCapabilities(value));
    return window.desktop.onCapabilities((value) => active && setCapabilities(value));
  }, []);
  const refreshCapabilities = useCallback(async () => {
    setCapabilities(await window.desktop.refreshCapabilities());
  }, []);
  return { capabilities, refreshCapabilities };
}
```

Use an explicit typed object for the actual initial value if `Object.fromEntries` weakens inference.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `pnpm vitest run src/main/ipc.test.ts src/renderer/hooks/useDesktopCapabilities.test.tsx src/main/server/capability-service.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/main/ipc.ts src/main/ipc.test.ts src/main/main.ts src/preload/index.ts src/preload/index.d.ts src/renderer/hooks/useDesktopCapabilities.ts src/renderer/hooks/useDesktopCapabilities.test.tsx
git commit -m "feat: expose capability snapshots to the renderer"
```

---

### Task 4: Version and Compatibility Settings UI

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/workbench/WorkbenchShell.tsx`
- Modify: `src/renderer/components/workbench/SettingsDialog.tsx`
- Create: `src/renderer/components/workbench/SettingsDialog.test.tsx`
- Modify: `src/renderer/styles.css`

**Interfaces:**
- Consumes: `DesktopCapabilitySnapshot` and `refreshCapabilities()` from Task 3。
- Produces: 中文“版本与兼容性”区域和用户可理解的能力分组。

- [ ] **Step 1: Write failing settings tests**

```tsx
it('presents CLI 0.30 as a compatible mode instead of an error', () => {
  render(<SettingsDialog open status={readyStatus} capabilities={cli030Capabilities} onRefreshCapabilities={vi.fn()} onOpenChange={vi.fn()} />);
  expect(screen.getByText(/已启用兼容模式/)).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText('当前版本未提供')).toBeInTheDocument();
});

it('shows detecting and supported capability states', () => {
  const { rerender } = render(<SettingsDialog open status={readyStatus} capabilities={detectingCapabilities} onRefreshCapabilities={vi.fn()} onOpenChange={vi.fn()} />);
  expect(screen.getByText('正在检测')).toBeInTheDocument();
  rerender(<SettingsDialog open status={readyStatus} capabilities={readyCapabilities} onRefreshCapabilities={vi.fn()} onOpenChange={vi.fn()} />);
  expect(screen.getAllByText('已可用').length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm vitest run src/renderer/components/workbench/SettingsDialog.test.tsx`

Expected: FAIL because the component has no capability props or compatibility UI.

- [ ] **Step 3: Pass capability data through App and WorkbenchShell**

In `App.tsx`:

```ts
const desktopCapabilities = useDesktopCapabilities();
```

Pass `desktopCapabilities.capabilities` and `desktopCapabilities.refreshCapabilities` into `WorkbenchShell`, then into `SettingsDialog`.

- [ ] **Step 4: Implement the settings presentation**

Replace the current environment section title with “版本与兼容性”. Show `capabilities.desktopVersion`, CLI version/command, server version and service state; do not hard-code the desktop version in the renderer. Render four rows:

```ts
const capabilityGroups = [
  { label: '会话运行控制', state: capabilities.capabilities.sessionRuntime },
  { label: '结构化任务过程', state: capabilities.capabilities.transcript },
  { label: '后台任务通知', state: capabilities.capabilities.nonBlockingTaskOutput },
  { label: '新版扩展能力', state: mergeExtensionState(capabilities) },
];
```

State copy:

```ts
supported: '已可用'
unsupported: '当前版本未提供'
unknown: capabilities.phase === 'detecting' ? '正在检测' : '暂未确认'
```

The refresh button is disabled only during `detecting`; compatibility copy uses neutral styling.

- [ ] **Step 5: Add scoped styles**

Add `.compatibility-card`、`.capability-list`、`.capability-state--supported`、`.capability-state--unsupported`、`.capability-state--unknown` without replacing global dialog styles. Keep the dialog usable at narrow and short window sizes.

- [ ] **Step 6: Run tests and verify GREEN**

Run: `pnpm vitest run src/renderer/components/workbench/SettingsDialog.test.tsx src/renderer/App.test.tsx src/renderer/components/workbench/WorkbenchShell.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/renderer/App.tsx src/renderer/components/workbench/WorkbenchShell.tsx src/renderer/components/workbench/SettingsDialog.tsx src/renderer/components/workbench/SettingsDialog.test.tsx src/renderer/styles.css
git commit -m "feat: show CLI compatibility in settings"
```

---

### Task 5: Background Task Projection and Presentation

**Files:**
- Modify: `src/main/server/transcript-projector.ts`
- Modify: `src/main/server/transcript-projector.test.ts`
- Create: `src/renderer/components/workbench/background-task-presentation.ts`
- Create: `src/renderer/components/workbench/background-task-presentation.test.ts`
- Modify: `src/renderer/components/workbench/BackgroundTaskPanel.tsx`
- Modify: `src/renderer/components/workbench/ContextDock.tsx`
- Modify: `src/renderer/styles.css`

**Interfaces:**
- Consumes: optional task fields added in Task 1。
- Produces: `presentBackgroundTask(task): BackgroundTaskPresentation`。

- [ ] **Step 1: Write failing projector and presentation tests**

Projector test:

```ts
it('keeps live task detail while remaining compatible with old snapshots', () => {
  const snapshot = projectTranscript(transcriptWithTask({
    taskId: 'task-1',
    kind: 'subagent',
    state: 'running',
    detached: true,
    agentId: 'agent-2',
    outputTail: '已完成第一步',
    stateReason: 'waiting for completion notification',
    startedAt: '2026-07-30T08:00:00.000Z',
  }), emptyApprovals, emptyQuestions);
  expect(snapshot.tasks[0]).toMatchObject({
    detached: true,
    agentId: 'agent-2',
    activityHint: 'waiting_notification',
  });
});
```

Presentation tests:

```ts
expect(presentBackgroundTask(runningTask).stateLabel).toBe('运行中');
expect(presentBackgroundTask({ ...runningTask, outputTail: '50%' }).stateLabel).toBe('已有进展');
expect(presentBackgroundTask({ ...runningTask, activityHint: 'waiting_notification' }).stateLabel).toBe('等待完成通知');
expect(presentBackgroundTask({ ...runningTask, state: 'completed' }).stateLabel).toBe('已完成');
expect(presentBackgroundTask({ ...runningTask, state: 'failed' }).tone).toBe('failed');
expect(presentBackgroundTask({ ...runningTask, state: 'killed' }).stateLabel).toBe('已取消');
expect(presentBackgroundTask({ ...runningTask, state: 'lost' }).stateLabel).toBe('状态未知');
```

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm vitest run src/main/server/transcript-projector.test.ts src/renderer/components/workbench/background-task-presentation.test.ts`

Expected: FAIL because new fields and presentation helper are absent.

- [ ] **Step 3: Project the additional Transcript facts**

Extend `readTasks`:

```ts
const stateReason = readString(record.stateReason);
const outputTail = readString(record.outputTail) ?? '';
tasks.push({
  id,
  title: readString(record.description) ?? '后台任务',
  kind,
  state,
  outputTail,
  detached: readBoolean(record.detached),
  agentId: readString(record.agentId),
  resultSummary: readString(record.resultSummary),
  error: readString(record.error),
  stateReason,
  activityHint: state === 'running' && /notification|通知/i.test(stateReason ?? '')
    ? 'waiting_notification'
    : state === 'running' && outputTail.trim().length > 0
      ? 'snapshot'
      : undefined,
  startedAt: readString(record.startedAt),
  endedAt: readString(record.endedAt),
  updatedAt: readString(record.endedAt) ?? readString(record.startedAt),
});
```

Absence of these fields must remain valid for old/cold Transcript snapshots.

- [ ] **Step 4: Implement the pure presentation helper**

```ts
export interface BackgroundTaskPresentation {
  kindLabel: string;
  stateLabel: string;
  detail: string;
  tone: 'running' | 'progress' | 'waiting' | 'completed' | 'failed' | 'cancelled' | 'unknown';
  spinning: boolean;
}
```

Mapping rules:

- `completed` → 已完成。
- `failed`/`timed_out` → 失败/已超时。
- `killed` → 已取消。
- `lost` → 状态未知。
- `running + waiting_notification` → 等待完成通知。
- `running + snapshot` or non-empty output → 已有进展。
- otherwise running → 运行中。

`detail` prefers `resultSummary`, then `stateReason`, then a concise state explanation.

- [ ] **Step 5: Use one presentation in both task surfaces**

`BackgroundTaskPanel` and `ContextDock` must call the same helper. The details panel displays `resultSummary` when present and shows “最近更新” using `updatedAt`, falling back to `startedAt`. Only `tone === 'running'` or `tone === 'waiting'` may animate.

- [ ] **Step 6: Add state styles**

Add tones for `progress`、`waiting`、`cancelled`、`unknown`; keep existing completed/failed colors. Animations apply to the active icon only.

- [ ] **Step 7: Run tests and verify GREEN**

Run: `pnpm vitest run src/main/server/transcript-projector.test.ts src/renderer/components/workbench/background-task-presentation.test.ts src/renderer/components/workbench/ContextDock.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add src/main/server/transcript-projector.ts src/main/server/transcript-projector.test.ts src/renderer/components/workbench/background-task-presentation.ts src/renderer/components/workbench/background-task-presentation.test.ts src/renderer/components/workbench/BackgroundTaskPanel.tsx src/renderer/components/workbench/ContextDock.tsx src/renderer/styles.css
git commit -m "feat: clarify background task activity"
```

---

### Task 6: Version, Documentation, and Full Verification

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `README.md`
- Modify tests only if a user-visible version assertion requires it.

**Interfaces:**
- Consumes: all earlier tasks。
- Produces: release-ready desktop version `0.5.0`。

- [ ] **Step 1: Update version and public compatibility copy**

Set `package.json` version to `0.5.0`, regenerate the lockfile through `pnpm install --lockfile-only`, and add README bullets:

```md
- 继续兼容系统安装的 Kimi Code CLI 0.30。
- 根据本地服务实际能力渐进启用新功能，不显示不可用菜单。
- 区分后台任务运行、进展、等待通知、完成、失败和取消状态。
```

Do not claim that secondary model、账号资料 or custom Agent UI is already available.

- [ ] **Step 2: Run focused tests**

Run:

```powershell
pnpm vitest run src/shared/contracts.test.ts src/main/server/capability-service.test.ts src/main/ipc.test.ts src/renderer/hooks/useDesktopCapabilities.test.tsx src/renderer/components/workbench/SettingsDialog.test.tsx src/main/server/transcript-projector.test.ts src/renderer/components/workbench/background-task-presentation.test.ts
```

Expected: all selected tests PASS with no unhandled errors.

- [ ] **Step 3: Run the complete verification suite**

Run:

```powershell
pnpm typecheck
pnpm test
pnpm build:dir
```

Expected:

- TypeScript project references pass.
- All Vitest files pass.
- `release/win-unpacked/Kimi Code Desktop.exe` is produced.

- [ ] **Step 4: Perform Windows smoke checks**

Launch the packaged executable and verify:

1. The executable has the configured Kimi icon.
2. CLI 0.30.0 is detected without an error banner.
3. The local service starts and an existing workspace/session opens.
4. Settings displays “已启用兼容模式”.
5. Existing prompt submission and task timeline still work.
6. Background task detail uses the new Chinese state wording when data is available.
7. Closing the window opens the custom exit dialog.
8. Confirming exit terminates the desktop-owned CLI service.

- [ ] **Step 5: Review repository isolation and staged files**

Run:

```powershell
git status --short
git diff --stat main...HEAD
git remote -v
```

Expected:

- Only desktop files are changed.
- No scratch files, mockup HTML or handoff notes are present.
- `origin` remains `https://github.com/wjt0321/kimi-code-desktop.git`.

- [ ] **Step 6: Commit release preparation**

```powershell
git add package.json pnpm-lock.yaml README.md
git commit -m "chore: prepare 0.5.0 release"
```

- [ ] **Step 7: Final branch review before merge or release**

Run:

```powershell
git status --short --branch
git log --oneline main..HEAD
git diff --check main...HEAD
```

Expected: clean branch, focused commits, no whitespace errors.
