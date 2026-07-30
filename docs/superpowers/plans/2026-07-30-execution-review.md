# Kimi Code Desktop 0.4.0 Execution Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Kimi Code CLI 的工具调用、审批、计划审阅、文件差异和后台任务投影为可理解、可操作的中文桌面执行记录。

**Architecture:** 保持 `kap-server -> Electron main projector -> shared Zod contracts -> preload IPC -> React renderer` 边界。Electron main 对开放 Transcript payload 做限制、分类和降级，renderer 只消费稳定领域对象；文件 Diff 使用有限规模的本地行级算法，未知工具和旧 CLI payload 使用 generic fallback。

**Tech Stack:** Electron 39、React 19、TypeScript、Zod、Vitest、Testing Library、Lucide React、现有 CSS 变量系统。

## Global Constraints

- 只修改独立的桌面端仓库，不得提交到上游 `MoonshotAI/kimi-code`。
- 优先支持 Windows x64，所有主要用户文案使用中文。
- 保持 CLI 0.30.0 核心能力兼容，通过字段能力检测支持 0.31.0 及后续版本。
- 不直接依赖 `@moonshot-ai/transcript`、上游 Monorepo 内部包或 Vue Kimi Web。
- 未知工具、display block 和畸形 payload 必须安全降级。
- 不提供文件编辑、Git 操作、内嵌终端、自定义 Agent 配置或任意命令执行 IPC。
- 保持 Enter 发送、Ctrl + Enter 换行以及现有退出确认和服务联动关闭行为。
- 新组件使用 Lucide 图标，不用 Emoji 表达功能状态。
- 每项实现遵循 TDD：先写失败测试，确认失败，再做最小实现。

## File Structure

- `src/shared/contracts.ts`: rich tool、display value、progress、diff、approval block 和 IPC schemas。
- `src/main/server/display-value.ts`: 限制任意 wire 值的深度、数量和大小。
- `src/main/server/diff-projector.ts`: Edit/Write 参数归一化和有限规模行级 Diff。
- `src/main/server/tool-projector.ts`: 工具分类、常见字段提取、标题与摘要生成。
- `src/main/server/transcript-projector.ts`: 调用新 projector 并投影结构化 approval block。
- `src/main/ipc.ts` / `src/preload/*`: Windows reveal path 和 clipboard actions。
- `StructuredValue.tsx`: 结构化输入/输出只读展示。
- `ToolCallCard.tsx`: 统一工具卡片。
- `DiffReviewPanel.tsx`: 完整 Diff 面板。
- `InlineApprovalCard.tsx`: 类型化审批和计划审阅。
- `TaskTimeline.tsx`, `WorkbenchShell.tsx`, `ContextDock.tsx`: 锚点、详情状态和活动汇总。
- `styles.css`: 工具、审批、计划和 Diff 视觉系统。

---

### Task 1: Define rich execution contracts

**Files:**
- Modify: `src/shared/contracts.ts`
- Modify: `src/shared/contracts.test.ts`

**Interfaces:**
- Produces: `DesktopDisplayValue`, `DesktopToolProgress`, `DesktopDiffLine`, `DesktopDiffTarget`, `DesktopApprovalBlock`, enriched `DesktopTimelineEntry` and `DesktopApproval`.

- [ ] **Step 1: Write failing schema tests**

```ts
it('parses a rich shell tool entry', () => {
  expect(DesktopTimelineEntrySchema.parse({
    id: 'frame-1', kind: 'tool', toolCallId: 'call-1', name: 'Shell',
    category: 'shell', state: 'running', title: '运行命令', summary: 'pnpm test',
    command: 'pnpm test', cwd: 'D:/example',
    progress: { kind: 'stdout', text: 'RUN v4' },
  })).toMatchObject({ category: 'shell', command: 'pnpm test' });
});

it('parses a plan review approval block', () => {
  expect(DesktopApprovalSchema.parse({
    id: 'approval-1', kind: 'approval', toolName: 'ExitPlanMode', action: 'review',
    summary: '审阅计划', createdAt: '2026-07-30T00:00:00.000Z', toolCallId: 'call-1',
    block: { kind: 'plan_review', plan: '# 实施计划', path: 'plan.md',
      options: [{ label: '批准并实施', description: '开始编码' }] },
  }).block.kind).toBe('plan_review');
});
```

Add rejection tests for percent > 100 and invalid diff lines.

