import { z } from 'zod';

export const CliDiscoverySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('checking') }),
  z.object({ kind: z.literal('missing') }),
  z.object({ kind: z.literal('invalid'), command: z.string(), message: z.string() }),
  z.object({ kind: z.literal('ready'), command: z.string(), version: z.string() }),
]);

export type CliDiscovery = z.infer<typeof CliDiscoverySchema>;

export const ServerStatusSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('idle') }),
  z.object({ kind: z.literal('starting'), command: z.string() }),
  z.object({ kind: z.literal('connected'), origin: z.string() }),
  z.object({ kind: z.literal('failed'), message: z.string() }),
]);

export type ServerStatus = z.infer<typeof ServerStatusSchema>;

export const DesktopStatusSchema = z.object({
  cli: CliDiscoverySchema,
  server: ServerStatusSchema,
});

export type DesktopStatus = z.infer<typeof DesktopStatusSchema>;

export const ThemePreferenceSchema = z.enum(['system', 'light', 'dark']);
export type ThemePreference = z.infer<typeof ThemePreferenceSchema>;

export const ResolvedThemeSchema = z.enum(['light', 'dark']);
export type ResolvedTheme = z.infer<typeof ResolvedThemeSchema>;

export const DesktopThemeSnapshotSchema = z.object({
  preference: ThemePreferenceSchema,
  resolved: ResolvedThemeSchema,
});
export type DesktopThemeSnapshot = z.infer<typeof DesktopThemeSnapshotSchema>;

export const SetThemeRequestSchema = z.object({ preference: ThemePreferenceSchema });
export type SetThemeRequest = z.infer<typeof SetThemeRequestSchema>;

export const CliInstallSourceSchema = z.enum([
  'npm-global',
  'pnpm-global',
  'yarn-global',
  'bun-global',
  'native',
  'unsupported',
]);
export type CliInstallSource = z.infer<typeof CliInstallSourceSchema>;

export const CliUpdatePhaseSchema = z.enum([
  'idle',
  'checking',
  'current',
  'available',
  'awaiting-confirmation',
  'stopping-service',
  'installing',
  'verifying',
  'restarting-service',
  'succeeded',
  'failed',
]);
export type CliUpdatePhase = z.infer<typeof CliUpdatePhaseSchema>;

export const DesktopCliUpdateSnapshotSchema = z.object({
  phase: CliUpdatePhaseSchema,
  currentVersion: z.string().min(1).optional(),
  latestVersion: z.string().min(1).optional(),
  checkedAt: z.string().optional(),
  installSource: CliInstallSourceSchema.optional(),
  installCommand: z.string().min(1).optional(),
  canAutoInstall: z.boolean(),
  updateAvailable: z.boolean(),
  error: z.string().min(1).optional(),
  detail: z.string().optional(),
});
export type DesktopCliUpdateSnapshot = z.infer<typeof DesktopCliUpdateSnapshotSchema>;

export const CheckCliUpdateRequestSchema = z.object({ force: z.boolean().default(false) });
export type CheckCliUpdateRequest = z.infer<typeof CheckCliUpdateRequestSchema>;

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
export type DesktopCapabilities = z.infer<typeof DesktopCapabilitiesSchema>;

export const DesktopCapabilitySnapshotSchema = z.object({
  phase: z.enum(['idle', 'detecting', 'ready']),
  desktopVersion: z.string().min(1),
  cliVersion: z.string().min(1).optional(),
  serverVersion: z.string().min(1).optional(),
  checkedAt: z.string().optional(),
  compatibilityMode: z.boolean(),
  capabilities: DesktopCapabilitiesSchema,
});
export type DesktopCapabilitySnapshot = z.infer<typeof DesktopCapabilitySnapshotSchema>;
export type DesktopCapabilityKey = keyof DesktopCapabilitySnapshot['capabilities'];

export const SessionIdSchema = z.string().min(1).max(200);

export const DesktopPermissionModeSchema = z.enum(['manual', 'yolo', 'auto']);
export type DesktopPermissionMode = z.infer<typeof DesktopPermissionModeSchema>;

