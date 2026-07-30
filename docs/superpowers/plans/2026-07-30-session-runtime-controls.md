# Kimi Code Desktop 0.3.0 Task Runtime Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-backed session runtime controls, context management, undo/fork actions, and archived-session recovery to Kimi Code Desktop.

**Architecture:** Extend the shared Zod boundary first, then add typed main-process client and IPC methods. Keep server truth in a focused `useSessionRuntime` hook, while `useWorkbench` coordinates structural session actions. Render runtime controls through reusable Radix-based components and expose the same actions through the workbench menu and command palette.

**Tech Stack:** TypeScript 7, Electron 43, React 19, Zod 4, Radix UI, Vitest, Testing Library, electron-builder.

## Global Constraints

- Work only in `D:\mydev\kimi-code\desktop`; do not modify the upstream repository at `D:\mydev\kimi-code`.
- Use the system-installed Kimi Code CLI and `/api/v1`; do not copy agent execution logic into the desktop app.
- Windows is the primary platform.
- User-facing interface and errors are Chinese wherever practical.
- Server runtime status is the source of truth; never present an optimistic value as confirmed.
- Unsupported old-CLI endpoints degrade per capability and must not disable existing chat functionality.
- Use TDD for every production behavior.
- Target release version is `0.3.0`.

---

### Task 1: Shared runtime contracts and model capabilities

**Files:**
- Modify: `src/shared/contracts.ts`
- Modify: `src/shared/contracts.test.ts`

**Interfaces:**
- Produces: `DesktopPermissionMode`, `DesktopSessionWarning`, `DesktopSessionRuntime`, `UpdateRuntimeRequest`, `CompactSessionRequest`, `UndoSessionRequest`, `ForkSessionRequest`, `RestoreSessionRequest`.
- Extends: `DesktopModel` with `capabilities`, `supportEfforts`, `defaultEffort`, and `adaptiveThinking`.

- [ ] **Step 1: Write failing schema tests**

Add tests that parse a valid runtime payload and reject an invalid permission and out-of-range context usage:

```ts
expect(DesktopSessionRuntimeSchema.parse({
  available: true,
  model: 'kimi-code/k3',
  thinkingLevel: 'high',
  permission: 'manual',
  planMode: false,
  swarmMode: false,
  contextTokens: 12_000,
  maxContextTokens: 128_000,
  contextUsage: 0.09375,
  warnings: [],
})).toMatchObject({ permission: 'manual', thinkingLevel: 'high' });

expect(() => DesktopSessionRuntimeSchema.parse({
  available: true,
  thinkingLevel: 'high',
  permission: 'unsafe',
  planMode: false,
  swarmMode: false,
  contextTokens: 0,
  maxContextTokens: 0,
  contextUsage: 2,
  warnings: [],
})).toThrow();
```

Also verify `UpdateRuntimeRequestSchema` rejects an empty patch and `DesktopModelSchema` accepts `supportEfforts`.

- [ ] **Step 2: Run the contract test and verify RED**

Run: `pnpm vitest run src/shared/contracts.test.ts`

Expected: FAIL because the runtime schemas and extended model properties do not exist.

- [ ] **Step 3: Add the minimal schemas**

Add:

```ts
export const DesktopPermissionModeSchema = z.enum(['manual', 'yolo', 'auto']);
export type DesktopPermissionMode = z.infer<typeof DesktopPermissionModeSchema>;

export const DesktopSessionWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(['info', 'warning', 'error']),
});

export const DesktopSessionRuntimeSchema = z.object({
  available: z.boolean(),
  model: z.string().min(1).optional(),
  thinkingLevel: z.string().min(1),
  permission: DesktopPermissionModeSchema,
  planMode: z.boolean(),
  swarmMode: z.boolean(),
  contextTokens: z.number().int().nonnegative(),
  maxContextTokens: z.number().int().nonnegative(),
  contextUsage: z.number().min(0).max(1),
  warnings: z.array(DesktopSessionWarningSchema),
});

export const UpdateRuntimeRequestSchema = z.object({
  sessionId: SessionIdSchema,
  model: z.string().min(1).max(200).optional(),
  thinkingLevel: z.string().min(1).max(80).optional(),
  permission: DesktopPermissionModeSchema.optional(),
  planMode: z.boolean().optional(),
}).refine(({ model, thinkingLevel, permission, planMode }) =>
  model !== undefined || thinkingLevel !== undefined || permission !== undefined || planMode !== undefined,
  '必须提供至少一项运行策略更新',
);
```

