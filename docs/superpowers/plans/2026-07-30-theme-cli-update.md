# Theme and CLI Update Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Kimi Code Desktop 增加浅色、深色、跟随系统三种主题，并提供遵循上游发布协议、识别安装来源、需要用户确认且能恢复本地服务的 CLI 更新中心。

**Architecture:** Electron 主进程拥有主题偏好、系统主题、版本检查、更新缓存和安装状态；preload 只暴露经过 Zod 校验的结构化 IPC；React 渲染层通过 hooks 消费快照并展示设置、提醒和确认流程。更新实现对齐上游官方 CDN 与安装命令语义，但桌面仓库不导入上游私有源码，所有网络、命令和生命周期逻辑都可注入并单元测试。

**Tech Stack:** Electron 43、React 19、TypeScript、Zod 4、Radix UI、Vitest、Testing Library、Node.js 24、pnpm 10、Windows NSIS。

## Global Constraints

- 回复和用户界面优先使用中文。
- Windows 10/11 x64 优先，正式验收必须包含 Windows 打包版。
- CLI 0.30.x 必须继续可用；主题功能不得依赖 CLI 版本。
- 不静默安装更新；安装必须由用户明确确认。
- 不允许渲染进程提交任意命令、包名、安装参数或目标版本。
- 只使用官方 `https://code.kimi.com/kimi-code/latest.json`，失败时降级到官方 `/latest`。
- 自动检查成功缓存有效期固定为 24 小时。
- Windows 首期自动安装只支持 npm、pnpm、yarn、bun 全局安装。
- 桌面端不得结束无法确认由自身启动的外部服务。
- 不把服务 Token、Authorization Header、环境变量或账户信息暴露给渲染进程。
- 不新增不必要的运行时依赖；SemVer 和 rollout 逻辑使用小型本地纯函数并完整测试。
- 所有生产代码遵循 TDD：先写失败测试，确认失败，再写最小实现。
- 每个任务完成后单独提交，不混入无关重构。

---

## Planned File Structure

### Shared contracts

- Modify: `src/shared/contracts.ts` — 主题、更新、安装来源和请求契约。
- Modify: `src/shared/contracts.test.ts` — Zod 输入输出验证。

### Main process: preferences and theme

- Create: `src/main/preferences/desktop-preferences.ts` — 读取、校验、原子写入桌面偏好。
- Create: `src/main/preferences/desktop-preferences.test.ts` — 偏好损坏、缺失和持久化测试。
- Create: `src/main/theme/theme-service.ts` — `nativeTheme` 适配、实际主题解析和事件广播。
- Create: `src/main/theme/theme-service.test.ts` — system/light/dark 和系统变化测试。
- Modify: `src/main/main.ts` — 创建服务、窗口启动主题、IPC 和标题栏同步。
- Modify: `src/main/window-behavior.ts` — 主题对应的窗口颜色纯函数。
- Modify: `src/main/window-behavior.test.ts` — 浅色/深色窗口颜色测试。

### Main process: update checking and installation

- Create: `src/main/update/version.ts` — 稳定版本解析与比较。
- Create: `src/main/update/version.test.ts` — SemVer 边界测试。
- Create: `src/main/update/update-manifest.ts` — 官方 JSON/文本获取、Zod 解析和超时。
- Create: `src/main/update/update-manifest.test.ts` — JSON、fallback、错误测试。
- Create: `src/main/update/update-cache.ts` — 24 小时缓存、设备标识和原子持久化。
- Create: `src/main/update/update-cache.test.ts` — 缓存新鲜度和损坏恢复测试。
- Create: `src/main/update/update-rollout.ts` — 稳定分桶和批次资格。
- Create: `src/main/update/update-rollout.test.ts` — rollout 百分比、延迟和无 manifest 测试。
- Create: `src/main/update/install-source.ts` — npm/pnpm/yarn/bun/native/unsupported 识别。
- Create: `src/main/update/install-source.test.ts` — Windows 路径与 prefix 测试。
- Create: `src/main/update/install-command.ts` — 固定包名的安全命令描述。
- Create: `src/main/update/install-command.test.ts` — 各来源命令和不支持来源测试。
- Create: `src/main/update/update-process.ts` — 无 shell 安装、输出上限、超时和脱敏。
- Create: `src/main/update/update-process.test.ts` — 参数、超时、失败和脱敏测试。
- Create: `src/main/update/cli-update-service.ts` — 检查、确认、安装、验证、服务恢复状态机。
- Create: `src/main/update/cli-update-service.test.ts` — 端到端服务状态机单元测试。
- Modify: `src/main/ipc.ts` — Controller 接入检查与升级编排。
- Modify: `src/main/ipc.test.ts` — 更新检查、服务停止和恢复测试。

