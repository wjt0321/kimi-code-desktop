# Codex 式工作区分组侧栏与稳定性修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将桌面端左侧导航重构为 Codex 式“工作区分组 + 组内任务”结构，同时修复工作区切换、新建任务、归档读取和浅色主题问题，并产出经过 Windows 验证的新版本。

**Architecture:** 保持 Electron 主进程作为唯一文件系统与 CLI REST 边界，在共享契约和 preload 中增加分页、工作区变更及安全目录创建接口。渲染层把工作区导航状态集中到 `useWorkbench`，使用原子选择、合并刷新和请求版本门控避免旧请求覆盖用户操作；侧栏拆成独立的工作区分组组件，所有新增表面统一使用语义主题变量。

**Tech Stack:** Electron 43、React 19、TypeScript 7、Vitest、Testing Library、Zod、Radix UI、Lucide React、electron-builder、Windows PowerShell。

## Global Constraints

- Windows 优先，桌面端只识别和调用系统已安装的 Kimi Code CLI，不捆绑或修改 CLI。
- 保持 Kimi Code CLI 0.30.x 的核心工作区、任务、对话、归档和恢复能力；0.31+ 工作区重命名/清除能力按版本和接口结果降级。
- 工作区“清除”只注销桌面/服务中的工作区，不删除、移动或改写本地目录。
- 归档任务只支持查看、搜索、恢复与重试；不增加删除、隐藏或直接操作 Session 文件的能力。
- 新建目录、选择目录和资源管理器操作只允许在 Electron 主进程执行并校验输入。
- 用户导航优先于后台刷新，旧请求不得覆盖更晚的工作区/任务选择。
- 新增用户可读文字使用中文；不新增 7px 或 8px 正文字号。
- 浅色、深色和跟随系统模式必须覆盖侧栏、菜单、新建任务、归档和确认弹窗。
- 桌面代码只提交到独立仓库 `D:\mydev\kimi-code\desktop`，不得修改或推送上游 `MoonshotAI/kimi-code`。
- 完成打包后只清理 `D:\mydev\kimi-code\desktop\release` 的本地旧分发产物，保留最新两个语义版本；不删除 GitHub Release、标签、分支或源码。

---

## File Structure

- `src/shared/contracts.ts`：分页会话、工作区重命名/清除、安全创建目录的跨进程 Zod 契约。
- `src/main/server/kimi-client.ts`：Kimi Server REST 适配，负责分页、工作区 PATCH/DELETE 和 0.30 降级错误。
- `src/main/workspace/workspace-folder.ts`：Windows 工作区名称校验及父目录下安全创建逻辑。
- `src/main/main.ts`：文件夹选择、创建目录、工作区变更 IPC 注册。
- `src/preload/index.ts`、`src/preload/index.d.ts`：类型安全的渲染层桥接 API。
- `src/renderer/hooks/workbench-navigation.ts`：纯函数形式的工作区/任务原子选择与会话分组规则。
- `src/renderer/hooks/refresh-coordinator.ts`：合并高频刷新并丢弃过期结果的协调器。
- `src/renderer/hooks/useWorkbench.ts`：服务数据、分页、折叠持久化、工作区操作和归档状态的单一状态入口。
- `src/renderer/components/workbench/WorkspaceSidebar.tsx`：Codex 式侧栏布局和全局操作。
- `src/renderer/components/workbench/WorkspaceGroup.tsx`：单个工作区分组、组内任务、更多加载和操作菜单。
- `src/renderer/components/workbench/WorkspaceDialogs.tsx`：添加、创建、重命名、清除工作区弹窗。
- `src/renderer/components/workbench/NewTaskDialog.tsx`：稳定初始化、工作区选择与提交状态。
- `src/renderer/components/workbench/ArchivedSessionsDialog.tsx`：单次加载、搜索、重试和恢复状态。
- `src/renderer/components/workbench/WorkbenchShell.tsx`：组合新侧栏与现有主工作台，移除原生工作区下拉框。
- `src/renderer/App.tsx`：传递稳定 action 引用，避免弹窗 effect 因包装函数重复触发。
- `src/renderer/styles.css`：语义主题变量、字号层级和新增组件视觉样式。
- `package.json`、`pnpm-lock.yaml`：版本提升到 `0.7.0`（若不引入新依赖则锁文件仅更新根版本）。