Define the four structural action request schemas with validated `sessionId`, optional trimmed text where specified, and fixed positive undo count.

Extend `DesktopModelSchema`:

```ts
capabilities: z.array(z.string()).optional(),
supportEfforts: z.array(z.string().min(1)).optional(),
defaultEffort: z.string().min(1).optional(),
adaptiveThinking: z.boolean().optional(),
```

- [ ] **Step 4: Run contract tests and verify GREEN**

Run: `pnpm vitest run src/shared/contracts.test.ts`

Expected: all contract tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/shared/contracts.ts src/shared/contracts.test.ts
git commit -m "feat: define session runtime contracts"
```

---

### Task 2: Preserve local-service HTTP error details

**Files:**
- Modify: `src/main/server/server-lifecycle.ts`
- Modify: `src/main/server/server-lifecycle.test.ts`

**Interfaces:**
- Produces: `LocalServiceRequestError` with `status`, `code`, and `details`.
- Consumed by: `KimiDesktopClient` capability fallback in Task 3.

- [ ] **Step 1: Write failing lifecycle tests**

Add a test with a connected fake lifecycle and a mocked 404 response:

```ts
vi.stubGlobal('fetch', vi.fn(async () => ({
  ok: false,
  status: 404,
  json: async () => ({ code: 40401, msg: 'route not found', details: { path: '/sessions/x/status' } }),
})));

await expect(lifecycle.request('/sessions/x/status')).rejects.toMatchObject({
  name: 'LocalServiceRequestError',
  status: 404,
  code: 40401,
  message: 'route not found',
});
```

Add a second test confirming an invalid non-JSON response becomes status-aware instead of losing the HTTP status.

- [ ] **Step 2: Run the lifecycle test and verify RED**

Run: `pnpm vitest run src/main/server/server-lifecycle.test.ts`

Expected: FAIL because the existing code throws a generic error.

- [ ] **Step 3: Implement structured errors**

Add:

```ts
export class LocalServiceRequestError extends Error {
  readonly name = 'LocalServiceRequestError';

  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
    readonly details?: unknown,
  ) {
    super(message);
  }
}
```

In `request`, read JSON once, extract `{ code, msg, details }` when present, and throw `LocalServiceRequestError` for non-OK responses. Preserve the successful response behavior.

- [ ] **Step 4: Run lifecycle tests and verify GREEN**

Run: `pnpm vitest run src/main/server/server-lifecycle.test.ts`

Expected: all lifecycle tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/main/server/server-lifecycle.ts src/main/server/server-lifecycle.test.ts
git commit -m "fix: preserve local service error details"
```

---

### Task 3: Main-process runtime and lifecycle client methods

**Files:**
- Modify: `src/main/server/kimi-client.ts`
- Modify: `src/main/server/kimi-client.test.ts`

**Interfaces:**
- Consumes: contracts from Task 1 and `LocalServiceRequestError` from Task 2.
- Produces:
  - `listArchivedSessions(): Promise<DesktopSession[]>`
  - `getSessionRuntime(sessionId): Promise<DesktopSessionRuntime>`
  - `updateSessionRuntime(input): Promise<DesktopSessionRuntime>`
  - `compactSession(input): Promise<void>`
  - `undoSession(input): Promise<void>`
  - `forkSession(input): Promise<DesktopSession>`
  - `restoreSession(input): Promise<DesktopSession>`

- [ ] **Step 1: Write failing client request/mapping tests**

Cover exact routes and bodies:

```ts
await client.updateSessionRuntime({ sessionId: 's1', permission: 'auto', planMode: true });
expect(request).toHaveBeenNthCalledWith(1, '/sessions/s1/profile', expect.objectContaining({
  method: 'POST',
  body: JSON.stringify({ agent_config: { permission_mode: 'auto', plan_mode: true } }),
}));
expect(request).toHaveBeenNthCalledWith(2, '/sessions/s1/status');
```