### Preload and renderer

- Modify: `src/preload/index.ts` — 主题和更新 IPC API。
- Modify: `src/preload/index.d.ts` — `window.desktop` 类型。
- Create: `src/renderer/hooks/useDesktopTheme.ts` — 主题快照、切换和事件监听。
- Create: `src/renderer/hooks/useDesktopTheme.test.tsx` — 初始化、切换和系统事件测试。
- Create: `src/renderer/hooks/useCliUpdate.ts` — 更新快照、检查、确认和事件监听。
- Create: `src/renderer/hooks/useCliUpdate.test.tsx` — 更新 hook 测试。
- Create: `src/renderer/components/workbench/ThemeControl.tsx` — 三段式主题选择。
- Create: `src/renderer/components/workbench/ThemeControl.test.tsx` — 单选语义和切换测试。
- Create: `src/renderer/components/workbench/CliUpdateSection.tsx` — 设置页更新状态和动作。
- Create: `src/renderer/components/workbench/CliUpdateSection.test.tsx` — 各状态展示测试。
- Create: `src/renderer/components/workbench/CliUpdateDialog.tsx` — 确认与安装进度弹窗。
- Create: `src/renderer/components/workbench/CliUpdateDialog.test.tsx` — 二次确认和不可重复提交测试。
- Modify: `src/renderer/components/workbench/SettingsDialog.tsx` — 外观与 CLI 更新分组。
- Modify: `src/renderer/components/workbench/SettingsDialog.test.tsx` — 组合测试。
- Modify: `src/renderer/components/CommandPalette.tsx` — 主题命令与检查更新命令。
- Modify: `src/renderer/components/CommandPalette.test.tsx` — 命令触发测试。
- Modify: `src/renderer/components/workbench/EnvironmentStatus.tsx` — 非阻断更新提醒。
- Modify: `src/renderer/components/workbench/EnvironmentStatus.test.tsx` — 更新圆点/文案测试。
- Modify: `src/renderer/components/workbench/WorkbenchShell.tsx` — 传递主题和更新状态。
- Modify: `src/renderer/App.tsx` — 组合 hooks 和动作。
- Modify: `src/renderer/App.test.tsx` — preload mock 和主流程测试。
- Modify: `src/renderer/index.html` — 启动主题 bootstrap 标记。
- Modify: `src/renderer/styles.css` — 语义 Token、浅色主题和更新中心样式。
- Modify: `src/renderer/layout.test.ts` — 浅色主题关键选择器与固定布局回归。

### Release

- Modify: `README.md` — 主题和 CLI 更新说明。
- Modify: `package.json` — 完成验收后升级为 0.6.0。

---

### Task 1: Add shared theme and CLI update contracts

**Files:**
- Modify: `src/shared/contracts.ts`
- Modify: `src/shared/contracts.test.ts`

**Interfaces:**
- Produces: `ThemePreferenceSchema`, `ResolvedThemeSchema`, `DesktopThemeSnapshotSchema`。
- Produces: `CliInstallSourceSchema`, `CliUpdatePhaseSchema`, `DesktopCliUpdateSnapshotSchema`。
- Produces: `SetThemeRequestSchema` and an empty `ConfirmCliUpdateRequestSchema` or no-payload action contract consistent with existing IPC style。

- [ ] **Step 1: Write failing theme contract tests**

Add tests that accept:

```ts
DesktopThemeSnapshotSchema.parse({ preference: 'system', resolved: 'light' });
```

and reject invalid values such as `preference: 'auto'`.

- [ ] **Step 2: Write failing update contract tests**

