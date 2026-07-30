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

export const SessionIdSchema = z.string().min(1).max(200);

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
  permission: z.enum(['manual', 'yolo', 'auto']).optional(),
  mainTurnActive: z.boolean().optional(),
});

export type DesktopSession = z.infer<typeof DesktopSessionSchema>;

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
});

export type DesktopModel = z.infer<typeof DesktopModelSchema>;

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

export const DesktopTimelineEntrySchema = z.discriminatedUnion('kind', [
  z.object({
    id: z.string().min(1),
    kind: z.literal('text'),
    role: z.enum(['user', 'assistant']),
    text: z.string(),
    state: z.enum(['complete', 'streaming']),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal('thinking'),
    text: z.string(),
    state: z.enum(['complete', 'streaming']),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal('tool'),
    name: z.string().min(1),
    state: z.enum(['running', 'done', 'error']),
    summary: z.string(),
    output: z.string().optional(),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal('notice'),
    level: z.enum(['info', 'warning', 'error']),
    text: z.string(),
  }),
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
  error: z.string().optional(),
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
});

export type DesktopTask = z.infer<typeof DesktopTaskSchema>;

export const DesktopApprovalSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('approval'),
  toolName: z.string().min(1),
  action: z.string(),
  summary: z.string(),
  createdAt: z.string(),
  expiresAt: z.string().optional(),
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
  permission: z.enum(['manual', 'yolo', 'auto']).optional(),
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