- [ ] **Step 2: Run tests to verify failure**

```powershell
pnpm vitest run src/shared/contracts.test.ts
```

Expected: FAIL because rich schemas do not exist.

- [ ] **Step 3: Implement contract schemas**

```ts
export type DesktopDisplayValue =
  | null | string | number | boolean
  | { type: 'array'; items: DesktopDisplayValue[]; truncated?: boolean }
  | { type: 'object'; entries: { key: string; value: DesktopDisplayValue }[]; truncated?: boolean };

export const DesktopDisplayValueSchema: z.ZodType<DesktopDisplayValue> = z.lazy(() => z.union([
  z.null(), z.string(), z.number(), z.boolean(),
  z.object({ type: z.literal('array'), items: z.array(DesktopDisplayValueSchema), truncated: z.boolean().optional() }),
  z.object({ type: z.literal('object'), entries: z.array(z.object({ key: z.string(), value: DesktopDisplayValueSchema })), truncated: z.boolean().optional() }),
]));
```

Define progress, diff and approval discriminated unions; extend tool/approval branches while retaining compatibility fields.

- [ ] **Step 4: Run tests and typecheck**

```powershell
pnpm vitest run src/shared/contracts.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/shared/contracts.ts src/shared/contracts.test.ts
git commit -m "feat: define rich execution contracts"
```

---

### Task 2: Bound open wire values safely

**Files:**
- Create: `src/main/server/display-value.ts`
- Create: `src/main/server/display-value.test.ts`

**Interfaces:**
- Produces: `toDesktopDisplayValue(value: unknown, limits?: DisplayValueLimits): DesktopDisplayValue | undefined`.

- [ ] **Step 1: Write failing tests**

```ts
it('does not recurse forever for circular objects', () => {
  const input: Record<string, unknown> = {};
  input.self = input;
  expect(toDesktopDisplayValue(input)).toEqual({ type: 'object', entries: [{ key: 'self', value: '[循环引用]' }] });
});

it('truncates long strings visibly', () => {
  expect(toDesktopDisplayValue('123456', { maxStringLength: 4 })).toBe('1234…');
});
```

Also test max depth, object entries and array items.

- [ ] **Step 2: Verify failure**

```powershell
pnpm vitest run src/main/server/display-value.test.ts
```

Expected: FAIL because module is missing.

- [ ] **Step 3: Implement defensive conversion**

```ts
export interface DisplayValueLimits {
  maxDepth?: number;
  maxEntries?: number;
  maxArrayItems?: number;
  maxStringLength?: number;
}

export function toDesktopDisplayValue(value: unknown, limits: DisplayValueLimits = {}): DesktopDisplayValue | undefined;
```

Defaults: depth 5, entries 80, array items 100, string length 20,000. Use `WeakSet<object>` for cycles and only enumerate own enumerable keys inside `try/catch`.

- [ ] **Step 4: Run focused tests**

```powershell
pnpm vitest run src/main/server/display-value.test.ts src/shared/contracts.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/main/server/display-value.ts src/main/server/display-value.test.ts
git commit -m "feat: bound structured execution values"
```

---

### Task 3: Project tool categories and safe file diffs

**Files:**
- Create: `src/main/server/diff-projector.ts`
- Create: `src/main/server/diff-projector.test.ts`
- Create: `src/main/server/tool-projector.ts`
- Create: `src/main/server/tool-projector.test.ts`

**Interfaces:**
- Produces: `projectToolFrame(frame: Record<string, unknown>): DesktopTimelineToolEntry | undefined`.
- Produces: `buildToolDiff(toolName: string, input: unknown, output: unknown, id: string): DesktopDiffTarget | undefined`.

- [ ] **Step 1: Write failing Diff tests**

```ts
it('builds an edit diff', () => {
  const diff = buildToolDiff('Edit', {
    path: 'src/app.ts', old_string: 'const value = 1;\n', new_string: 'const value = 2;\n',
  }, undefined, 'call-1');
  expect(diff?.lines).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: 'del', text: 'const value = 1;' }),
    expect.objectContaining({ type: 'add', text: 'const value = 2;' }),
  ]));
});

it('falls back when the matrix is too large', () => {
  const oldText = Array.from({ length: 600 }, (_, i) => `old-${i}`).join('\n');
  const newText = Array.from({ length: 600 }, (_, i) => `new-${i}`).join('\n');
  expect(buildToolDiff('Edit', { path: 'big.txt', old_string: oldText, new_string: newText }, 'changed', 'call-2'))
    .toMatchObject({ lines: [], truncated: true, fallbackOutput: 'changed' });
});
```