export const DesktopWorkspaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  root: z.string().min(1),
  sessionCount: z.number().int().nonnegative(),
});

export type DesktopWorkspace = z.infer<typeof DesktopWorkspaceSchema>;

export const WorkspaceRootRequestSchema = z.object({
  root: z.string().min(1),
});

export type WorkspaceRootRequest = z.infer<typeof WorkspaceRootRequestSchema>;

export const CreateWorkspaceFolderRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
});
export type CreateWorkspaceFolderRequest = z.infer<typeof CreateWorkspaceFolderRequestSchema>;

export const RenameWorkspaceRequestSchema = z.object({
  workspaceId: z.string().min(1).max(200),
  name: z.string().trim().min(1).max(120),
});
export type RenameWorkspaceRequest = z.infer<typeof RenameWorkspaceRequestSchema>;

export const RemoveWorkspaceRequestSchema = z.object({
  workspaceId: z.string().min(1).max(200),
});
export type RemoveWorkspaceRequest = z.infer<typeof RemoveWorkspaceRequestSchema>;

export const ListSessionsRequestSchema = z.object({
  workspaceId: z.string().min(1).max(200).optional(),
  beforeId: z.string().min(1).max(200).optional(),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export type ListSessionsRequest = z.infer<typeof ListSessionsRequestSchema>;

export const DesktopSessionSchema = z.object({
  id: SessionIdSchema,
  title: z.string(),
  updatedAt: z.string(),
  busy: z.boolean(),
  cwd: z.string(),
  lastPrompt: z.string().optional(),
  workspaceId: z.string().min(1).optional(),
  pendingInteraction: z.enum(['none', 'approval', 'question']).optional(),
  lastTurnReason: z.enum(['completed', 'cancelled', 'failed']).optional(),
  model: z.string().min(1).optional(),
  permission: DesktopPermissionModeSchema.optional(),
  mainTurnActive: z.boolean().optional(),
});

export type DesktopSession = z.infer<typeof DesktopSessionSchema>;

export const DesktopSessionPageSchema = z.object({
  items: z.array(DesktopSessionSchema),
  hasMore: z.boolean(),
});
export type DesktopSessionPage = z.infer<typeof DesktopSessionPageSchema>;

export const DesktopMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'tool', 'system']),
  text: z.string(),
  createdAt: z.string(),
});

export type DesktopMessage = z.infer<typeof DesktopMessageSchema>;

export const DesktopModelSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  provider: z.string().min(1),
  contextWindow: z.number().int().positive().optional(),
  capabilities: z.array(z.string()).optional(),
  supportEfforts: z.array(z.string().min(1)).optional(),
  defaultEffort: z.string().min(1).optional(),
  adaptiveThinking: z.boolean().optional(),
});

export type DesktopModel = z.infer<typeof DesktopModelSchema>;

export const DesktopSessionWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(['info', 'warning', 'error']),
});
export type DesktopSessionWarning = z.infer<typeof DesktopSessionWarningSchema>;

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
export type DesktopSessionRuntime = z.infer<typeof DesktopSessionRuntimeSchema>;

export const UpdateRuntimeRequestSchema = z.object({
  sessionId: SessionIdSchema,
  model: z.string().trim().min(1).max(200).optional(),
  thinkingLevel: z.string().trim().min(1).max(80).optional(),
  permission: DesktopPermissionModeSchema.optional(),
  planMode: z.boolean().optional(),
}).refine(({ model, thinkingLevel, permission, planMode }) =>
  model !== undefined || thinkingLevel !== undefined || permission !== undefined || planMode !== undefined,
  '必须提供至少一项运行策略更新',
);
export type UpdateRuntimeRequest = z.infer<typeof UpdateRuntimeRequestSchema>;

export const CompactSessionRequestSchema = z.object({
  sessionId: SessionIdSchema,
  instruction: z.string().trim().min(1).max(10_000).optional(),
});
export type CompactSessionRequest = z.infer<typeof CompactSessionRequestSchema>;