---

### Task 1: 建立分页与工作区管理契约

**Files:**
- Modify: `src/shared/contracts.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Modify: `src/main/server/kimi-client.ts`
- Test: `src/main/server/kimi-client.test.ts`
- Test: `src/main/ipc.test.ts`

**Interfaces:**
- Produces: `ListSessionsRequest`, `DesktopSessionPage`, `RenameWorkspaceRequest`, `RemoveWorkspaceRequest`。
- Produces: `KimiDesktopClient.listSessionPage(input)`, `renameWorkspace(input)`, `removeWorkspace(input)`。
- Preserves: existing `listSessions()` and archive/session behavior for current callers until Task 4 migrates them。

- [ ] **Step 1: Write failing REST adapter tests**

Add tests asserting:

```ts
await client.listSessionPage({ workspaceId: 'w 1', pageSize: 20, beforeId: 's/20' });
expect(fetcher.path).toBe('/sessions?page_size=20&include_archive=false&workspace_id=w%201&before_id=s%2F20');
```

Also assert `{ items, hasMore }` parsing, `PATCH /workspaces/:id` for display-name rename, and `DELETE /workspaces/:id` for unregistering without any filesystem call.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm vitest run src/main/server/kimi-client.test.ts src/main/ipc.test.ts`

Expected: FAIL because the new schemas and client methods do not exist.

- [ ] **Step 3: Implement schemas and client methods**

Use optional fields directly rather than conditional object spreads. Encode every path/query value with `encodeURIComponent`. Parse both snake_case server responses and desktop camelCase output through Zod transformations. Convert 404/405 responses for workspace mutation into a Chinese “当前 CLI 暂不支持” error; do not emulate deletion by touching files.

- [ ] **Step 4: Extend preload bridge and declarations**

Expose:

```ts
listSessionPage(input: ListSessionsRequest): Promise<DesktopSessionPage>;
renameWorkspace(input: RenameWorkspaceRequest): Promise<DesktopWorkspace>;
removeWorkspace(input: RemoveWorkspaceRequest): Promise<void>;
```

Validate all inbound and outbound values with the shared schemas.

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm vitest run src/main/server/kimi-client.test.ts src/main/ipc.test.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/shared/contracts.ts src/preload/index.ts src/preload/index.d.ts src/main/server/kimi-client.ts src/main/server/kimi-client.test.ts src/main/ipc.test.ts
git commit -m "feat: add paged workspace session APIs"
```

---

### Task 2: 安全创建与管理本地工作区目录

**Files:**
- Create: `src/main/workspace/workspace-folder.ts`
- Create: `src/main/workspace/workspace-folder.test.ts`
- Modify: `src/main/main.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Modify: `src/shared/contracts.ts`
- Test: `src/main/ipc.test.ts`

**Interfaces:**
- Produces: `CreateWorkspaceFolderRequest { name: string }`。
- Produces: `validateWorkspaceFolderName(name): string` and `createWorkspaceFolder(parent, name): Promise<string>`。
- Produces: `window.desktop.createWorkspaceFolder({ name })`, which opens a parent-folder chooser in main, creates exactly one child directory, registers it, and returns the workspace.

- [ ] **Step 1: Write failing validation tests**

Cover blank names, Windows reserved names (`CON`, `NUL`, `COM1`), trailing dot/space, path separators, `.`/`..`, existing target, and valid Chinese/ASCII names.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm vitest run src/main/workspace/workspace-folder.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement pure validation and safe creation**

Resolve the parent and child paths; require the child parent to equal the selected parent after `path.resolve`; use `mkdir` without recursive overwrite; return the resolved absolute child path.

- [ ] **Step 4: Register main IPC flow**