- [ ] **Step 2: Write failing classification tests**

```ts
it.each([
  ['Shell', { command: 'pnpm test', cwd: 'D:/repo' }, 'shell'],
  ['Read', { path: 'README.md' }, 'read'],
  ['Write', { path: 'a.ts', content: 'x' }, 'write'],
  ['Edit', { path: 'a.ts', old_string: 'a', new_string: 'b' }, 'edit'],
  ['Search', { query: 'needle' }, 'search'],
  ['Agent', { description: '检查测试' }, 'agent'],
])('classifies %s', (name, input, category) => {
  expect(projectToolFrame({ frameId: 'f', toolCallId: 'c', kind: 'tool', name, state: 'running', input })?.category).toBe(category);
});
```

- [ ] **Step 3: Verify failure**

```powershell
pnpm vitest run src/main/server/diff-projector.test.ts src/main/server/tool-projector.test.ts
```

Expected: FAIL because modules are missing.

- [ ] **Step 4: Implement capped line Diff**

Split lines and run LCS only when `oldLines.length * newLines.length <= 120_000`. Emit context/del/add rows with old/new numbers. Write with no old text becomes all additions. Append, multi-edit, replace-all or missing values return fallback-only target or `undefined`.

- [ ] **Step 5: Implement tool projection**

```ts
export function projectToolFrame(frame: Record<string, unknown>): DesktopTimelineToolEntry | undefined {
  const frameId = readString(frame.frameId);
  const name = readString(frame.name);
  const state = readToolState(frame.state);
  if (!frameId || !name || !state) return undefined;
  const input = asRecord(frame.input);
  const category = classifyTool(name, readString(frame.view));
  return {
    id: frameId, kind: 'tool', toolCallId: readString(frame.toolCallId), name, category, state,
    title: toolTitle(category), summary: toolSummary(category, input, state),
    inputText: readString(frame.inputText), input: toDesktopDisplayValue(frame.input),
    output: toDesktopDisplayValue(frame.output), error: readString(frame.error),
    progress: projectProgress(frame.progress),
    diff: buildToolDiff(name, frame.input, frame.output, readString(frame.toolCallId) ?? frameId),
  };
}
```

Normalize common aliases (`command`/`cmd`, `path`/`file_path`, `query`/`pattern`) and preserve unknown tools as generic.

- [ ] **Step 6: Run tests**

```powershell
pnpm vitest run src/main/server/diff-projector.test.ts src/main/server/tool-projector.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/main/server/diff-projector.ts src/main/server/diff-projector.test.ts src/main/server/tool-projector.ts src/main/server/tool-projector.test.ts
git commit -m "feat: project rich tool execution details"
```

---

### Task 4: Integrate rich transcript and approvals

**Files:**
- Modify: `src/main/server/transcript-projector.ts`
- Modify: `src/main/server/transcript-projector.test.ts`
- Modify: `src/main/server/kimi-client.test.ts`

**Interfaces:**
- Consumes: `projectToolFrame` and `DesktopApprovalBlock`.
- Produces: existing `projectTranscript()` with enriched timeline and approvals, no signature change.

- [ ] **Step 1: Add failing rich Transcript fixtures**

```ts
expect(result.timeline.map((entry) => entry.kind)).toEqual(['text', 'tool', 'text']);
expect(result.timeline[1]).toMatchObject({
  kind: 'tool', category: 'shell', toolCallId: 'call-1', command: 'Remove-Item sample.txt',
});
expect(result.approvals[0]).toMatchObject({
  toolCallId: 'call-1', block: { kind: 'shell', command: 'Remove-Item sample.txt' },
});
```

Add plan_review, diff, malformed request_display and legacy approval fixtures.

- [ ] **Step 2: Verify failure**

```powershell
pnpm vitest run src/main/server/transcript-projector.test.ts src/main/server/kimi-client.test.ts
```

Expected: FAIL because rich fields are discarded.

- [ ] **Step 3: Integrate projectors**

Use `projectToolFrame(frameRecord)` in `readTimeline`. Implement strict `readApprovalBlock()` for shell, diff, file, fileop, url, search, invocation, todo and plan_review; return generic for unknown or incomplete data. Read snake_case and camelCase anchors.