export const UndoSessionRequestSchema = z.object({
  sessionId: SessionIdSchema,
  count: z.literal(1).default(1),
});
export type UndoSessionRequest = z.infer<typeof UndoSessionRequestSchema>;

export const ForkSessionRequestSchema = z.object({
  sessionId: SessionIdSchema,
  title: z.string().trim().min(1).max(200).optional(),
});
export type ForkSessionRequest = z.infer<typeof ForkSessionRequestSchema>;

export const RestoreSessionRequestSchema = z.object({
  sessionId: SessionIdSchema,
});
export type RestoreSessionRequest = z.infer<typeof RestoreSessionRequestSchema>;


export const PromptRequestSchema = z.object({
  sessionId: SessionIdSchema,
  text: z.string().trim().min(1).max(100_000),
  model: z.string().trim().min(1).max(200),
});

export type PromptRequest = z.infer<typeof PromptRequestSchema>;

export const CreateTaskRequestSchema = z.discriminatedUnion('target', [
  z.object({
    target: z.literal('workspace'),
    workspaceId: z.string().min(1),
    title: z.string().trim().min(1).max(200).optional(),
  }),
  z.object({
    target: z.literal('folder'),
    cwd: z.string().min(1),
    title: z.string().trim().min(1).max(200).optional(),
  }),
]);

export type CreateTaskRequest = z.infer<typeof CreateTaskRequestSchema>;

export const RenameSessionRequestSchema = z.object({
  sessionId: SessionIdSchema,
  title: z.string().trim().min(1).max(200),
});

export type RenameSessionRequest = z.infer<typeof RenameSessionRequestSchema>;

export type DesktopDisplayValue =
  | null
  | string
  | number
  | boolean
  | { type: 'array'; items: DesktopDisplayValue[]; truncated?: boolean }
  | { type: 'object'; entries: { key: string; value: DesktopDisplayValue }[]; truncated?: boolean };

export const DesktopDisplayValueSchema: z.ZodType<DesktopDisplayValue> = z.lazy(() => z.union([
  z.null(), z.string(), z.number(), z.boolean(),
  z.object({ type: z.literal('array'), items: z.array(DesktopDisplayValueSchema), truncated: z.boolean().optional() }),
  z.object({
    type: z.literal('object'),
    entries: z.array(z.object({ key: z.string(), value: DesktopDisplayValueSchema })),
    truncated: z.boolean().optional(),
  }),
]));

export const DesktopToolProgressSchema = z.object({
  kind: z.enum(['stdout', 'stderr', 'progress', 'status', 'custom']),
  text: z.string().optional(),
  percent: z.number().min(0).max(100).optional(),
  customKind: z.string().optional(),
  customData: DesktopDisplayValueSchema.optional(),
});
export type DesktopToolProgress = z.infer<typeof DesktopToolProgressSchema>;

export const DesktopDiffLineSchema = z.object({
  type: z.enum(['add', 'del', 'context', 'hunk']),
  text: z.string(),
  oldNo: z.number().int().positive().optional(),
  newNo: z.number().int().positive().optional(),
});
export type DesktopDiffLine = z.infer<typeof DesktopDiffLineSchema>;

export const DesktopDiffTargetSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  path: z.string().min(1).optional(),
  lines: z.array(DesktopDiffLineSchema),
  fallbackOutput: z.string().optional(),
  truncated: z.boolean().optional(),
});
export type DesktopDiffTarget = z.infer<typeof DesktopDiffTargetSchema>;

export const DesktopAgentRefSchema = z.object({
  agentId: z.string().min(1),
  role: z.enum(['child', 'member']).optional(),
});
export type DesktopAgentRef = z.infer<typeof DesktopAgentRefSchema>;