Cover `available`, `installing`, `succeeded`, and `failed` snapshots. Require `currentVersion`, `canAutoInstall`, and `updateAvailable`; keep phase-specific detail optional so older cached states remain forward-compatible.

- [ ] **Step 3: Run the contract tests and verify RED**

Run:

```powershell
pnpm vitest run src/shared/contracts.test.ts
```

Expected: FAIL because the new schemas are not exported.

- [ ] **Step 4: Implement the minimal Zod schemas and inferred types**

Use enums and optional properties; do not add `| undefined` to optional type members.

- [ ] **Step 5: Run tests and typecheck**

```powershell
pnpm vitest run src/shared/contracts.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/shared/contracts.ts src/shared/contracts.test.ts
git commit -m "feat: add theme and CLI update contracts"
```

---

### Task 2: Persist desktop preferences safely

**Files:**
- Create: `src/main/preferences/desktop-preferences.ts`
- Create: `src/main/preferences/desktop-preferences.test.ts`

**Interfaces:**
- Produces:

```ts
interface DesktopPreferencesStore {
  read(): Promise<{ theme: ThemePreference }>;
  write(patch: { theme?: ThemePreference }): Promise<{ theme: ThemePreference }>;
}

function createDesktopPreferencesStore(filePath: string): DesktopPreferencesStore;
```

- [ ] **Step 1: Write failing tests for missing and invalid files**

Use a temporary directory. Missing, malformed JSON and invalid theme values must return `{ theme: 'system' }` without throwing.

- [ ] **Step 2: Write failing persistence tests**

Verify writing `light` persists valid JSON and preserves future unknown keys only if the chosen schema explicitly allows them; otherwise keep the file intentionally minimal.

- [ ] **Step 3: Run tests and verify RED**

```powershell
pnpm vitest run src/main/preferences/desktop-preferences.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 4: Implement atomic read/write**

Write to a sibling temporary file and rename it into place. Create the parent directory when needed. Swallow read corruption but surface write failures to the caller.

- [ ] **Step 5: Run focused tests**

```powershell
pnpm vitest run src/main/preferences/desktop-preferences.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/main/preferences
git commit -m "feat: persist desktop preferences"
```

---

### Task 3: Implement the main-process theme service and window colors

**Files:**
- Create: `src/main/theme/theme-service.ts`
- Create: `src/main/theme/theme-service.test.ts`
- Modify: `src/main/window-behavior.ts`
- Modify: `src/main/window-behavior.test.ts`
- Modify: `src/main/main.ts`

**Interfaces:**
- Consumes: `DesktopPreferencesStore` from Task 2.
- Produces:

```ts
interface NativeThemePort {
  themeSource: 'system' | 'light' | 'dark';
  readonly shouldUseDarkColors: boolean;
  on(event: 'updated', listener: () => void): void;
  off(event: 'updated', listener: () => void): void;
}

class DesktopThemeService {
  initialize(): Promise<DesktopThemeSnapshot>;
  snapshot(): DesktopThemeSnapshot;
  setPreference(preference: ThemePreference): Promise<DesktopThemeSnapshot>;
  onSnapshot(listener: (snapshot: DesktopThemeSnapshot) => void): () => void;
}
```

- [ ] **Step 1: Write failing service tests**

Cover:

- default `system` resolves from `shouldUseDarkColors`;
- setting `light` changes `themeSource` and persists;
- native updates emit only when the resolved snapshot changes;
- manual `dark` ignores later system color changes.

- [ ] **Step 2: Write failing window color tests**

Add a pure function:

```ts
resolveWindowTheme('light')
```

returning `backgroundColor`, overlay background and symbol color. Assert both modes.

- [ ] **Step 3: Run focused tests and verify RED**

```powershell
pnpm vitest run src/main/theme/theme-service.test.ts src/main/window-behavior.test.ts
```

- [ ] **Step 4: Implement service and color mapping**

Keep Electron imports out of the pure service by using the port. Wire real `nativeTheme` only in `main.ts`.

- [ ] **Step 5: Apply the initial theme before creating BrowserWindow**

Initialize the service inside `app.whenReady()`, pass the resolved theme into `createMainWindow`, and update every open window with `setBackgroundColor` and `setTitleBarOverlay` on changes.

- [ ] **Step 6: Add IPC handlers and broadcasts**

Register snapshot, set-preference, and change-event channels. Parse all inputs with the shared schemas.

- [ ] **Step 7: Run focused and main-process tests**

```powershell
pnpm vitest run src/main/theme/theme-service.test.ts src/main/window-behavior.test.ts src/main/ipc.test.ts
pnpm typecheck
```

- [ ] **Step 8: Commit**

```powershell
git add src/main/theme src/main/window-behavior.ts src/main/window-behavior.test.ts src/main/main.ts src/main/ipc.ts src/main/ipc.test.ts
git commit -m "feat: manage desktop themes in the main process"
```

---

### Task 4: Expose and render themes without startup flash

**Files:**
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Create: `src/renderer/hooks/useDesktopTheme.ts`
- Create: `src/renderer/hooks/useDesktopTheme.test.tsx`
- Create: `src/renderer/components/workbench/ThemeControl.tsx`
- Create: `src/renderer/components/workbench/ThemeControl.test.tsx`
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/styles.css`
- Modify: `src/renderer/layout.test.ts`

