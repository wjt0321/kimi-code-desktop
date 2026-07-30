import * as Select from '@radix-ui/react-select';
import { Bot, Check, ChevronDown, ChevronUp } from 'lucide-react';

import type { DesktopModel } from '../../../shared/contracts';

interface ModelPickerProps {
  models: DesktopModel[];
  value: string | undefined;
  disabled: boolean;
  onValueChange(modelId: string): void;
}

export function ModelPicker({ models, value, disabled, onValueChange }: ModelPickerProps) {
  const selectedModel = models.find((model) => model.id === value);

  return (
    <Select.Root value={value} disabled={disabled} onValueChange={onValueChange}>
      <Select.Trigger className="model-select-trigger" aria-label="选择模型" title={selectedModel?.id}>
        <Bot size={13} />
        <Select.Value placeholder={models.length === 0 ? '没有可用模型' : '选择模型'}>
          {selectedModel ? (
            <span className="model-select-value">
              <strong>{selectedModel.label}</strong>
              <small>{selectedModel.provider}</small>
            </span>
          ) : undefined}
        </Select.Value>
        <Select.Icon className="model-select-chevron"><ChevronDown size={12} /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="model-select-content" position="popper" side="top" align="start" sideOffset={8} collisionPadding={12}>
          <Select.ScrollUpButton className="model-select-scroll"><ChevronUp size={13} /></Select.ScrollUpButton>
          <div className="model-select-heading">
            <span>选择模型</span>
            <small>{models.length} 个可用</small>
          </div>
          <Select.Viewport className="model-select-viewport">
            {models.map((model) => (
              <Select.Item key={model.id} value={model.id} className="model-select-item" textValue={`${model.label} ${model.provider}`}>
                <Select.ItemText>
                  <span className="model-select-item__copy">
                    <strong>{model.label}</strong>
                    <small>{model.provider}{model.contextWindow ? ` · ${formatContextWindow(model.contextWindow)}` : ''}</small>
                  </span>
                </Select.ItemText>
                <Select.ItemIndicator className="model-select-indicator"><Check size={14} /></Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="model-select-scroll"><ChevronDown size={13} /></Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

function formatContextWindow(contextWindow: number): string {
  if (contextWindow >= 1_000_000) return `${Math.round(contextWindow / 1_000_000)}M 上下文`;
  if (contextWindow >= 1_000) return `${Math.round(contextWindow / 1_000)}K 上下文`;
  return `${contextWindow} 上下文`;
}
