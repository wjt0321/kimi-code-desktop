import type { DesktopDisplayValue } from '../../../shared/contracts';

interface StructuredValueProps {
  value: DesktopDisplayValue;
  depth?: number;
}

export function StructuredValue({ value, depth = 0 }: StructuredValueProps) {
  if (value === null) return <span className="structured-value__scalar structured-value__scalar--muted">null</span>;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return <span className={`structured-value__scalar structured-value__scalar--${typeof value}`}>{String(value)}</span>;
  }

  if (value.type === 'array') {
    return (
      <div className={`structured-value structured-value--array structured-value--depth-${Math.min(depth, 3)}`}>
        {value.items.map((item, index) => (
          <div className="structured-value__row" key={index}>
            <span className="structured-value__key">{index}</span>
            <StructuredValue value={item} depth={depth + 1} />
          </div>
        ))}
        {value.truncated ? <span className="structured-value__truncated">内容已截断</span> : null}
      </div>
    );
  }

  return (
    <div className={`structured-value structured-value--object structured-value--depth-${Math.min(depth, 3)}`}>
      {value.entries.map((entry, index) => (
        <div className="structured-value__row" key={`${entry.key}:${index}`}>
          <span className="structured-value__key">{entry.key}</span>
          <StructuredValue value={entry.value} depth={depth + 1} />
        </div>
      ))}
      {value.truncated ? <span className="structured-value__truncated">内容已截断</span> : null}
    </div>
  );
}