**Interfaces:**
- Consumes: main theme IPC from Task 3.
- Produces `useDesktopTheme(): { theme, setTheme }`.
- Produces `ThemeControl` with `theme` and `onChange` props.

- [ ] **Step 1: Write failing preload/hook tests**

Verify initial snapshot retrieval, event subscription cleanup, and `setTheme('light')` updating state from the returned main-process snapshot.

- [ ] **Step 2: Write failing ThemeControl tests**

Use radio semantics. Assert labels “跟随系统 / 浅色 / 深色”, selected state and callback values.

- [ ] **Step 3: Run focused tests and verify RED**

```powershell
pnpm vitest run src/renderer/hooks/useDesktopTheme.test.tsx src/renderer/components/workbench/ThemeControl.test.tsx
```

- [ ] **Step 4: Implement preload APIs and hook**

Expose only snapshot, set preference and change subscription.

- [ ] **Step 5: Apply `data-theme` before React paint**

Pass the initial resolved theme through a non-sensitive BrowserWindow bootstrap value and set `document.documentElement.dataset.theme` in preload before the renderer mounts. Keep `prefers-color-scheme` as CSS fallback.

- [ ] **Step 6: Introduce semantic tokens**

Map existing variables to the new semantic token layer first, then add `[data-theme='light']` values. Cover navigation, canvas, cards, input, popovers, dialogs, Diff, status colors and selection states.

- [ ] **Step 7: Add layout regression assertions**

Assert that CSS contains both light/dark roots, semantic variables and the fixed composer/layout rules.

- [ ] **Step 8: Run focused tests and typecheck**

```powershell
pnpm vitest run src/renderer/hooks/useDesktopTheme.test.tsx src/renderer/components/workbench/ThemeControl.test.tsx src/renderer/layout.test.ts
pnpm typecheck
```

- [ ] **Step 9: Commit**

```powershell
git add src/preload src/renderer/hooks/useDesktopTheme* src/renderer/components/workbench/ThemeControl* src/renderer/index.html src/renderer/styles.css src/renderer/layout.test.ts
git commit -m "feat: add light dark and system themes"
```

---

### Task 5: Build the official update manifest, version and cache layer

**Files:**
- Create: `src/main/update/version.ts`
- Create: `src/main/update/version.test.ts`
- Create: `src/main/update/update-manifest.ts`
- Create: `src/main/update/update-manifest.test.ts`
- Create: `src/main/update/update-cache.ts`
- Create: `src/main/update/update-cache.test.ts`
- Create: `src/main/update/update-rollout.ts`
- Create: `src/main/update/update-rollout.test.ts`

**Interfaces:**
- Produces:

```ts
parseStableVersion(value: string): readonly [number, number, number] | undefined;
compareStableVersions(left: string, right: string): number | undefined;
fetchOfficialUpdate(fetchImpl?: typeof fetch): Promise<{ latest: string; manifest?: UpdateManifest }>;
isUpdateCacheFresh(checkedAt: string | undefined, now: Date): boolean;
isRolloutEligible(input: RolloutInput): boolean;
```

- [ ] **Step 1: Write failing version tests**