Cover status/warning mapping, archived list query, compact instruction, undo count, fork title, restore route, and extended model metadata.

Add capability fallback test:

```ts
request.mockRejectedValueOnce(new LocalServiceRequestError('route not found', 404));
await expect(client.getSessionRuntime('s1')).resolves.toMatchObject({ available: false });
```

Verify a 500 error still rejects.

- [ ] **Step 2: Run client tests and verify RED**

Run: `pnpm vitest run src/main/server/kimi-client.test.ts`

Expected: FAIL because the new methods and mappings do not exist.

- [ ] **Step 3: Implement wire mappings and methods**

Use `/sessions?page_size=80&archived_only=true`, `/sessions/{id}/status`, `/warnings`, `/profile`, and colon action routes exactly as the server contract defines.

Map unsupported status to:

```ts
{
  available: false,
  thinkingLevel: 'off',
  permission: 'manual',
  planMode: false,
  swarmMode: false,
  contextTokens: 0,
  maxContextTokens: 0,
  contextUsage: 0,
  warnings: [],
}
```

Only classify `LocalServiceRequestError` status 404 or 405 as unsupported. For runtime updates, throw a Chinese capability error instead of returning false.

Extend `toDesktopModel` using snake-case fields:

```ts
capabilities: readStringArray(record?.capabilities),
supportEfforts: readStringArray(record?.support_efforts),
defaultEffort: readString(record?.default_effort),
adaptiveThinking: readBoolean(record?.adaptive_thinking),
```

- [ ] **Step 4: Run client tests and verify GREEN**

Run: `pnpm vitest run src/main/server/kimi-client.test.ts`

