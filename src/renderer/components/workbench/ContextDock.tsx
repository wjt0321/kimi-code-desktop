import { Check, CircleHelp, ShieldAlert, X } from 'lucide-react';
import { useState } from 'react';

import type { DesktopQuestion, DesktopTaskSnapshot } from '../../../shared/contracts';

interface ContextDockProps {
  snapshot: DesktopTaskSnapshot;
  onApprove(approvalId: string): void;
  onReject(approvalId: string): void;
  onAnswer(questionId: string, answers: Record<string, { kind: 'single'; optionId: string } | { kind: 'multi'; optionIds: string[] } | { kind: 'other'; text: string } | { kind: 'skipped' }>): void;
  onDismiss(questionId: string): void;
  onClose?(): void;
}

export function ContextDock({ snapshot, onApprove, onReject, onAnswer, onDismiss, onClose }: ContextDockProps) {
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