Cover optional leading `v`, whitespace, invalid values, equal versions and ordering. Reject prerelease targets for the first desktop updater release.

- [ ] **Step 2: Write failing manifest tests**

Use injected fetch responses:

- valid `latest.json`;
- malformed JSON falling back to `/latest`;
- invalid SemVer;
- both endpoints failing;
- abort timeout.

- [ ] **Step 3: Write failing cache tests**

Cover 23h59m fresh, 24h stale, corrupt JSON recovery, stable generated device id and atomic writes.

- [ ] **Step 4: Write failing rollout tests**

Mirror upstream ordered percentage buckets and delay seconds. No manifest means eligible immediately.

- [ ] **Step 5: Run tests and verify RED**

```powershell
pnpm vitest run src/main/update/version.test.ts src/main/update/update-manifest.test.ts src/main/update/update-cache.test.ts src/main/update/update-rollout.test.ts
```

- [ ] **Step 6: Implement minimal pure functions and stores**

Use Zod `.passthrough()` behavior for future manifest fields. Timeouts use `AbortController`. Do not overwrite a valid cache after a transient fetch failure.

- [ ] **Step 7: Run focused tests**

```powershell
pnpm vitest run src/main/update/version.test.ts src/main/update/update-manifest.test.ts src/main/update/update-cache.test.ts src/main/update/update-rollout.test.ts
pnpm typecheck
```

- [ ] **Step 8: Commit**

```powershell
git add src/main/update/version* src/main/update/update-manifest* src/main/update/update-cache* src/main/update/update-rollout*
git commit -m "feat: check official CLI update manifests"
```

---

### Task 6: Detect install sources and generate safe commands

**Files:**
- Create: `src/main/update/install-source.ts`
- Create: `src/main/update/install-source.test.ts`
- Create: `src/main/update/install-command.ts`
- Create: `src/main/update/install-command.test.ts`

**Interfaces:**
- Produces:

```ts
detectInstallSource(input: {
  cliCommand: string;
  packageRoot?: string;
  npmGlobalPrefix?: string;
  platform: NodeJS.Platform;
}): CliInstallSource;

resolveInstallCommand(source: CliInstallSource, version: string, platform: NodeJS.Platform): {
  executable: string;
  args: readonly string[];
  display: string;
} | undefined;
```

- [ ] **Step 1: Write failing Windows source tests**

Use neutral paths for npm, pnpm, yarn and bun. Include a launcher path with spaces. Include an unknown portable path that must return `unsupported`.

- [ ] **Step 2: Write failing command tests**

Assert exact executable and argument arrays. Invalid versions and `unsupported` must not produce an executable action.

- [ ] **Step 3: Run tests and verify RED**

```powershell
pnpm vitest run src/main/update/install-source.test.ts src/main/update/install-command.test.ts
```

- [ ] **Step 4: Implement path classification and fixed command table**

The package name is a constant. Never accept it from a caller.

- [ ] **Step 5: Add real package-root discovery adapter**

Use the CLI launcher location and package manager global prefix. Keep filesystem and command execution injectable so tests do not inspect the developer machine.

- [ ] **Step 6: Run focused tests and typecheck**

```powershell
pnpm vitest run src/main/update/install-source.test.ts src/main/update/install-command.test.ts
pnpm typecheck
```

- [ ] **Step 7: Commit**

```powershell
git add src/main/update/install-source* src/main/update/install-command*
git commit -m "feat: detect CLI installation sources"
```

---

### Task 7: Implement the bounded and redacted update process runner

**Files:**
- Create: `src/main/update/update-process.ts`
- Create: `src/main/update/update-process.test.ts`

**Interfaces:**
- Consumes safe command descriptors from Task 6.
- Produces:

```ts
interface UpdateProcessResult {
  code: number;
  output: string;
  timedOut: boolean;
}

interface UpdateProcessRunner {
  run(command: InstallCommand): Promise<UpdateProcessResult>;
}
```

- [ ] **Step 1: Write failing invocation tests**

Verify `shell: false`, Windows hidden process, fixed executable/args, and no raw display command execution.

- [ ] **Step 2: Write failing output tests**