export const DesktopTimelineToolEntrySchema = z.object({
  id: z.string().min(1),
  kind: z.literal('tool'),
  toolCallId: z.string().min(1).optional(),
  name: z.string().min(1),
  view: z.string().min(1).optional(),
  category: z.enum(['shell', 'read', 'write', 'edit', 'search', 'web', 'agent', 'task', 'todo', 'generic']).optional(),
  state: z.enum(['running', 'done', 'error']),
  title: z.string().min(1).optional(),
  summary: z.string(),
  inputText: z.string().optional(),
  input: DesktopDisplayValueSchema.optional(),
  output: DesktopDisplayValueSchema.optional(),
  error: z.string().optional(),
  progress: DesktopToolProgressSchema.optional(),
  path: z.string().optional(),
  command: z.string().optional(),
  cwd: z.string().optional(),
  query: z.string().optional(),
  approvalId: z.string().min(1).optional(),
  taskId: z.string().min(1).optional(),
  todoId: z.string().min(1).optional(),
  agentRefs: z.array(DesktopAgentRefSchema).optional(),
  diff: DesktopDiffTargetSchema.optional(),
});
export type DesktopTimelineToolEntry = z.infer<typeof DesktopTimelineToolEntrySchema>;

export const DesktopTimelineEntrySchema = z.discriminatedUnion('kind', [
  z.object({ id: z.string().min(1), kind: z.literal('text'), role: z.enum(['user', 'assistant']), text: z.string(), state: z.enum(['complete', 'streaming']) }),
  z.object({ id: z.string().min(1), kind: z.literal('thinking'), text: z.string(), state: z.enum(['complete', 'streaming']) }),
  DesktopTimelineToolEntrySchema,
  z.object({ id: z.string().min(1), kind: z.literal('notice'), level: z.enum(['info', 'warning', 'error']), text: z.string() }),
]);

export type DesktopTimelineEntry = z.infer<typeof DesktopTimelineEntrySchema>;
export const DesktopTodoSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(['pending', 'in_progress', 'done']),
});

export type DesktopTodo = z.infer<typeof DesktopTodoSchema>;

export const DesktopTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(['shell', 'subagent', 'tool', 'other']),
  state: z.enum(['running', 'completed', 'failed', 'timed_out', 'killed', 'lost']),
  outputTail: z.string(),
  detached: z.boolean().optional(),
  agentId: z.string().min(1).optional(),
  resultSummary: z.string().optional(),
  error: z.string().optional(),
  stateReason: z.string().optional(),
  activityHint: z.enum(['snapshot', 'waiting_notification']).optional(),
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type DesktopTask = z.infer<typeof DesktopTaskSchema>;

export const DesktopApprovalBlockSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('shell'), command: z.string().min(1), cwd: z.string().optional(), danger: z.string().optional() }),
  z.object({ kind: z.literal('diff'), path: z.string().min(1), diff: z.array(DesktopDiffLineSchema) }),
  z.object({ kind: z.literal('file'), path: z.string().min(1), content: z.string(), language: z.string().optional() }),
  z.object({ kind: z.literal('fileop'), op: z.string().min(1), path: z.string().min(1), detail: z.string().optional() }),
  z.object({ kind: z.literal('url'), method: z.string().optional(), url: z.string().min(1) }),
  z.object({ kind: z.literal('search'), query: z.string().min(1), scope: z.string().optional() }),
  z.object({ kind: z.literal('invocation'), kind2: z.string().min(1), name: z.string().min(1), description: z.string().optional() }),
  z.object({ kind: z.literal('todo'), items: z.array(z.object({ title: z.string().min(1), status: z.string().min(1) })) }),
  z.object({
    kind: z.literal('plan_review'),
    plan: z.string().min(1),
    path: z.string().optional(),
    options: z.array(z.object({ label: z.string().min(1), description: z.string().optional() })).optional(),
  }),
  z.object({ kind: z.literal('generic'), summary: z.string() }),
]);
export type DesktopApprovalBlock = z.infer<typeof DesktopApprovalBlockSchema>;

export const DesktopApprovalSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('approval'),
  toolName: z.string().min(1),
  action: z.string(),
  summary: z.string(),
  createdAt: z.string(),
  expiresAt: z.string().optional(),
  toolCallId: z.string().min(1).optional(),
  agentId: z.string().min(1).optional(),
  block: DesktopApprovalBlockSchema.optional(),
});

export type DesktopApproval = z.infer<typeof DesktopApprovalSchema>;
export const DesktopQuestionOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
});