```ts
function readApprovalBlock(value: unknown, fallbackSummary: string): DesktopApprovalBlock {
  const record = asRecord(value);
  if (record?.kind === 'shell' && readString(record.command)) {
    return { kind: 'shell', command: readString(record.command)!, cwd: readString(record.cwd), danger: readString(record.danger) };
  }
  return { kind: 'generic', summary: fallbackSummary };
}
```

- [ ] **Step 4: Run regression tests**

```powershell
pnpm vitest run src/main/server/transcript-projector.test.ts src/main/server/kimi-client.test.ts src/main/server/live-task-feed.test.ts
pnpm typecheck
```

Expected: PASS, including legacy fixtures.

- [ ] **Step 5: Commit**

```powershell
git add src/main/server/transcript-projector.ts src/main/server/transcript-projector.test.ts src/main/server/kimi-client.test.ts
git commit -m "feat: preserve transcript approval context"
```

---

### Task 5: Add safe Windows review actions

**Files:**
- Modify: `src/shared/contracts.ts`
- Modify: `src/shared/contracts.test.ts`
- Modify: `src/main/ipc.ts`
- Modify: `src/main/ipc.test.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`

**Interfaces:**
- Produces `window.desktop.revealPath({ path }): Promise<void>`.
- Produces `window.desktop.copyText({ text }): Promise<void>`.

- [ ] **Step 1: Write failing tests**

```ts
it('rejects relative reveal paths', () => {
  expect(() => RevealPathRequestSchema.parse({ path: 'src/app.ts' })).toThrow();
});

it('reveals an existing absolute path', async () => {
  existsSyncMock.mockReturnValue(true);
  await handlers.get('desktop:reveal-path')?.({}, { path: 'D:\\repo\\src\\app.ts' });
  expect(showItemInFolderMock).toHaveBeenCalledWith('D:\\repo\\src\\app.ts');
});
```

Also test missing paths and a 200,000-character clipboard ceiling.

- [ ] **Step 2: Verify failure**

```powershell
pnpm vitest run src/shared/contracts.test.ts src/main/ipc.test.ts
```

Expected: FAIL because handlers do not exist.

- [ ] **Step 3: Implement schemas and handlers**

```ts
export const RevealPathRequestSchema = z.object({ path: z.string().min(1).refine(path.isAbsolute, '必须提供绝对路径') });
export const CopyTextRequestSchema = z.object({ text: z.string().max(200_000) });
```

Validate existence before `shell.showItemInFolder`, use Electron `clipboard.writeText`, and expose only parsed inputs in preload.

- [ ] **Step 4: Run tests**

```powershell
pnpm vitest run src/shared/contracts.test.ts src/main/ipc.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/shared/contracts.ts src/shared/contracts.test.ts src/main/ipc.ts src/main/ipc.test.ts src/preload/index.ts src/preload/index.d.ts
git commit -m "feat: expose safe review desktop actions"
```

---

### Task 6: Render structured tool cards

**Files:**
- Create: `src/renderer/components/workbench/StructuredValue.tsx`
- Create: `src/renderer/components/workbench/StructuredValue.test.tsx`
- Create: `src/renderer/components/workbench/ToolCallCard.tsx`
- Create: `src/renderer/components/workbench/ToolCallCard.test.tsx`
- Modify: `src/renderer/components/workbench/TaskTimeline.tsx`
- Modify: `src/renderer/components/workbench/WorkbenchShell.test.tsx`
- Modify: `src/renderer/styles.css`

**Interfaces:**
- Produces `ToolCallCard({ entry, onOpenDiff, onOpenTask })`.

- [ ] **Step 1: Write failing StructuredValue tests**

```tsx
render(<StructuredValue value={{ type: 'object', entries: [{ key: 'command', value: 'pnpm test' }] }} />);
expect(screen.getByText('command')).toBeInTheDocument();
expect(screen.getByText('pnpm test')).toBeInTheDocument();
```

Assert truncated values display “内容已截断”.

- [ ] **Step 2: Write failing ToolCallCard tests**

```tsx
render(<ToolCallCard entry={shellEntry} onOpenDiff={vi.fn()} onOpenTask={vi.fn()} />);
expect(screen.getByText('运行命令')).toBeInTheDocument();
expect(screen.getByText('pnpm test')).toBeInTheDocument();
await userEvent.click(screen.getByRole('button', { name: /查看详情/ }));
expect(screen.getByText('D:/repo')).toBeInTheDocument();
```

