import { AlertTriangle, BrainCircuit, Check, CircleHelp, Gauge, LoaderCircle, RefreshCw, Route, ShieldAlert, X } from 'lucide-react';
import { useState } from 'react';

import type { DesktopQuestion, DesktopSessionRuntime, DesktopTaskSnapshot } from '../../../shared/contracts';

interface ContextDockProps {
  snapshot: DesktopTaskSnapshot;
  runtime: DesktopSessionRuntime | undefined;
  runtimeLoading: boolean;
  onRefreshRuntime(): void;
  onApprove(approvalId: string): void;
  onReject(approvalId: string): void;
  onAnswer(questionId: string, answers: Record<string, { kind: 'single'; optionId: string } | { kind: 'multi'; optionIds: string[] } | { kind: 'other'; text: string } | { kind: 'skipped' }>): void;
  onDismiss(questionId: string): void;
  onClose?(): void;
}

export function ContextDock({ snapshot, runtime, runtimeLoading, onRefreshRuntime, onApprove, onReject, onAnswer, onDismiss, onClose }: ContextDockProps) {
  const attentionCount = snapshot.approvals.length + snapshot.questions.length;

  return (
    <aside className="workbench-context" aria-label="任务上下文">
      <header><span>任务上下文</span>{onClose ? <button type="button" className="icon-button" aria-label="关闭任务上下文" onClick={onClose}><X size={14} /></button> : null}</header>
      {attentionCount > 0 ? (
        <section className="context-section context-section--attention">
          <h2>需要处理（{attentionCount}）</h2>
          {snapshot.approvals.map((approval) => (
            <article key={approval.id} className="approval-card">
              <div className="approval-card__heading"><ShieldAlert size={15} /><strong>{approval.action}</strong></div>
              <p>{approval.toolName}</p>
              <pre>{approval.summary}</pre>
              <div className="approval-card__actions">
                <button type="button" className="button" onClick={() => onApprove(approval.id)}><Check size={14} />允许一次</button>
                <button type="button" className="button button--secondary" onClick={() => onReject(approval.id)}>拒绝</button>
              </div>
            </article>
          ))}
          {snapshot.questions.map((question) => <QuestionCard key={question.id} question={question} onAnswer={onAnswer} onDismiss={onDismiss} />)}
        </section>
      ) : null}
      {(runtime || runtimeLoading) ? (
        <section className="context-section context-runtime">
          <div className="context-section__heading"><h2>运行状态</h2><button type="button" className="context-refresh" aria-label="刷新运行状态" disabled={runtimeLoading} onClick={onRefreshRuntime}>{runtimeLoading ? <LoaderCircle size={13} className="spin" /> : <RefreshCw size={13} />}</button></div>
          {runtime?.available ? (
            <>
              <div className="context-runtime__usage"><div><strong>上下文 {formatTokens(runtime.contextTokens)} / {formatTokens(runtime.maxContextTokens)}</strong><span>{Math.round(runtime.contextUsage * 100)}%</span></div><span className="context-runtime__track"><span style={{ width: `${Math.min(100, Math.max(0, runtime.contextUsage * 100))}%` }} /></span></div>
              <div className="context-runtime__facts">
                <div><BrainCircuit size={13} /><span>{`思考强度 ${thinkingLabel(runtime.thinkingLevel)}`}</span></div>
                <div><Gauge size={13} /><span>{`权限 ${permissionLabel(runtime.permission)}`}</span></div>
                <div><Route size={13} /><span>{`计划模式 ${runtime.planMode ? '已开启' : '未开启'}`}</span></div>
              </div>
              {runtime.warnings.map((warning) => <div key={`${warning.code}:${warning.message}`} className={`context-runtime__warning context-runtime__warning--${warning.severity}`} role={warning.severity === 'error' ? 'alert' : 'status'} aria-label={`${warningSeverityLabel(warning.severity)}：${warning.message}`}><AlertTriangle size={13} /><span>{warning.message}</span></div>)}
            </>
          ) : runtimeLoading ? <div className="context-runtime__loading"><LoaderCircle size={14} className="spin" />正在读取运行状态…</div> : <div className="context-runtime__loading">当前 CLI 不支持运行状态详情。</div>}
        </section>
      ) : null}
      {snapshot.todos.length ? (
        <section className="context-section">
          <h2>待办</h2>
          {snapshot.todos.map((todo) => <div key={todo.id} className={`context-todo context-todo--${todo.status}`}>{todo.title}</div>)}
        </section>
      ) : null}
      {snapshot.tasks.length ? (
        <section className="context-section">
          <h2>活动</h2>
          {snapshot.tasks.map((task) => <div key={task.id} className="context-activity"><strong>{task.title}</strong><span>{task.state}</span></div>)}
        </section>
      ) : null}
    </aside>
  );
}