Cover stdout/stderr combination, maximum retained tail, token/authorization redaction and successful exit.

- [ ] **Step 3: Write failing timeout and process-error tests**

A timeout must return a controlled failure. Spawn errors must not expose environment variables.

- [ ] **Step 4: Run tests and verify RED**

```powershell
pnpm vitest run src/main/update/update-process.test.ts
```

- [ ] **Step 5: Implement the process runner**

Do not offer a destructive force-cancel once package installation starts. Use a generous bounded timeout and retain only a limited output tail.

- [ ] **Step 6: Run focused tests**

```powershell
pnpm vitest run src/main/update/update-process.test.ts
pnpm typecheck
```

- [ ] **Step 7: Commit**

```powershell
git add src/main/update/update-process*
git commit -m "feat: run CLI updates safely"
```

---

### Task 8: Build the CLI update service state machine

**Files:**
- Create: `src/main/update/cli-update-service.ts`
- Create: `src/main/update/cli-update-service.test.ts`
- Modify: `src/main/ipc.ts`
- Modify: `src/main/ipc.test.ts`

**Interfaces:**
- Consumes manifest/cache, source detection, safe commands, process runner, CLI discover/validate, lifecycle actions and capability refresh.
- Produces:

```ts
class CliUpdateService {
  snapshot(): DesktopCliUpdateSnapshot;
  check(currentCli: Extract<CliDiscovery, { kind: 'ready' }>, force?: boolean): Promise<DesktopCliUpdateSnapshot>;
  install(): Promise<DesktopCliUpdateSnapshot>;
  onSnapshot(listener: (snapshot: DesktopCliUpdateSnapshot) => void): () => void;
}
```

- [ ] **Step 1: Write failing check-state tests**

Cover:

- cached current version;
- forced network refresh;
- update available;
- rollout not yet eligible;
- unsupported install source;
- network failure retaining the last good result.

- [ ] **Step 2: Write failing installation tests**

Cover exact phase order:

```text
stopping-service → installing → verifying → restarting-service → succeeded
```

Also cover no-running-service, failed process, successful process with wrong version, and restore-after-failure.

- [ ] **Step 3: Write failing security tests**

Calling `install()` without a service-owned available target must fail before spawning. A second concurrent install must reuse/reject the active operation rather than spawn twice.

- [ ] **Step 4: Run tests and verify RED**

```powershell
pnpm vitest run src/main/update/cli-update-service.test.ts src/main/ipc.test.ts
```

- [ ] **Step 5: Implement checking and snapshot events**

Automatic checks use cache; manual checks force refresh. Initial app startup schedules checking only after CLI discovery reaches `ready`.

- [ ] **Step 6: Implement lifecycle orchestration**

Use `DesktopController` methods to determine whether the desktop-managed service was active, stop it, refresh CLI discovery, refresh capabilities and restart only when appropriate. Do not create a generic arbitrary process-management IPC.

- [ ] **Step 7: Implement verification and recovery**

Treat the update as successful only when rediscovery returns a valid version greater than or equal to the target. On failure, rediscover the CLI and recover the managed service if still usable.

- [ ] **Step 8: Run focused tests and typecheck**

```powershell
pnpm vitest run src/main/update/cli-update-service.test.ts src/main/ipc.test.ts
pnpm typecheck
```

- [ ] **Step 9: Commit**

```powershell
git add src/main/update/cli-update-service* src/main/ipc.ts src/main/ipc.test.ts
git commit -m "feat: orchestrate CLI updates"
```

---

### Task 9: Expose CLI updates through preload and renderer hooks