The renderer supplies only the folder name. Main opens `dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })`, creates the child, then calls `client.createWorkspace(root)`. Cancellation returns `undefined`; validation and filesystem errors return Chinese messages.

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm vitest run src/main/workspace/workspace-folder.test.ts src/main/ipc.test.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/main/workspace src/main/main.ts src/preload/index.ts src/preload/index.d.ts src/shared/contracts.ts src/main/ipc.test.ts
git commit -m "feat: add safe workspace folder creation"
```

---

### Task 3: 实现原子导航与刷新协调器

**Files:**
- Create: `src/renderer/hooks/workbench-navigation.ts`
- Create: `src/renderer/hooks/workbench-navigation.test.ts`
- Create: `src/renderer/hooks/refresh-coordinator.ts`
- Create: `src/renderer/hooks/refresh-coordinator.test.ts`
- Modify: `src/renderer/hooks/useWorkbench.ts`
- Modify: `src/renderer/hooks/useWorkbench.test.tsx`

**Interfaces:**
- Produces: `resolveNavigationState(input): { workspaceId?: string; sessionId?: string }`。
- Produces: `groupSessionsByWorkspace(workspaces, sessions)` and `mergeSessionPage(current, page)`。
- Produces: `createRefreshCoordinator(load, apply)` with `request()` and `dispose()`; concurrent events coalesce and only the newest completed revision may apply.
- Produces: `selectWorkspace(workspaceId, preferredSessionId?)` and `selectTask(sessionId)` that always update workspace/session together.

- [ ] **Step 1: Write failing pure navigation tests**

Cover selected session/workspace mismatch, missing session after archive, restored session in another workspace, empty workspace, duplicate page items, and explicit user navigation winning over a pending refresh.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm vitest run src/renderer/hooks/workbench-navigation.test.ts src/renderer/hooks/refresh-coordinator.test.ts`

Expected: FAIL because helpers do not exist.

- [ ] **Step 3: Implement minimal pure helpers and coordinator**

Keep helpers framework-free. The coordinator allows one in-flight request plus one queued rerun, assigns monotonic revisions, and skips `apply` after dispose or when a newer request/navigation revision exists.

- [ ] **Step 4: Add failing hook race tests**

Use deferred promises to prove:
- a slow first refresh cannot overwrite a faster later refresh;
- repeated task events produce at most one in-flight and one queued overview refresh;
- selecting task B immediately sets workspace B;
- refresh keeps a valid explicit user selection;
- restoring an archived task opens its workspace.

- [ ] **Step 5: Refactor `useWorkbench`**

Replace independent `setSelectedWorkspaceId`/`setSelectedSessionId` fallbacks with atomic navigation. Debounce event-driven overview refreshes briefly and route them through the coordinator. Persist the selected workspace ID in local storage only after it is valid.

- [ ] **Step 6: Run hook tests and typecheck**

Run: `pnpm vitest run src/renderer/hooks/*.test.ts src/renderer/hooks/*.test.tsx && pnpm typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/renderer/hooks
git commit -m "fix: make workspace navigation race safe"
```

---

### Task 4: 增加工作区分组分页状态

**Files:**
- Modify: `src/renderer/hooks/useWorkbench.ts`
- Modify: `src/renderer/hooks/useWorkbench.test.tsx`
- Modify: `src/renderer/App.tsx`

**Interfaces:**
- Produces: `workspaceGroups[]` containing `workspace`, `sessions`, `collapsed`, `loading`, `hasMore`, `error`。
- Produces actions: `toggleWorkspace`, `loadMoreWorkspaceSessions`, `addWorkspace`, `createWorkspaceFolder`, `renameWorkspace`, `removeWorkspace`。
- Stores collapsed workspace IDs in local storage under one versioned desktop UI key.

- [ ] **Step 1: Write failing group-state tests**

Assert initial sessions are grouped, collapse survives hook remount, expanding an unloaded workspace fetches `page_size=20`, “显示更多” appends without duplicates, and one group’s loading/error does not block others.

- [ ] **Step 2: Run test and verify RED**

Run: `pnpm vitest run src/renderer/hooks/useWorkbench.test.tsx`

Expected: FAIL because grouped state/actions do not exist.

- [ ] **Step 3: Implement grouped session state**

Use recent overview sessions as seed data. Fetch workspace-specific pages lazily and retain per-workspace cursors/`hasMore`. After rename, update the group without reselecting. After remove, select the nearest remaining workspace but never call filesystem APIs.

