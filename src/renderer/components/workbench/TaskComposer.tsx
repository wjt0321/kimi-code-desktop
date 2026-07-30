import { ArrowUp, Bot, ChevronDown, LoaderCircle, SquareTerminal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { DesktopModel } from '../../../shared/contracts';

interface TaskComposerProps {
  disabled: boolean;
  busy: boolean;
  models: DesktopModel[];
  selectedModelId: string | undefined;
  onModelChange(modelId: string): void;
  onSubmit(text: string, modelId: string): Promise<void>;
}

export function TaskComposer({ disabled, busy, models, selectedModelId, onModelChange, onSubmit }: TaskComposerProps) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const canSend = !disabled && !submitting && text.trim().length > 0 && selectedModelId !== undefined;
  const selectedModel = models.find((model) => model.id === selectedModelId);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = '0px';
    input.style.height = `${Math.min(Math.max(input.scrollHeight, 34), 180)}px`;
  }, [text]);

  const submit = async () => {
    const next = text.trim();
    if (!next || !selectedModelId || disabled || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(next, selectedModelId);
      setText('');
      inputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="composer-shell">
      {busy ? <div className="composer-queue-note"><LoaderCircle size={13} className="spin" /><span>当前任务正在运行，新请求会在发送后进入队列。</span></div> : null}
      <form className="task-composer" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <textarea
          ref={inputRef}
          aria-label="向 Kimi Code 发送任务"
          value={text}
          rows={1}
          disabled={disabled || submitting}
          placeholder={disabled ? '请先启动本地服务' : busy ? '继续补充要求，发送后将排队处理' : '描述你希望 Kimi Code 完成的工作…'}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
            if (event.ctrlKey) {
              event.preventDefault();
              const input = event.currentTarget;
              const cursor = input.selectionStart;
              setText(`${input.value.slice(0, cursor)}\n${input.value.slice(input.selectionEnd)}`);
              requestAnimationFrame(() => input.setSelectionRange(cursor + 1, cursor + 1));
              return;
            }
            event.preventDefault();
            void submit();
          }}
        />
        <footer>
          <div className="composer-controls">
            <label className="model-picker" title={selectedModel?.id}>
              <Bot size={13} />
              <select aria-label="选择模型" value={selectedModelId ?? ''} disabled={disabled || submitting || models.length === 0} onChange={(event) => onModelChange(event.target.value)}>
                <option value="" disabled>{models.length === 0 ? '没有可用模型' : '选择模型'}</option>
                {models.map((model) => <option key={model.id} value={model.id}>{model.label} · {model.provider}</option>)}
              </select>
              <ChevronDown size={12} />
            </label>
            <span className="composer-mode"><SquareTerminal size={12} />本机执行</span>
          </div>
          <span className="task-composer__hint">{submitting ? '正在发送…' : selectedModelId ? 'Enter 发送 · Ctrl+Enter 换行' : '请先选择模型'}</span>
          <button className="send-button" type="submit" aria-label="发送" disabled={!canSend}>{submitting ? <LoaderCircle size={16} className="spin" /> : <ArrowUp size={17} />}</button>
        </footer>
      </form>
      <div className="composer-disclaimer">Kimi Code 可能会修改文件和运行命令，请检查重要结果。</div>
    </div>
  );
}