function QuestionCard({ question, onAnswer, onDismiss }: {
  question: DesktopQuestion;
  onAnswer: ContextDockProps['onAnswer'];
  onDismiss: ContextDockProps['onDismiss'];
}) {
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [other, setOther] = useState<Record<string, string>>({});

  const submit = () => {
    const answers = Object.fromEntries(question.questions.map((item) => {
      const selectedIds = selected[item.id] ?? [];
      const otherText = other[item.id]?.trim();
      if (otherText) return [item.id, { kind: 'other' as const, text: otherText }];
      if (item.multiSelect && selectedIds.length > 1) return [item.id, { kind: 'multi' as const, optionIds: selectedIds }];
      if (selectedIds[0]) return [item.id, { kind: 'single' as const, optionId: selectedIds[0] }];
      return [item.id, { kind: 'skipped' as const }];
    }));
    onAnswer(question.id, answers);
  };

  return (
    <article className="question-card">
      <div className="question-card__heading"><CircleHelp size={15} /><strong>{question.questions[0]?.header || '需要你的回答'}</strong></div>
      {question.questions.map((item) => (
        <fieldset key={item.id}>
          <legend>{item.question}</legend>
          {item.body ? <p>{item.body}</p> : null}
          <div className="question-options">
            {item.options.map((option) => {
              const chosen = (selected[item.id] ?? []).includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`question-option ${chosen ? 'question-option--selected' : ''}`}
                  onClick={() => setSelected((current) => ({
                    ...current,
                    [item.id]: item.multiSelect
                      ? chosen ? (current[item.id] ?? []).filter((id) => id !== option.id) : [...(current[item.id] ?? []), option.id]
                      : [option.id],
                  }))}
                >
                  <span>{option.label}</span>{option.description ? <small>{option.description}</small> : null}
                </button>
              );
            })}
          </div>
          {item.allowOther ? <input aria-label={`${item.question}的补充说明`} value={other[item.id] ?? ''} onChange={(event) => setOther((current) => ({ ...current, [item.id]: event.target.value }))} placeholder={item.otherLabel || '补充说明'} /> : null}
        </fieldset>
      ))}
      <div className="question-card__actions"><button type="button" className="button" onClick={submit}>提交回答</button><button type="button" className="button button--secondary" onClick={() => onDismiss(question.id)}>暂不处理</button></div>
    </article>
  );
}


const tokenFormatter = new Intl.NumberFormat('zh-CN');

function formatTokens(value: number): string {
  return tokenFormatter.format(value);
}

function thinkingLabel(value: string): string {
  const labels: Record<string, string> = { off: '关闭', on: '开启', minimal: '极简', low: '低', medium: '中', high: '高', max: '最高' };
  return labels[value] ?? value;
}

function permissionLabel(value: 'manual' | 'yolo' | 'auto'): string {
  if (value === 'auto') return '完全自动';
  if (value === 'yolo') return 'YOLO';
  return '手动确认';
}

function warningSeverityLabel(value: 'info' | 'warning' | 'error'): string {
  if (value === 'error') return '错误';
  if (value === 'warning') return '警告';
  return '提示';
}