Add done/error/progress/generic and Diff callback cases.

- [ ] **Step 3: Verify failure**

```powershell
pnpm vitest run src/renderer/components/workbench/StructuredValue.test.tsx src/renderer/components/workbench/ToolCallCard.test.tsx
```

Expected: FAIL because components are missing.

- [ ] **Step 4: Implement components**

Use semantic buttons and `aria-expanded`. Running/error tools default expanded; completed tools default collapsed. Select Lucide icons by category and render command/path/query in compact monospace summary.

```tsx
export function ToolCallCard({ entry, onOpenDiff, onOpenTask }: ToolCallCardProps) {
  const [open, setOpen] = useState(entry.state !== 'done');
  return (
    <article className={`execution-card execution-card--${entry.state}`}>
      <button type="button" className="execution-card__summary" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {/* icon, localized title, summary, status */}
      </button>
      {open ? <div className="execution-card__details">{/* progress, fields, structured values */}</div> : null}
    </article>
  );
}
```

- [ ] **Step 5: Delegate old tool rendering from TaskTimeline**

Preserve text/thinking/notice order and auto-scroll; replace only the old tool `<details>` branch.

- [ ] **Step 6: Run tests**

```powershell
pnpm vitest run src/renderer/components/workbench/StructuredValue.test.tsx src/renderer/components/workbench/ToolCallCard.test.tsx src/renderer/components/workbench/WorkbenchShell.test.tsx
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/renderer/components/workbench/StructuredValue.tsx src/renderer/components/workbench/StructuredValue.test.tsx src/renderer/components/workbench/ToolCallCard.tsx src/renderer/components/workbench/ToolCallCard.test.tsx src/renderer/components/workbench/TaskTimeline.tsx src/renderer/components/workbench/WorkbenchShell.test.tsx src/renderer/styles.css
git commit -m "feat: render structured tool execution cards"
```

---

### Task 7: Add full Diff review panel

**Files:**
- Create: `src/renderer/components/workbench/DiffReviewPanel.tsx`
- Create: `src/renderer/components/workbench/DiffReviewPanel.test.tsx`
- Modify: `src/renderer/components/workbench/WorkbenchShell.tsx`
- Modify: `src/renderer/components/workbench/WorkbenchShell.test.tsx`
- Modify: `src/renderer/components/workbench/ContextDock.tsx`
- Modify: `src/renderer/components/workbench/ContextDock.test.tsx`
- Modify: `src/renderer/styles.css`

**Interfaces:**
- Produces `DiffReviewPanel({ target, onClose, onCopyPath, onCopyDiff, onRevealPath })`.
- Workbench owns `selectedDiff: DesktopDiffTarget | undefined`.

- [ ] **Step 1: Write failing tests**

```tsx
render(<DiffReviewPanel target={target} onClose={onClose} onCopyPath={onCopyPath} onCopyDiff={onCopyDiff} onRevealPath={onRevealPath} />);
expect(screen.getByText('src/app.ts')).toBeInTheDocument();
expect(screen.getByText('+1')).toBeInTheDocument();
expect(screen.getByText('-1')).toBeInTheDocument();
await userEvent.click(screen.getByRole('button', { name: '在资源管理器中显示' }));
expect(onRevealPath).toHaveBeenCalledWith('D:/repo/src/app.ts');
```

Test fallback output and truncated warning.

- [ ] **Step 2: Verify failure**

```powershell
pnpm vitest run src/renderer/components/workbench/DiffReviewPanel.test.tsx src/renderer/components/workbench/WorkbenchShell.test.tsx
```

Expected: FAIL because panel is missing.

- [ ] **Step 3: Implement Diff panel**

Render old/new gutters, line prefixes, add/delete/context/hunk classes, stats, copy/reveal actions and close button. Build unified copy text from lines.

- [ ] **Step 4: Integrate Workbench selection**

Opening the same target toggles it closed. When selected, right dock displays Diff panel; otherwise ContextDock. Use:

```ts
await window.desktop.copyText({ text });
await window.desktop.revealPath({ path });
```

Catch errors through existing workbench error state without closing the panel.

- [ ] **Step 5: Run tests**