- [ ] **Step 4: Replace unstable App wrapper callbacks**

Pass stable hook actions directly wherever signatures already match. For adapted signatures, memoize with `useCallback`; specifically ensure the archive load callback identity does not change every render.

- [ ] **Step 5: Run hook and App tests**

Run: `pnpm vitest run src/renderer/hooks/useWorkbench.test.tsx src/renderer/App.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/renderer/hooks/useWorkbench.ts src/renderer/hooks/useWorkbench.test.tsx src/renderer/App.tsx src/renderer/App.test.tsx
git commit -m "feat: group task state by workspace"
```

---

### Task 5: 构建 Codex 式工作区分组侧栏

**Files:**
- Create: `src/renderer/components/workbench/WorkspaceGroup.tsx`
- Create: `src/renderer/components/workbench/WorkspaceGroup.test.tsx`
- Create: `src/renderer/components/workbench/WorkspaceSidebar.tsx`
- Create: `src/renderer/components/workbench/WorkspaceSidebar.test.tsx`
- Modify: `src/renderer/components/workbench/WorkbenchShell.tsx`
- Modify: `src/renderer/components/workbench/WorkbenchShell.test.tsx`

**Interfaces:**
- Consumes: `workspaceGroups` and actions from Task 4.
- Produces: one vertical project list where each workspace owns its nested tasks; no native `<select>` remains.
- Workspace menu commands: “在资源管理器中打开”“重命名显示名称”“从列表清除”。

- [ ] **Step 1: Write failing component tests**

Assert:
- all workspace names render in a single side column;
- tasks render beneath their workspace;
- collapse hides only that group’s task list;
- current session has `aria-current="page"`;
- group `+` opens new task with the correct workspace;
- load-more and retry call the correct workspace ID;
- no element with `id="workspace-select"` or a workspace native select exists;
- keyboard and menu actions are reachable by accessible names.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm vitest run src/renderer/components/workbench/WorkspaceGroup.test.tsx src/renderer/components/workbench/WorkspaceSidebar.test.tsx src/renderer/components/workbench/WorkbenchShell.test.tsx`

Expected: FAIL because new components do not exist and old select remains.

- [ ] **Step 3: Implement `WorkspaceGroup`**

Use a 32px minimum group header, chevron toggle, task count, plus button, Radix dropdown menu, nested task rows, inline loading/error/retry and “显示更多”. Avoid height animation for long lists.

- [ ] **Step 4: Implement `WorkspaceSidebar` and integrate shell**

Order: brand, global new task/archive actions, “项目” header with add/create controls, grouped workspaces, service status/settings footer. Reuse current task actions and current-session visuals. Remove the old current-workspace card and native select.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `pnpm vitest run src/renderer/components/workbench/WorkspaceGroup.test.tsx src/renderer/components/workbench/WorkspaceSidebar.test.tsx src/renderer/components/workbench/WorkbenchShell.test.tsx && pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/renderer/components/workbench/WorkspaceGroup.tsx src/renderer/components/workbench/WorkspaceGroup.test.tsx src/renderer/components/workbench/WorkspaceSidebar.tsx src/renderer/components/workbench/WorkspaceSidebar.test.tsx src/renderer/components/workbench/WorkbenchShell.tsx src/renderer/components/workbench/WorkbenchShell.test.tsx
git commit -m "feat: add grouped workspace sidebar"
```

---

### Task 6: 修复新建任务的工作区选择与提交流程

**Files:**
- Modify: `src/renderer/components/workbench/NewTaskDialog.tsx`
- Modify: `src/renderer/components/workbench/NewTaskDialog.test.tsx`
- Modify: `src/renderer/hooks/useWorkbench.ts`
- Modify: `src/renderer/hooks/useWorkbench.test.tsx`

**Interfaces:**
- Consumes: explicit `initialWorkspaceId` and full workspace list.
- Produces: submission request that preserves the user-selected workspace until completion.
- Produces: `createTask` that atomically selects the returned task and its actual workspace.

- [ ] **Step 1: Write failing dialog regression tests**

Render open with workspace A, select B, rerender with a new `workspaces` array and the same open state, and assert B remains selected. Assert reopening resets to the new explicit initial workspace. Assert submit disables controls and prevents duplicate creation.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm vitest run src/renderer/components/workbench/NewTaskDialog.test.tsx src/renderer/hooks/useWorkbench.test.tsx`