Expected: all client tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/main/server/kimi-client.ts src/main/server/kimi-client.test.ts
git commit -m "feat: add session runtime client actions"
```

---

### Task 4: IPC and preload boundary

**Files:**
- Modify: `src/main/main.ts`
- Modify: `src/main/ipc.test.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`

**Interfaces:**
- Consumes: Task 1 request types and Task 3 client methods.
- Produces renderer API methods with the same semantic names.

- [ ] **Step 1: Write failing IPC validation tests**

Test that invalid runtime patches never reach the client and valid requests are forwarded. Cover all new channel names:

```ts
'desktop:list-archived-sessions'
'desktop:get-session-runtime'
'desktop:update-session-runtime'
'desktop:compact-session'
'desktop:undo-session'
'desktop:fork-session'
'desktop:restore-session'
```

- [ ] **Step 2: Run IPC tests and verify RED**

Run: `pnpm vitest run src/main/ipc.test.ts`

Expected: FAIL because handlers are missing.

- [ ] **Step 3: Register validated handlers and preload methods**

Add handlers that parse only shared schemas before invoking `KimiDesktopClient`. Extend `DesktopApi`:

```ts
listArchivedSessions(): Promise<DesktopSession[]>;
getSessionRuntime(sessionId: string): Promise<DesktopSessionRuntime>;
updateSessionRuntime(input: UpdateRuntimeRequest): Promise<DesktopSessionRuntime>;
compactSession(input: CompactSessionRequest): Promise<void>;
undoSession(input: UndoSessionRequest): Promise<void>;
forkSession(input: ForkSessionRequest): Promise<DesktopSession>;
restoreSession(input: RestoreSessionRequest): Promise<DesktopSession>;
```

Every preload response must parse through the shared response schema before returning to React.

- [ ] **Step 4: Run IPC and type tests and verify GREEN**

Run: `pnpm vitest run src/main/ipc.test.ts && pnpm typecheck`

Expected: IPC tests and TypeScript checks pass.

- [ ] **Step 5: Commit**

```powershell
git add src/main/main.ts src/main/ipc.test.ts src/preload/index.ts src/preload/index.d.ts
git commit -m "feat: expose runtime controls to renderer"
```

---

### Task 5: Session runtime state hook

**Files:**
- Create: `src/renderer/hooks/useSessionRuntime.ts`
- Create: `src/renderer/hooks/useSessionRuntime.test.tsx`
- Modify: `src/renderer/hooks/useWorkbench.ts`
- Modify: `src/renderer/hooks/useWorkbench.test.tsx`

**Interfaces:**
- Produces:

```ts
interface SessionRuntimeController {
  runtime?: DesktopSessionRuntime;
  loading: boolean;
  updating: boolean;
  refresh(): Promise<void>;
  update(patch: Omit<UpdateRuntimeRequest, 'sessionId'>): Promise<void>;
}
```

- Extends `useWorkbench` with archived sessions and structural actions.

- [ ] **Step 1: Write failing hook tests**

`useSessionRuntime.test.tsx` must cover:

- session selection loads runtime;
- old session response cannot overwrite a newly selected session;
- update calls the API and then stores the server-confirmed response;
- task event refreshes are debounced/coalesced;
- unsupported runtime remains available to chat but disables controls.

`useWorkbench.test.tsx` must cover:

- undo captures the latest user timeline text, calls `undoSession({ count: 1 })`, refreshes, and exposes a composer draft;
- fork refreshes overview and selects the returned session;
- archived list loads on demand;
- restore removes the item from archived state and selects it;
- busy sessions reject compact/undo/fork before IPC.

- [ ] **Step 2: Run hook tests and verify RED**

Run: `pnpm vitest run src/renderer/hooks/useSessionRuntime.test.tsx src/renderer/hooks/useWorkbench.test.tsx`

Expected: FAIL because the runtime hook and actions do not exist.

- [ ] **Step 3: Implement runtime hook and workbench actions**

Use a monotonically increasing request revision and compare `sessionIdRef` before committing state. Serialize update promises with a ref-backed chain:

```ts
updateQueue.current = updateQueue.current.then(async () => {
  const confirmed = await window.desktop.updateSessionRuntime({ sessionId, ...patch });
  if (sessionIdRef.current === sessionId) setRuntime(confirmed);
});
```

Expose from `useWorkbench`:

```ts
archivedSessions,
archivedLoading,
loadArchivedSessions,
runtime,
runtimeLoading,
runtimeUpdating,
refreshRuntime,
updateRuntime,
composerDraft,
clearComposerDraft,
compactTask,
undoTask,
forkTask,
restoreTask,
```

Use the most recent completed user `text` timeline entry as the undo draft. Structural actions check `selectedSession.busy` and set a Chinese error without calling IPC.

- [ ] **Step 4: Run hook tests and verify GREEN**

Run: `pnpm vitest run src/renderer/hooks/useSessionRuntime.test.tsx src/renderer/hooks/useWorkbench.test.tsx`

Expected: all hook tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/renderer/hooks/useSessionRuntime.ts src/renderer/hooks/useSessionRuntime.test.tsx src/renderer/hooks/useWorkbench.ts src/renderer/hooks/useWorkbench.test.tsx
git commit -m "feat: manage live session runtime state"
```

---

### Task 6: Runtime controls in the composer and header

**Files:**
- Create: `src/renderer/components/workbench/RuntimeControls.tsx`
- Create: `src/renderer/components/workbench/RuntimeControls.test.tsx`
- Modify: `src/renderer/components/workbench/TaskComposer.tsx`
- Modify: `src/renderer/components/workbench/TaskComposer.test.tsx`
- Modify: `src/renderer/components/workbench/WorkbenchShell.tsx`
- Modify: `src/renderer/components/workbench/WorkbenchShell.test.tsx`
- Modify: `src/renderer/styles.css`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `DesktopSessionRuntime`, current `DesktopModel`, and runtime actions.
- Produces: compact Radix controls and confirmed-state status badges.

- [ ] **Step 1: Add Radix dependencies and write failing component tests**

Install:

```powershell
$env:HTTPS_PROXY='http://127.0.0.1:10808'
$env:HTTP_PROXY='http://127.0.0.1:10808'
pnpm add @radix-ui/react-dropdown-menu @radix-ui/react-switch
```

Tests must verify:

- thinking options come from selected model `supportEfforts`;
- a model without efforts offers `off` and `on`;
- permission labels and descriptions are Chinese;
- plan switch sends the opposite confirmed value;
- unavailable runtime disables controls with an explanatory title;
- updating state shows progress and does not claim the pending value is active;
- external composer draft populates and focuses the textarea.

- [ ] **Step 2: Run component tests and verify RED**