```powershell
pnpm vitest run src/renderer/components/workbench/DiffReviewPanel.test.tsx src/renderer/components/workbench/WorkbenchShell.test.tsx src/renderer/components/workbench/ContextDock.test.tsx
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/renderer/components/workbench/DiffReviewPanel.tsx src/renderer/components/workbench/DiffReviewPanel.test.tsx src/renderer/components/workbench/WorkbenchShell.tsx src/renderer/components/workbench/WorkbenchShell.test.tsx src/renderer/components/workbench/ContextDock.tsx src/renderer/components/workbench/ContextDock.test.tsx src/renderer/styles.css
git commit -m "feat: add file diff review panel"
```

---

### Task 8: Anchor approvals and support plan review

**Files:**
- Create: `src/renderer/components/workbench/InlineApprovalCard.tsx`
- Create: `src/renderer/components/workbench/InlineApprovalCard.test.tsx`
- Modify: `src/renderer/components/workbench/TaskTimeline.tsx`
- Modify: `src/renderer/components/workbench/WorkbenchShell.tsx`
- Modify: `src/renderer/components/workbench/WorkbenchShell.test.tsx`
- Modify: `src/renderer/components/workbench/ContextDock.tsx`
- Modify: `src/renderer/components/workbench/ContextDock.test.tsx`
- Modify: `src/renderer/hooks/useWorkbench.ts`
- Modify: `src/renderer/hooks/useWorkbench.test.tsx`
- Modify: `src/renderer/styles.css`

**Interfaces:**
- Produces `InlineApprovalCard({ approval, pending, onDecision, onOpenDiff })`.
- Extends approval callbacks with optional feedback and selected label.

- [ ] **Step 1: Write failing tests**

```tsx
render(<InlineApprovalCard approval={shellApproval} pending={false} onDecision={onDecision} onOpenDiff={vi.fn()} />);
expect(screen.getByText('Remove-Item sample.txt')).toBeInTheDocument();
await userEvent.type(screen.getByLabelText('反馈（可选）'), '确认路径后执行');
await userEvent.click(screen.getByRole('button', { name: '批准' }));
expect(onDecision).toHaveBeenCalledWith('approved', '确认路径后执行', undefined);
```

Plan review:

```tsx
await userEvent.click(screen.getByRole('button', { name: '批准并实施' }));
expect(onDecision).toHaveBeenCalledWith('approved', undefined, '批准并实施');
```

Add reject, pending disabled, diff preview and generic tests.

- [ ] **Step 2: Verify failure**

```powershell
pnpm vitest run src/renderer/components/workbench/InlineApprovalCard.test.tsx
```

Expected: FAIL because component is missing.

- [ ] **Step 3: Implement type-specific cards**

Render Shell command, file path, URL/search, Todo, plan Markdown through `RichText`, Diff compact preview and generic summary. Keep feedback draft after failed submission.

- [ ] **Step 4: Add pending state to useWorkbench**

```ts
const respondApproval = useCallback(async (approvalId: string, decision: 'approved' | 'rejected', feedback?: string, selectedLabel?: string): Promise<boolean> => {
  setPendingApprovalIds((current) => [...current, approvalId]);
  try {
    await window.desktop.respondApproval({ sessionId, approvalId, decision, feedback, selectedLabel });
    await Promise.all([refreshOverview(), refreshSnapshot(sessionId)]);
    return true;
  } catch {
    setError('无法提交审批决定，请重试。');
    return false;
  } finally {
    setPendingApprovalIds((current) => current.filter((id) => id !== approvalId));
  }
}, [refreshOverview, refreshSnapshot]);
```

- [ ] **Step 5: Anchor approvals in TaskTimeline**

Map approvals by `toolCallId`, render anchored cards after the tool, and render unanchored approvals once at the tail.

- [ ] **Step 6: Compact ContextDock approval summary**

Do not duplicate full cards. Use rows that focus DOM id `approval-${id}`. Questions remain fully operable.

- [ ] **Step 7: Run tests**

```powershell
pnpm vitest run src/renderer/components/workbench/InlineApprovalCard.test.tsx src/renderer/components/workbench/WorkbenchShell.test.tsx src/renderer/components/workbench/ContextDock.test.tsx src/renderer/hooks/useWorkbench.test.tsx
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add src/renderer/components/workbench/InlineApprovalCard.tsx src/renderer/components/workbench/InlineApprovalCard.test.tsx src/renderer/components/workbench/TaskTimeline.tsx src/renderer/components/workbench/WorkbenchShell.tsx src/renderer/components/workbench/WorkbenchShell.test.tsx src/renderer/components/workbench/ContextDock.tsx src/renderer/components/workbench/ContextDock.test.tsx src/renderer/hooks/useWorkbench.ts src/renderer/hooks/useWorkbench.test.tsx src/renderer/styles.css
git commit -m "feat: anchor rich approvals in task timeline"
```