Expected: FAIL with the current effect resetting selection.

- [ ] **Step 3: Implement transition-only initialization**

Track closed→open transition or key the form state by dialog instance. Do not depend on the workspaces array for selection reset. Use Radix Select/Command-style workspace picker rather than a native select.

- [ ] **Step 4: Fix task creation navigation**

After API creation, merge the returned session into the correct group and atomically select `{ workspaceId: created.workspaceId ?? request.workspaceId, sessionId: created.id }` before any background refresh can run.

- [ ] **Step 5: Run tests and commit**

Run: `pnpm vitest run src/renderer/components/workbench/NewTaskDialog.test.tsx src/renderer/hooks/useWorkbench.test.tsx && pnpm typecheck`

```powershell
git add src/renderer/components/workbench/NewTaskDialog.tsx src/renderer/components/workbench/NewTaskDialog.test.tsx src/renderer/hooks/useWorkbench.ts src/renderer/hooks/useWorkbench.test.tsx
git commit -m "fix: preserve new task workspace selection"
```

---

### Task 7: 完成工作区添加、创建、重命名和清除交互

**Files:**
- Create: `src/renderer/components/workbench/WorkspaceDialogs.tsx`
- Create: `src/renderer/components/workbench/WorkspaceDialogs.test.tsx`
- Modify: `src/renderer/components/workbench/WorkspaceSidebar.tsx`
- Modify: `src/renderer/components/workbench/WorkbenchShell.tsx`
- Modify: `src/renderer/App.tsx`

**Interfaces:**
- Existing-folder flow: choose folder → register workspace → expand/select it。
- New-project flow: enter a folder name → main chooses parent and creates child → register → expand/select it。
- Rename flow: changes display name only。
- Remove flow: explicit confirmation that local files remain, then DELETE unregister; unsupported CLI displays a non-destructive message。

- [ ] **Step 1: Write failing dialog and integration tests**