Run: `pnpm vitest run src/renderer/components/workbench/RuntimeControls.test.tsx src/renderer/components/workbench/TaskComposer.test.tsx src/renderer/components/workbench/WorkbenchShell.test.tsx`

Expected: FAIL because runtime controls and draft props are missing.

- [ ] **Step 3: Implement reusable controls and integrate them**

`RuntimeControls` props:

```ts
interface RuntimeControlsProps {
  runtime: DesktopSessionRuntime | undefined;
  model: DesktopModel | undefined;
  disabled: boolean;
  updating: boolean;
  onChange(patch: Omit<UpdateRuntimeRequest, 'sessionId'>): void;
}
```

Use DropdownMenu for thinking and permission, Switch for plan mode, and reuse the model-menu visual tokens. Add `draft` and `onDraftConsumed` props to `TaskComposer`; apply a new draft only when its revision changes.

Header badges render only confirmed runtime values and context percentage. When `runtime.available === false`, display “当前 CLI 不支持运行策略控制” without hiding the task.

- [ ] **Step 4: Run component tests and verify GREEN**

Run: `pnpm vitest run src/renderer/components/workbench/RuntimeControls.test.tsx src/renderer/components/workbench/TaskComposer.test.tsx src/renderer/components/workbench/WorkbenchShell.test.tsx`

Expected: all selected component tests pass.

- [ ] **Step 5: Commit**

```powershell
git add package.json pnpm-lock.yaml src/renderer/components/workbench/RuntimeControls.tsx src/renderer/components/workbench/RuntimeControls.test.tsx src/renderer/components/workbench/TaskComposer.tsx src/renderer/components/workbench/TaskComposer.test.tsx src/renderer/components/workbench/WorkbenchShell.tsx src/renderer/components/workbench/WorkbenchShell.test.tsx src/renderer/styles.css
git commit -m "feat: add task runtime controls"
```

---

### Task 7: Session action menus, dialogs, and archive manager

**Files:**
- Create: `src/renderer/components/workbench/SessionActionsMenu.tsx`
- Create: `src/renderer/components/workbench/SessionActionsMenu.test.tsx`
- Create: `src/renderer/components/workbench/SessionActionDialogs.tsx`
- Create: `src/renderer/components/workbench/ArchivedSessionsDialog.tsx`
- Create: `src/renderer/components/workbench/ArchivedSessionsDialog.test.tsx`
- Modify: `src/renderer/components/workbench/WorkbenchShell.tsx`
- Modify: `src/renderer/styles.css`

**Interfaces:**
- Consumes: structural actions from `useWorkbench`.
- Produces: unified session menu, compact/fork/undo confirmations, and archived recovery UI.

- [ ] **Step 1: Write failing interaction tests**

Cover:

- menu items appear with Chinese names;
- busy task disables undo, compact, and fork and displays “任务运行时不可用”;
- undo confirmation invokes `onUndo`;
- compact trims an optional instruction and invokes `onCompact`;
- fork trims an optional title and invokes `onFork`;
- archive manager loads only when opened;
- restore invokes `onRestore(session.id)` and closes after success.

- [ ] **Step 2: Run action component tests and verify RED**

Run: `pnpm vitest run src/renderer/components/workbench/SessionActionsMenu.test.tsx src/renderer/components/workbench/ArchivedSessionsDialog.test.tsx`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement menus and dialogs**

Use Radix DropdownMenu and Dialog with the existing dark overlay and button system. Keep dialog state in `WorkbenchShell`; business actions stay in hooks. Add an archive-history button beside the task-list heading.

The session action callbacks must have these signatures:

```ts
onUndo(): Promise<boolean>;
onCompact(instruction?: string): Promise<boolean>;
onFork(title?: string): Promise<boolean>;
onRename(sessionId: string, title: string): Promise<void>;
onArchive(sessionId: string): Promise<void>;
onRestore(sessionId: string): Promise<boolean>;
```

- [ ] **Step 4: Run action component tests and verify GREEN**