---

### Task 9: Improve background activity and review polish

**Files:**
- Modify: `src/renderer/components/workbench/ContextDock.tsx`
- Modify: `src/renderer/components/workbench/ContextDock.test.tsx`
- Modify: `src/renderer/components/workbench/ToolCallCard.tsx`
- Modify: `src/renderer/components/workbench/ToolCallCard.test.tsx`
- Modify: `src/renderer/components/workbench/WorkbenchShell.tsx`
- Modify: `src/renderer/components/workbench/WorkbenchShell.test.tsx`
- Modify: `src/renderer/styles.css`

**Interfaces:**
- Consumes `DesktopTask`, `DesktopTodo`, `taskId`, `agentRefs`.
- Produces compact Todo progress, Chinese task state labels and selected task detail.

- [ ] **Step 1: Add failing tests**

```tsx
expect(screen.getByText('待办 2 / 3')).toBeInTheDocument();
expect(screen.getByText('子 Agent')).toBeInTheDocument();
await userEvent.click(screen.getByRole('button', { name: /检查测试/ }));
expect(screen.getByText('输出尾部')).toBeInTheDocument();
```

Test all task states map to Chinese labels and errors do not expose raw enum-only copy.

- [ ] **Step 2: Verify failure**

```powershell
pnpm vitest run src/renderer/components/workbench/ContextDock.test.tsx src/renderer/components/workbench/ToolCallCard.test.tsx src/renderer/components/workbench/WorkbenchShell.test.tsx
```

Expected: FAIL because activity detail UX is missing.

- [ ] **Step 3: Implement progress and task details**

Add completed/total summary and progress bar. Render task kind/state in Chinese, output tail in monospace, errors in alert styling and agent references as subordinate badges. Reuse the right detail panel state model.

- [ ] **Step 4: Run renderer regression tests**

```powershell
pnpm vitest run src/renderer/components/workbench
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/renderer/components/workbench/ContextDock.tsx src/renderer/components/workbench/ContextDock.test.tsx src/renderer/components/workbench/ToolCallCard.tsx src/renderer/components/workbench/ToolCallCard.test.tsx src/renderer/components/workbench/WorkbenchShell.tsx src/renderer/components/workbench/WorkbenchShell.test.tsx src/renderer/styles.css
git commit -m "feat: clarify background execution activity"
```

---

### Task 10: Prepare and verify the 0.4.0 release

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify if generated: `pnpm-lock.yaml`

**Interfaces:**
- Produces Windows setup, portable archive and checksums under `release/0.4.0`.

- [ ] **Step 1: Update version and README**

Set package version to `0.4.0`. Document rich tool cards, inline approvals, plan review, Diff panel, Windows reveal action, CLI 0.30/0.31 compatibility and upstream attribution.

- [ ] **Step 2: Run complete verification**

```powershell
pnpm typecheck
pnpm test
git diff --check
pnpm build
```

Expected: typecheck PASS, all Vitest files PASS, diff check empty, Electron builder creates `release/0.4.0`.

- [ ] **Step 3: Perform Windows smoke checks**

```text
- Packaged EXE starts without black screen.
- Existing CLI 0.30.0 service connects.
- Legacy text/tool tasks still render.
- Shell task displays command/progress/output.
- File edit exposes Diff review.
- Approval submits once and retains feedback after failure.
- Plan review submits selected_label.
- Reveal path opens Explorer for a real file.
- Closing app shows custom confirmation and stops desktop-started CLI service.
```

Do not overwrite the user's installed CLI to test 0.31.0; use an isolated executable or temporary package invocation.

- [ ] **Step 4: Commit release preparation**

```powershell
git add package.json pnpm-lock.yaml README.md
git commit -m "chore: prepare 0.4.0 release"
```

- [ ] **Step 5: Final branch audit**

```powershell
git status --short
git log --oneline main..HEAD
git diff --stat main...HEAD
git -C <上游仓库路径> status --short
```

Expected: desktop tree clean, focused commits only, no scratch files, parent upstream working tree unchanged.