Cover validation messages, cancel behavior, pending state, returned workspace selection, rename display-only copy, remove confirmation copy, and unsupported mutation errors.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm vitest run src/renderer/components/workbench/WorkspaceDialogs.test.tsx src/renderer/components/workbench/WorkspaceSidebar.test.tsx src/renderer/components/workbench/WorkbenchShell.test.tsx`

Expected: FAIL because dialogs and actions are not wired.

- [ ] **Step 3: Implement unified Radix dialogs**

Match current desktop shell: same radii, overlay, spacing, buttons, focus trap and Escape behavior. All text is Chinese. The remove dialog must say “只会从列表中清除，本地文件不会被删除”。

- [ ] **Step 4: Wire actions and error surfaces**

Keep failures local to the dialog/group. Do not refresh or close until a mutation succeeds. On success update state immediately, then schedule a background refresh.

- [ ] **Step 5: Run tests and commit**

Run: `pnpm vitest run src/renderer/components/workbench/WorkspaceDialogs.test.tsx src/renderer/components/workbench/WorkspaceSidebar.test.tsx src/renderer/components/workbench/WorkbenchShell.test.tsx src/renderer/App.test.tsx && pnpm typecheck`

```powershell
git add src/renderer/components/workbench/WorkspaceDialogs.tsx src/renderer/components/workbench/WorkspaceDialogs.test.tsx src/renderer/components/workbench/WorkspaceSidebar.tsx src/renderer/components/workbench/WorkbenchShell.tsx src/renderer/App.tsx src/renderer/components/workbench/*.test.tsx src/renderer/App.test.tsx
git commit -m "feat: add workspace management dialogs"
```

---

### Task 8: 修复归档弹窗重复加载并完善恢复体验

**Files:**
- Modify: `src/renderer/components/workbench/ArchivedSessionsDialog.tsx`
- Modify: `src/renderer/components/workbench/ArchivedSessionsDialog.test.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/hooks/useWorkbench.ts`
- Modify: `src/renderer/hooks/useWorkbench.test.tsx`

**Interfaces:**
- `onLoad` runs once per closed→open transition unless the user presses retry.
- Search filters cached archived sessions without refetching.
- Restore closes the dialog only after success and atomically opens the restored task/workspace.

- [ ] **Step 1: Write failing load-loop regression test**

Rerender the open dialog with a new callback identity after loading and assert the original load count remains one. Add error→retry and restore-to-other-workspace assertions.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm vitest run src/renderer/components/workbench/ArchivedSessionsDialog.test.tsx src/renderer/hooks/useWorkbench.test.tsx`

Expected: FAIL because the effect currently depends on callback identity.

- [ ] **Step 3: Implement transition-based loading**

Keep the latest callback in a ref, but trigger automatic load only when `open` changes false→true. Render loaded, empty, error, retry and restoring states without introducing archived deletion controls.

- [ ] **Step 4: Run tests and commit**

Run: `pnpm vitest run src/renderer/components/workbench/ArchivedSessionsDialog.test.tsx src/renderer/hooks/useWorkbench.test.tsx src/renderer/App.test.tsx && pnpm typecheck`

```powershell
git add src/renderer/components/workbench/ArchivedSessionsDialog.tsx src/renderer/components/workbench/ArchivedSessionsDialog.test.tsx src/renderer/hooks/useWorkbench.ts src/renderer/hooks/useWorkbench.test.tsx src/renderer/App.tsx src/renderer/App.test.tsx
git commit -m "fix: stabilize archived task loading"
```

---

### Task 9: 统一字体层级和浅色/深色主题

**Files:**
- Modify: `src/renderer/styles.css`
- Modify: `src/renderer/components/workbench/WorkspaceGroup.tsx`
- Modify: `src/renderer/components/workbench/WorkspaceSidebar.tsx`
- Modify: `src/renderer/components/workbench/WorkspaceDialogs.tsx`
- Modify: `src/renderer/components/workbench/NewTaskDialog.tsx`
- Modify: `src/renderer/components/workbench/ArchivedSessionsDialog.tsx`
- Test: `src/renderer/App.test.tsx`
- Test: `src/renderer/components/workbench/WorkbenchShell.test.tsx`

**Interfaces:**
- Produces semantic CSS variables: `--surface-primary`, `--surface-secondary`, `--surface-elevated`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--border-subtle`, `--border-strong`, `--selection-active`。
- User-readable font scale: labels 10–11px, metadata 11–12px, sidebar/menu 12–13px, task titles 13px, input/body 14px, headings 19–22px。

- [ ] **Step 1: Add failing structural theme tests**

Assert the rendered root exposes the theme data attribute, dialog text does not use hardcoded dark inline colors, and all new popovers/dialogs have semantic surface class names. Add a source assertion preventing new `font-size: 7px` and `font-size: 8px` declarations.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm vitest run src/renderer/App.test.tsx src/renderer/components/workbench/WorkbenchShell.test.tsx`

Expected: FAIL until semantic styles are present.

- [ ] **Step 3: Define semantic variables for dark and light themes**

Move touched components away from hardcoded background/text colors. Ensure the archive dialog, workspace menus, new-task dialog, confirmations, composer and service footer all use variables in both themes.

- [ ] **Step 4: Raise readable typography and polish layout**

Increase small text by roughly one visual step, retain dense metadata hierarchy, use subtle active task background/left indicator, consistent 8/10/12px spacing rhythm, and no expensive list-height animation.

- [ ] **Step 5: Run tests and commit**

Run: `pnpm vitest run src/renderer/App.test.tsx src/renderer/components/workbench/WorkbenchShell.test.tsx && pnpm typecheck`

```powershell
git add src/renderer/styles.css src/renderer/components/workbench src/renderer/App.test.tsx
git commit -m "style: unify workspace themes and typography"
```

---

### Task 10: 全量回归与真实 Windows 冒烟测试

**Files:**
- Modify tests only if a verified behavior mismatch remains; do not weaken assertions to hide implementation bugs.

**Interfaces:**
- Verifies all earlier tasks as an integrated desktop application.

- [ ] **Step 1: Run complete automated verification**

Run:

```powershell
pnpm test
pnpm typecheck
pnpm build:dir
```

Expected: all tests pass, typecheck passes, and `release\0.6.0\win-unpacked\Kimi Code Desktop.exe` (or the current version path after Task 11) builds successfully.

- [ ] **Step 2: Launch the packaged app against the installed CLI**

Start the exact executable with `Start-Process -WindowStyle Hidden` only when a hidden helper is needed; the actual app window remains visible for UI inspection. Verify service connection, workspace list, task selection, new task to a non-current workspace, archive load/restore, and close confirmation/service shutdown.

- [ ] **Step 3: Capture visual smoke screenshots**

Verify at 1280×820 and 1600×1000 for dark, light and system themes. Inspect: expanded/collapsed groups, many tasks, empty workspace, workspace menu, new task, archive and remove confirmation. Store temporary screenshots under `.tmp/` only; do not commit them.

- [ ] **Step 4: Fix only observed regressions with focused tests**

For every issue, first add/reproduce with a focused test, then implement the smallest correction and rerun the focused plus full suites.

- [ ] **Step 5: Commit any smoke-test fixes**

```powershell
git add <only verified fix files>
git commit -m "fix: address workspace sidebar regressions"
```

---

### Task 11: 提升版本、构建安装包并清理旧本地分发

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Generated locally, not committed: `release/0.7.0/**`

**Interfaces:**
- Produces desktop version `0.7.0` Windows NSIS installer and unpacked directory.
- Leaves exactly the newest two semantic-version distribution sets under `D:\mydev\kimi-code\desktop\release` (expected `0.6.0` and `0.7.0` after this release).

- [ ] **Step 1: Bump package version**

Update `package.json` and the root importer version metadata in `pnpm-lock.yaml` to `0.7.0`. Do not modify upstream CLI package versions.

- [ ] **Step 2: Run final clean verification**

Run:

```powershell
pnpm test
pnpm typecheck
pnpm build
```

Expected: tests/typecheck pass and `release\0.7.0\Kimi Code Desktop-0.7.0-setup.exe` plus `release\0.7.0\win-unpacked\Kimi Code Desktop.exe` exist with the Kimi icon.

- [ ] **Step 3: Verify artifacts before deleting anything**

Compute SHA-256 for installer and executable. List every release-root child with resolved absolute path and size. Determine the two highest semantic versions numerically, not lexically.

- [ ] **Step 4: Safely remove old local artifacts**

Use native PowerShell end-to-end. For every deletion candidate:
- resolve the absolute path;
- require its parent to equal `D:\mydev\kimi-code\desktop\release` or, for nested version contents, require it to remain inside one verified old-version directory;
- delete only old semantic-version directories and root files whose filename embeds an old version;
- preserve `0.6.0`, `0.7.0`, current metadata/checksum files, and all Git/GitHub state.

Run `Remove-Item -LiteralPath ... -Recurse -Force` only after printing and checking the final candidate list.

- [ ] **Step 5: Verify retention result**

List release contents and total size. Confirm only the latest two version sets remain and both packaged executables launch.

- [ ] **Step 6: Commit version metadata**

```powershell
git add package.json pnpm-lock.yaml
git commit -m "chore: release desktop 0.7.0"
```

---

### Task 12: Final repository verification and delivery

**Files:**
- No new files unless verification reveals a required fix.

- [ ] **Step 1: Inspect repository state**

Run:

```powershell
git status --short
git diff main...HEAD --stat
git log --oneline --decorate -12
```

Expected: no scratch files, no `.tmp` screenshots staged, and only planned source/docs/version changes.

- [ ] **Step 2: Run final verification once more**

Run: `pnpm test && pnpm typecheck`

Expected: PASS with no skipped regression suite.

- [ ] **Step 3: Push independent desktop branch**

Verify `git remote -v` points only to `wjt0321/kimi-code-desktop`, then push `codex/workspace-sidebar-fixes`. Never push from `D:\mydev\kimi-code` upstream root.

- [ ] **Step 4: Integrate according to the established desktop release workflow**

Merge the verified feature branch into the independent desktop `main`, tag/publish only if the repository’s existing release workflow requires it, and push `main`. Re-run the packaged smoke test from the final main commit.