Run: `pnpm vitest run src/renderer/components/workbench/SessionActionsMenu.test.tsx src/renderer/components/workbench/ArchivedSessionsDialog.test.tsx src/renderer/components/workbench/WorkbenchShell.test.tsx`

Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/renderer/components/workbench/SessionActionsMenu.tsx src/renderer/components/workbench/SessionActionsMenu.test.tsx src/renderer/components/workbench/SessionActionDialogs.tsx src/renderer/components/workbench/ArchivedSessionsDialog.tsx src/renderer/components/workbench/ArchivedSessionsDialog.test.tsx src/renderer/components/workbench/WorkbenchShell.tsx src/renderer/styles.css
git commit -m "feat: add session lifecycle actions"
```

---

### Task 8: Runtime detail panel and command palette actions

**Files:**
- Modify: `src/renderer/components/workbench/ContextDock.tsx`
- Modify: `src/renderer/components/workbench/ContextDock.test.tsx`
- Modify: `src/renderer/components/CommandPalette.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/App.test.tsx`
- Modify: `src/renderer/styles.css`

**Interfaces:**
- Consumes: runtime state and the same action callbacks already used by visible controls.
- Produces: runtime status section and command-palette parity.

- [ ] **Step 1: Write failing detail and command tests**

Verify ContextDock renders:

```text
上下文 12,000 / 128,000
思考强度 高
权限 完全自动
计划模式 已开启
```

Verify warnings use severity-specific accessible labels and refresh calls `onRefreshRuntime`.

Verify command palette commands invoke the same callbacks for runtime refresh, plan toggle, undo, compact-dialog opening, fork-dialog opening, and archived-session opening.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm vitest run src/renderer/components/workbench/ContextDock.test.tsx src/renderer/App.test.tsx`

Expected: FAIL because runtime detail props and commands are missing.

- [ ] **Step 3: Implement detail and command parity**

Add a `runtime` section below pending interactions and before background tasks. Use `Intl.NumberFormat('zh-CN')` for token counts and a clamped progress bar.

Extend `CommandPalette` with explicit action descriptors supplied by `App`; do not import workbench state into the palette. `App` passes the hook actions to both `WorkbenchShell` and `CommandPalette`.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `pnpm vitest run src/renderer/components/workbench/ContextDock.test.tsx src/renderer/App.test.tsx`

Expected: selected tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/renderer/components/workbench/ContextDock.tsx src/renderer/components/workbench/ContextDock.test.tsx src/renderer/components/CommandPalette.tsx src/renderer/App.tsx src/renderer/App.test.tsx src/renderer/styles.css
git commit -m "feat: surface runtime status and commands"
```

---

### Task 9: Version, documentation, full verification, and release artifacts

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `README.md`
- Modify: `electron-builder.yml` only if packaging verification exposes an issue.

**Interfaces:**
- Produces: Kimi Code Desktop `0.3.0` release artifacts.

- [ ] **Step 1: Update version and user documentation**

Set package version to `0.3.0`. Document runtime controls, task menu actions, archived recovery, compatibility behavior, and shortcuts in Chinese.

- [ ] **Step 2: Run complete static and automated verification**

Run:

```powershell
pnpm typecheck
pnpm test
git diff --check
```

Expected: TypeScript passes and all tests pass with zero failures.

- [ ] **Step 3: Build Windows artifacts**

Run:

```powershell
pnpm build
```

Expected outputs:

```text
release/0.3.0/win-unpacked/Kimi Code Desktop.exe
release/0.3.0/Kimi Code Desktop-0.3.0-setup.exe
```

Extract the associated EXE icon and verify it matches `build/kimi-code.ico` at 32×32.

- [ ] **Step 4: Run packaged and local-CLI smoke tests**

Verify:

- service starts and detects the installed CLI;
- runtime status loads;
- permission, thinking, and plan updates return confirmed values;
- compact, undo, and fork complete on an idle test task;
- archived session restores;
- closing the app shows the custom dialog and shuts down the owned CLI service.

- [ ] **Step 5: Create release payloads and commit final metadata**

Create the portable ZIP and `SHA256SUMS.txt`, then commit README/version changes:

```powershell
git add package.json pnpm-lock.yaml README.md
git commit -m "chore: prepare 0.3.0 release"
```

- [ ] **Step 6: Finish branch**

Run the finishing workflow: verify branch diff, merge fast-forward into `main`, push only the independent desktop repository, wait for CI, and create GitHub release `v0.3.0` with installer, portable ZIP, and checksums.
