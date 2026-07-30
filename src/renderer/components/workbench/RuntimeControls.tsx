import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Switch from '@radix-ui/react-switch';
import { BrainCircuit, Check, ChevronDown, LoaderCircle, Route, ShieldCheck } from 'lucide-react';

import type { DesktopModel, DesktopSessionRuntime, UpdateRuntimeRequest } from '../../../shared/contracts';

interface RuntimeControlsProps {
  runtime: DesktopSessionRuntime | undefined;
  model: DesktopModel | undefined;
  disabled: boolean;
  updating: boolean;
  onChange(patch: Omit<UpdateRuntimeRequest, 'sessionId'>): void;
}

const permissionItems = [
  { value: 'manual' as const, label: '手动确认', description: '敏感操作交给用户决定' },
  { value: 'yolo' as const, label: 'YOLO', description: '自动批准工具操作，但模型仍可提问' },
  { value: 'auto' as const, label: '完全自动', description: '模型自行决定，不等待审批或提问' },
];

export function RuntimeControls({ runtime, model, disabled, updating, onChange }: RuntimeControlsProps) {
  const unavailable = runtime?.available === false;
  const controlsDisabled = disabled || updating || runtime === undefined || unavailable;
  const thinkingOptions = model?.supportEfforts && model.supportEfforts.length > 0
    ? ['off', ...model.supportEfforts.filter((effort) => effort !== 'off')]
    : ['off', 'on'];
  const thinking = runtime?.thinkingLevel ?? model?.defaultEffort ?? 'off';
  const permission = runtime?.permission ?? 'manual';

  return (
    <div className="runtime-controls" aria-label="任务运行策略">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" className="runtime-control-trigger" disabled={controlsDisabled} aria-label={`思考强度：${thinkingLabel(thinking)}`}>
            <BrainCircuit size={13} />
            <span>{thinkingLabel(thinking)}</span>
            <ChevronDown size={11} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="runtime-menu" side="top" align="start" sideOffset={8}>
            <div className="runtime-menu__heading"><span>思考强度</span><small>{model?.label ?? '当前模型'}</small></div>
            <DropdownMenu.RadioGroup value={thinking} onValueChange={(thinkingLevel) => onChange({ thinkingLevel })}>
              {thinkingOptions.map((effort) => (
                <DropdownMenu.RadioItem key={effort} value={effort} className="runtime-menu-item">
                  <span className="runtime-menu-item__icon"><BrainCircuit size={13} /></span>
                  <span className="runtime-menu-item__copy"><strong>{thinkingLabel(effort)}</strong><small>{thinkingDescription(effort, model?.defaultEffort)}</small></span>
                  <DropdownMenu.ItemIndicator className="runtime-menu-item__check"><Check size={13} /></DropdownMenu.ItemIndicator>
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" className="runtime-control-trigger" disabled={controlsDisabled} aria-label={`权限模式：${permissionLabel(permission)}`}>
            <ShieldCheck size={13} />
            <span>{permissionLabel(permission)}</span>
            <ChevronDown size={11} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="runtime-menu runtime-menu--permission" side="top" align="start" sideOffset={8}>
            <div className="runtime-menu__heading"><span>权限模式</span><small>本机工具执行策略</small></div>
            <DropdownMenu.RadioGroup value={permission} onValueChange={(value) => onChange({ permission: value as 'manual' | 'yolo' | 'auto' })}>
              {permissionItems.map((item) => (
                <DropdownMenu.RadioItem key={item.value} value={item.value} className="runtime-menu-item">
                  <span className="runtime-menu-item__icon"><ShieldCheck size={13} /></span>
                  <span className="runtime-menu-item__copy"><strong>{item.label}</strong><small>{item.description}</small></span>
                  <DropdownMenu.ItemIndicator className="runtime-menu-item__check"><Check size={13} /></DropdownMenu.ItemIndicator>
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <label className={`plan-mode-control ${runtime?.planMode ? 'is-active' : ''}`} title="计划模式下先制定方案，不直接执行修改">
        {updating ? <LoaderCircle size={12} className="spin" /> : <Route size={12} />}
        <span>计划</span>
        <Switch.Root
          className="plan-mode-switch"
          checked={runtime?.planMode ?? false}
          disabled={controlsDisabled}
          aria-label="计划模式"
          onCheckedChange={(planMode) => onChange({ planMode })}
        >
          <Switch.Thumb className="plan-mode-switch__thumb" />
        </Switch.Root>
      </label>

      {updating ? <span className="runtime-controls__progress" role="status"><LoaderCircle size={12} className="spin" />正在同步运行策略</span> : null}
      {unavailable ? <span className="runtime-controls__unavailable">当前 CLI 不支持运行策略控制</span> : null}
    </div>
  );
}

export function thinkingLabel(value: string): string {
  const labels: Record<string, string> = {
    off: '关闭思考',
    on: '开启思考',
    minimal: '极简',
    low: '低',
    medium: '中',
    high: '高',
    max: '最高',
  };
  return labels[value] ?? value;
}

function thinkingDescription(value: string, defaultEffort: string | undefined): string {
  if (value === 'off') return '关闭扩展思考，优先响应速度';
  if (value === 'on') return '使用模型支持的默认思考方式';
  return value === defaultEffort ? '模型默认强度' : '由当前模型声明支持';
}

export function permissionLabel(value: 'manual' | 'yolo' | 'auto'): string {
  if (value === 'auto') return '完全自动';
  if (value === 'yolo') return 'YOLO';
  return '手动确认';
}
