import type { DesktopTimelineToolEntry, DesktopToolProgress } from '../../shared/contracts';
import { buildToolDiff } from './diff-projector';
import { toDesktopDisplayValue } from './display-value';

type ToolCategory = NonNullable<DesktopTimelineToolEntry['category']>;

export function projectToolFrame(frame: Record<string, unknown>): DesktopTimelineToolEntry | undefined {
  const id = readString(frame.frameId);
  const name = readString(frame.name);
  const state = readState(frame.state);
  if (!id || !name || !state) return undefined;

  const input = asRecord(frame.input);
  const category = classifyTool(name, readString(frame.view));
  const toolCallId = readString(frame.toolCallId) ?? readString(frame.tool_call_id);
  return {
    id,
    kind: 'tool',
    toolCallId,
    name,
    view: readString(frame.view),
    category,
    state,
    title: toolTitle(category, name),
    summary: toolSummary(category, name, input, state),
    inputText: readString(frame.inputText) ?? readString(frame.input_text),
    input: toDesktopDisplayValue(frame.input),
    output: toDesktopDisplayValue(frame.output),
    error: readString(frame.error),
    progress: projectProgress(frame.progress),
    path: readFirstString(input, ['path', 'file_path', 'filePath']),
    command: readFirstString(input, ['command', 'cmd']),
    cwd: readFirstString(input, ['cwd', 'working_directory', 'workingDirectory']),
    query: readFirstString(input, ['query', 'pattern', 'search']),
    approvalId: readString(frame.approvalId) ?? readString(frame.approval_id),
    taskId: readString(frame.taskId) ?? readString(frame.task_id),
    todoId: readString(frame.todoId) ?? readString(frame.todo_id),
    agentRefs: readAgentRefs(frame.agentRefs ?? frame.agent_refs),
    diff: buildToolDiff(name, frame.input, frame.output ?? frame.error, toolCallId ?? id),
  };
}

function classifyTool(name: string, view?: string): ToolCategory {
  const value = `${view ?? ''} ${name}`.toLowerCase();
  if (/(shell|bash|terminal|command|powershell)/.test(value)) return 'shell';
  if (/(todo)/.test(value)) return 'todo';
  if (/(taskoutput|task_output|background)/.test(value)) return 'task';
  if (/(agentswarm|agent_swarm|agent|subagent|swarm)/.test(value)) return 'agent';
  if (/(web|url|fetch|http|browser)/.test(value)) return 'web';
  if (/(search|grep|glob|find)/.test(value)) return 'search';
  if (/(edit|patch|replace)/.test(value)) return 'edit';
  if (/(write|createfile|create_file)/.test(value)) return 'write';
  if (/(read|cat|viewfile|view_file)/.test(value)) return 'read';
  return 'generic';
}

function toolTitle(category: ToolCategory, name: string): string {
  const titles: Record<ToolCategory, string> = {
    shell: '运行命令',
    read: '读取文件',
    write: '写入文件',
    edit: '编辑文件',
    search: '搜索内容',
    web: '访问网络',
    agent: '委派子 Agent',
    task: '检查后台任务',
    todo: '更新待办',
    generic: name,
  };
  return titles[category];
}

function toolSummary(category: ToolCategory, name: string, input: Record<string, unknown> | undefined, state: DesktopTimelineToolEntry['state']): string {
  const preferred = category === 'shell'
    ? readFirstString(input, ['command', 'cmd'])
    : category === 'search'
      ? readFirstString(input, ['query', 'pattern', 'search'])
      : category === 'agent'
        ? readFirstString(input, ['description', 'prompt', 'task'])
        : category === 'task'
          ? readFirstString(input, ['task_id', 'taskId'])
          : readFirstString(input, ['path', 'file_path', 'filePath', 'url']);
  if (preferred) return preferred;
  if (state === 'running') return `正在运行 ${name}`;
  if (state === 'done') return `${name} 已完成`;
  return `${name} 运行失败`;
}

function projectProgress(value: unknown): DesktopToolProgress | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const rawKind = readString(record.kind);
  const kind: DesktopToolProgress['kind'] = rawKind === 'stdout' || rawKind === 'stderr' || rawKind === 'progress' || rawKind === 'status' || rawKind === 'custom'
    ? rawKind
    : 'custom';
  const rawPercent = readNumber(record.percent);
  const percent = rawPercent === undefined ? undefined : Math.max(0, Math.min(100, rawPercent <= 1 ? rawPercent * 100 : rawPercent));
  return {
    kind,
    text: readString(record.text),
    percent,
    customKind: readString(record.customKind) ?? readString(record.custom_kind),
    customData: toDesktopDisplayValue(record.customData ?? record.custom_data),
  };
}

function readAgentRefs(value: unknown): DesktopTimelineToolEntry['agentRefs'] {
  if (!Array.isArray(value)) return undefined;
  const refs = value.flatMap((item) => {
    const record = asRecord(item);
    const agentId = readString(record?.agentId) ?? readString(record?.agent_id);
    if (!agentId) return [];
    const rawRole = readString(record?.role);
    const role: 'child' | 'member' | undefined = rawRole === 'child' || rawRole === 'member' ? rawRole : undefined;
    return [{ agentId, role }];
  });
  return refs.length > 0 ? refs : undefined;
}

function readState(value: unknown): DesktopTimelineToolEntry['state'] | undefined {
  return value === 'running' || value === 'done' || value === 'error' ? value : undefined;
}

function readFirstString(record: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = readString(record?.[key]);
    if (value) return value;
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