export const DesktopQuestionItemSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  header: z.string().optional(),
  body: z.string().optional(),
  options: z.array(DesktopQuestionOptionSchema).min(2).max(4),
  multiSelect: z.boolean().optional(),
  allowOther: z.boolean().optional(),
  otherLabel: z.string().optional(),
  otherDescription: z.string().optional(),
});

export const DesktopQuestionSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('question'),
  questions: z.array(DesktopQuestionItemSchema).min(1).max(4),
  createdAt: z.string(),
});

export type DesktopQuestion = z.infer<typeof DesktopQuestionSchema>;

export const DesktopTaskStatusSchema = z.object({
  model: z.string().min(1).optional(),
  permission: DesktopPermissionModeSchema.optional(),
  phase: z.enum(['idle', 'running', 'streaming', 'tool', 'awaiting_approval', 'interrupted', 'ended', 'unknown']),
  contextUsage: z.number().min(0).max(1).optional(),
});

export type DesktopTaskStatus = z.infer<typeof DesktopTaskStatusSchema>;

export const DesktopTaskSnapshotSchema = z.object({
  session: DesktopSessionSchema,
  agentId: z.string().min(1),
  timeline: z.array(DesktopTimelineEntrySchema),
  todos: z.array(DesktopTodoSchema),
  tasks: z.array(DesktopTaskSchema),
  approvals: z.array(DesktopApprovalSchema),
  questions: z.array(DesktopQuestionSchema),
  status: DesktopTaskStatusSchema,
  seq: z.number().int().nonnegative().optional(),
});

export type DesktopTaskSnapshot = z.infer<typeof DesktopTaskSnapshotSchema>;

export const TaskWatchRequestSchema = z.object({
  sessionId: SessionIdSchema,
  agentId: z.string().min(1),
});

export type TaskWatchRequest = z.infer<typeof TaskWatchRequestSchema>;

export const DesktopTaskEventSchema = z.object({
  sessionId: SessionIdSchema,
  kind: z.literal('refresh'),
  seq: z.number().int().nonnegative().optional(),
});

export type DesktopTaskEvent = z.infer<typeof DesktopTaskEventSchema>;

export const ApprovalDecisionRequestSchema = z.object({
  sessionId: SessionIdSchema,
  approvalId: z.string().min(1),
  decision: z.enum(['approved', 'rejected', 'cancelled']),
  feedback: z.string().max(10_000).optional(),
  selectedLabel: z.string().max(1_000).optional(),
});

export type ApprovalDecisionRequest = z.infer<typeof ApprovalDecisionRequestSchema>;

const QuestionAnswerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('single'), optionId: z.string().min(1) }),
  z.object({ kind: z.literal('multi'), optionIds: z.array(z.string().min(1)).min(1) }),
  z.object({ kind: z.literal('other'), text: z.string() }),
  z.object({ kind: z.literal('multi_with_other'), optionIds: z.array(z.string().min(1)), otherText: z.string() }),
  z.object({ kind: z.literal('skipped') }),
]);

export const QuestionResponseRequestSchema = z.object({
  sessionId: SessionIdSchema,
  questionId: z.string().min(1),
  answers: z.record(z.string().min(1), QuestionAnswerSchema),
  note: z.string().max(10_000).optional(),
});

export type QuestionResponseRequest = z.infer<typeof QuestionResponseRequestSchema>;

export const QuestionDismissRequestSchema = z.object({
  sessionId: SessionIdSchema,
  questionId: z.string().min(1),
});

export type QuestionDismissRequest = z.infer<typeof QuestionDismissRequestSchema>;
function isAbsoluteDesktopPath(value: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('/') || value.startsWith('\\\\');
}

export const RevealPathRequestSchema = z.object({
  path: z.string().min(1).refine(isAbsoluteDesktopPath, '必须提供绝对路径'),
});
export type RevealPathRequest = z.infer<typeof RevealPathRequestSchema>;

export const CopyTextRequestSchema = z.object({
  text: z.string().max(200_000),
});
export type CopyTextRequest = z.infer<typeof CopyTextRequestSchema>;
