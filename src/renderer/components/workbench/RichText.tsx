import { Check, Copy } from 'lucide-react';
import { Fragment, useState } from 'react';

interface RichTextProps {
  text: string;
}

type Segment = { kind: 'prose'; text: string } | { kind: 'code'; text: string; language?: string };

export function RichText({ text }: RichTextProps) {
  const segments = splitFences(text);
  return (
    <div className="rich-text">
      {segments.map((segment, index) => segment.kind === 'code'
        ? <CodeBlock key={`${index}-${segment.language ?? ''}`} code={segment.text} language={segment.language} />
        : <Prose key={index} text={segment.text} />)}
    </div>
  );
}

function Prose({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter(Boolean);
  return <>{blocks.map((block, index) => {
    const lines = block.split('\n');
    const list = lines.every((line) => /^\s*[-*]\s+/.test(line));
    if (list) return <ul key={index}>{lines.map((line, itemIndex) => <li key={itemIndex}>{line.replace(/^\s*[-*]\s+/, '')}</li>)}</ul>;
    return <p key={index}>{lines.map((line, lineIndex) => <Fragment key={lineIndex}>{lineIndex > 0 ? <br /> : null}{line}</Fragment>)}</p>;
  })}</>;
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  };
  return (
    <figure className="code-block">
      <figcaption><span>{language || '代码'}</span><button type="button" aria-label="复制代码" onClick={() => void copy()}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? '已复制' : '复制'}</button></figcaption>
      <pre><code>{code}</code></pre>
    </figure>
  );
}

function splitFences(text: string): Segment[] {
  const segments: Segment[] = [];
  const pattern = /```([^\n`]*)\n([\s\S]*?)```/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) segments.push({ kind: 'prose', text: text.slice(cursor, index) });
    segments.push({ kind: 'code', language: match[1]?.trim() || undefined, text: match[2]?.replace(/\n$/, '') ?? '' });
    cursor = index + match[0].length;
  }
  if (cursor < text.length) segments.push({ kind: 'prose', text: text.slice(cursor) });
  return segments.length > 0 ? segments : [{ kind: 'prose', text }];
}
