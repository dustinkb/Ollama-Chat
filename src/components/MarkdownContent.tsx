import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { SyntaxHighlighter } from './SyntaxHighlighter';

interface MarkdownContentProps {
  content: string;
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <div className="my-3.5 overflow-hidden rounded-xl border border-zinc-200/90 bg-zinc-50/90 shadow-[0_4px_16px_-6px_rgba(0,0,0,0.06)] dark:border-white/[0.08] dark:bg-[#0A0A0D] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_24px_-8px_rgba(0,0,0,0.85)]">
      <div className="flex items-center justify-between border-b border-zinc-200/80 bg-zinc-100/70 px-3.5 py-2 dark:border-white/[0.06] dark:bg-white/[0.02]">
        <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
          {language || 'text'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-xl px-2 py-0.5 text-[11px] text-zinc-500 transition-all duration-200 ease-in-out hover:bg-zinc-200/70 hover:text-zinc-900 active:scale-[0.96] dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100"
          aria-label="Copy code"
        >
          {copied ? <Check className="h-3 w-3 text-blue-500 dark:text-[#7AA2F7]" strokeWidth={1.75} /> : <Copy className="h-3 w-3" strokeWidth={1.5} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-zinc-800 dark:text-zinc-200">
        <SyntaxHighlighter code={code} language={language} />
      </pre>
    </div>
  );
}

function renderInlineFormatting(text: string): React.ReactNode[] {
  // Split by inline code `...` first, then **bold**
  const segments = text.split(/(`[^`]+`)/g);
  return segments.map((segment, idx) => {
    if (segment.startsWith('`') && segment.endsWith('`') && segment.length >= 2) {
      return (
        <code
          key={idx}
          className="rounded bg-zinc-200/70 px-1.5 py-0.5 font-mono text-[12.5px] text-zinc-900 dark:bg-zinc-900 dark:text-zinc-200"
        >
          {segment.slice(1, -1)}
        </code>
      );
    }

    const boldParts = segment.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((part, bIdx) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return (
          <strong key={`${idx}-${bIdx}`} className="font-semibold text-zinc-950 dark:text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <React.Fragment key={`${idx}-${bIdx}`}>{part}</React.Fragment>;
    });
  });
}

function renderTextBlock(block: string, keyPrefix: string): React.ReactNode {
  const lines = block.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: { type: 'ul' | 'ol'; items: string[] } | null = null;

  const flushList = (keyIndex: number) => {
    if (!listItems) return;
    if (listItems.type === 'ul') {
      elements.push(
        <ul key={`${keyPrefix}-ul-${keyIndex}`} className="my-2 list-disc space-y-1 pl-5">
          {listItems.items.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {renderInlineFormatting(item)}
            </li>
          ))}
        </ul>
      );
    } else {
      elements.push(
        <ol key={`${keyPrefix}-ol-${keyIndex}`} className="my-2 list-decimal space-y-1 pl-5">
          {listItems.items.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {renderInlineFormatting(item)}
            </li>
          ))}
        </ol>
      );
    }
    listItems = null;
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const ulMatch = trimmed.match(/^[-*]\s+(.*)$/);
    const olMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);

    if (ulMatch) {
      if (listItems && listItems.type !== 'ul') flushList(index);
      if (!listItems) listItems = { type: 'ul', items: [] };
      listItems.items.push(ulMatch[1]);
      return;
    }

    if (olMatch) {
      if (listItems && listItems.type !== 'ol') flushList(index);
      if (!listItems) listItems = { type: 'ol', items: [] };
      listItems.items.push(olMatch[1]);
      return;
    }

    flushList(index);

    if (!trimmed) {
      elements.push(<div key={`${keyPrefix}-sp-${index}`} className="h-2.5" />);
      return;
    }

    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const cls =
        level === 1
          ? 'mt-3 mb-1.5 text-base font-semibold text-zinc-950 dark:text-zinc-50'
          : level === 2
            ? 'mt-2.5 mb-1 text-[15px] font-semibold text-zinc-950 dark:text-zinc-100'
            : 'mt-2 mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-200';
      elements.push(
        <p key={`${keyPrefix}-h-${index}`} className={cls}>
          {renderInlineFormatting(text)}
        </p>
      );
      return;
    }

    elements.push(
      <p key={`${keyPrefix}-p-${index}`} className="leading-[1.65]">
        {renderInlineFormatting(line)}
      </p>
    );
  });

  flushList(lines.length);
  return elements;
}

export const MarkdownContent: React.FC<MarkdownContentProps> = ({ content }) => {
  const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];
  const fenceRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: content.slice(lastIndex, match.index),
      });
    }
    parts.push({
      type: 'code',
      language: match[1] || 'text',
      content: match[2].replace(/\n$/, ''),
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const tail = content.slice(lastIndex);
    const unclosedFenceMatch = tail.match(/^```([a-zA-Z0-9_-]*)\n([\s\S]*)$/);
    if (unclosedFenceMatch) {
      parts.push({
        type: 'code',
        language: unclosedFenceMatch[1] || 'text',
        content: unclosedFenceMatch[2],
      });
    } else {
      parts.push({
        type: 'text',
        content: tail,
      });
    }
  }

  return (
    <div className="space-y-1 text-[15px] text-zinc-800 dark:text-zinc-200 break-words">
      {parts.map((part, index) =>
        part.type === 'code' ? (
          <CodeBlock key={`code-${index}`} language={part.language || 'text'} code={part.content} />
        ) : (
          <React.Fragment key={`text-${index}`}>
            {renderTextBlock(part.content, `blk-${index}`)}
          </React.Fragment>
        )
      )}
    </div>
  );
};