**Files:**
- Modify: `src/main/main.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Create: `src/renderer/hooks/useCliUpdate.ts`
- Create: `src/renderer/hooks/useCliUpdate.test.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/App.test.tsx`

**Interfaces:**
- Consumes `CliUpdateService` from Task 8.
- Produces `useCliUpdate()` with snapshot, `check(force)`, and `install()` actions.

- [ ] **Step 1: Write failing preload and hook tests**

Verify snapshot validation, event subscription, manual force-check and install state updates.

- [ ] **Step 2: Extend App test API mocks**

Add neutral update snapshots and ensure missing update APIs degrade to an idle snapshot in older test fixtures.

- [ ] **Step 3: Run tests and verify RED**

```powershell
pnpm vitest run src/renderer/hooks/useCliUpdate.test.tsx src/renderer/App.test.tsx
```

- [ ] **Step 4: Register IPC and preload APIs**

No update IPC accepts an executable, args, package name or target version.

- [ ] **Step 5: Trigger deferred automatic checks**

After CLI discovery reaches ready, schedule a non-blocking cached check. Do not delay window creation or service controls.

- [ ] **Step 6: Implement hook and App wiring**

Keep fallback state forward-compatible and do not hardcode a latest version in the renderer.

- [ ] **Step 7: Run focused tests and typecheck**

```powershell
pnpm vitest run src/renderer/hooks/useCliUpdate.test.tsx src/renderer/App.test.tsx
pnpm typecheck
```

- [ ] **Step 8: Commit**

```powershell
git add src/main/main.ts src/preload src/renderer/hooks/useCliUpdate* src/renderer/App.tsx src/renderer/App.test.tsx
git commit -m "feat: expose CLI updates to the renderer"
```

---

### Task 10: Add theme and update UI to settings and the workbench

**Files:**
- Create: `src/renderer/components/workbench/CliUpdateSection.tsx`
- Create: `src/renderer/components/workbench/CliUpdateSection.test.tsx`
- Create: `src/renderer/components/workbench/CliUpdateDialog.tsx`
- Create: `src/renderer/components/workbench/CliUpdateDialog.test.tsx`
- Modify: `src/renderer/components/workbench/SettingsDialog.tsx`
- Modify: `src/renderer/components/workbench/SettingsDialog.test.tsx`
- Modify: `src/renderer/components/CommandPalette.tsx`
- Modify: `src/renderer/components/CommandPalette.test.tsx`
- Modify: `src/renderer/components/workbench/EnvironmentStatus.tsx`
- Modify: `src/renderer/components/workbench/EnvironmentStatus.test.tsx`
- Modify: `src/renderer/components/workbench/WorkbenchShell.tsx`
- Modify: `src/renderer/components/workbench/WorkbenchShell.test.tsx`
- Modify: `src/renderer/styles.css`

**Interfaces:**
- Consumes theme and update hooks from Tasks 4 and 9.
- Produces user-visible settings, reminder and confirmation flow.

- [ ] **Step 1: Write failing update section tests**

Assert Chinese presentation for idle/checking/current/available/failed. Unsupported sources show “复制手动升级命令” instead of an enabled one-click button.

- [ ] **Step 2: Write failing confirmation dialog tests**

The dialog shows current/target/source/command and service behavior. “开始升级” calls install once; the destructive action is not initially focused.

- [ ] **Step 3: Write failing settings and status tests**

Assert the Appearance section contains `ThemeControl`, settings exposes manual check, and EnvironmentStatus shows a non-blocking update indicator only when available.

- [ ] **Step 4: Write failing command palette tests**

Add commands for three theme preferences and “检查 CLI 更新”. Verify actions and palette closing.

- [ ] **Step 5: Run focused tests and verify RED**

```powershell
pnpm vitest run src/renderer/components/workbench/CliUpdateSection.test.tsx src/renderer/components/workbench/CliUpdateDialog.test.tsx src/renderer/components/workbench/SettingsDialog.test.tsx src/renderer/components/workbench/EnvironmentStatus.test.tsx src/renderer/components/CommandPalette.test.tsx src/renderer/components/workbench/WorkbenchShell.test.tsx
```

- [ ] **Step 6: Implement the UI hierarchy**

Use the existing visual language but reduce nested cards. Appearance uses compact segmented controls; update status uses one focused section with progressive disclosure for logs.

- [ ] **Step 7: Implement accessible progress and errors**

Use `aria-live="polite"` for phase changes. Do not use a global alert for a normal old-version reminder. Preserve detailed failure output behind an explicit expander.

- [ ] **Step 8: Complete light-theme component overrides**

Inspect and tune Radix overlays, model picker, command palette, approval cards, Diff, status bar and close/update dialogs so no dark-only surfaces remain.

- [ ] **Step 9: Run focused tests and typecheck**

```powershell
pnpm vitest run src/renderer/components/workbench/CliUpdateSection.test.tsx src/renderer/components/workbench/CliUpdateDialog.test.tsx src/renderer/components/workbench/SettingsDialog.test.tsx src/renderer/components/workbench/EnvironmentStatus.test.tsx src/renderer/components/CommandPalette.test.tsx src/renderer/components/workbench/WorkbenchShell.test.tsx
pnpm typecheck
```

- [ ] **Step 10: Commit**

```powershell
git add src/renderer/components src/renderer/styles.css
git commit -m "feat: add theme and update settings"
```

---

### Task 11: Release documentation, full verification and Windows smoke test

**Files:**
- Modify: `README.md`
- Modify: `package.json`

**Interfaces:**
- Produces version 0.6.0 release candidate and user documentation.

- [ ] **Step 1: Update README**

Document:

- light/dark/system behavior;
- automatic checks every 24 hours;
- no silent installation;
- supported package managers;
- service stop/restart behavior;
- manual fallback and privacy/security boundary.

- [ ] **Step 2: Bump package version to 0.6.0**

Run `pnpm install --lockfile-only` and keep `pnpm-lock.yaml` only if its content hash actually changes.

- [ ] **Step 3: Run all focused new tests**

```powershell
pnpm vitest run src/shared/contracts.test.ts src/main/preferences/desktop-preferences.test.ts src/main/theme/theme-service.test.ts src/main/window-behavior.test.ts src/main/update/version.test.ts src/main/update/update-manifest.test.ts src/main/update/update-cache.test.ts src/main/update/update-rollout.test.ts src/main/update/install-source.test.ts src/main/update/install-command.test.ts src/main/update/update-process.test.ts src/main/update/cli-update-service.test.ts src/main/ipc.test.ts src/renderer/hooks/useDesktopTheme.test.tsx src/renderer/hooks/useCliUpdate.test.tsx src/renderer/components/workbench/ThemeControl.test.tsx src/renderer/components/workbench/CliUpdateSection.test.tsx src/renderer/components/workbench/CliUpdateDialog.test.tsx src/renderer/components/workbench/SettingsDialog.test.tsx src/renderer/components/workbench/EnvironmentStatus.test.tsx src/renderer/components/CommandPalette.test.tsx
```

Expected: all pass.

- [ ] **Step 4: Run complete verification**

```powershell
pnpm typecheck
pnpm test
pnpm build:dir
pnpm build
```

Expected: all commands exit 0.

- [ ] **Step 5: Run packaged Windows theme smoke tests**

Launch the packaged executable and verify through the real Electron renderer:

- initial saved theme has no visible flash;
- light/dark/system switch immediately;
- titlebar and renderer match;
- Windows system theme update is reflected in system mode;
- restart preserves manual preference;
- settings, model menu, command palette, close dialog and update dialog are readable in both themes.

- [ ] **Step 6: Run update smoke tests without mutating the production CLI**

Use injected/fake package-manager fixtures for install execution. Against the real installed CLI, only check current/latest/source detection and confirmation UI unless the user explicitly authorizes a real upgrade.

- [ ] **Step 7: Verify shutdown cleanup**

After packaged app exit, assert zero Kimi Code Desktop processes and zero CLI service processes started by the desktop app.

- [ ] **Step 8: Commit release preparation**

```powershell
git add README.md package.json pnpm-lock.yaml
git commit -m "chore: prepare 0.6.0 release"
```

- [ ] **Step 9: Inspect final repository state**

```powershell
git status
git diff main...HEAD --stat
git log --oneline main..HEAD
```

Expected: clean working tree; only planned product, test, documentation and version changes.

---

## Execution Notes

- Execute tasks in order because later layers depend on shared contracts and main-process services.
- Theme Tasks 1-4 produce a fully testable feature before update work begins.
- Update Tasks 5-10 each have isolated pure-function or component tests before lifecycle integration.
- Do not run a real global package-manager update during automated tests.
- Do not publish or merge until the packaged Windows smoke test passes.
- Before claiming completion, use the `verification-before-completion` skill and rerun the complete verification commands.
- When implementation is complete, use the `finishing-a-development-branch` skill to merge, push and release in the independent desktop repository only.
