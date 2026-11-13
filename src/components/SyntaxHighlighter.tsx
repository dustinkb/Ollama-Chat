import React, { useMemo } from 'react';

type TokenType =
  | 'plain'
  | 'comment'
  | 'string'
  | 'keyword'
  | 'type'
  | 'number'
  | 'operator'
  | 'property'
  | 'function'
  | 'tag';

interface Token {
  type: TokenType;
  value: string;
}

const COMMON_KEYWORDS = new Set([
  'as',
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'def',
  'del',
  'delete',
  'do',
  'elif',
  'else',
  'enum',
  'except',
  'export',
  'extends',
  'false',
  'finally',
  'fn',
  'for',
  'from',
  'func',
  'function',
  'if',
  'impl',
  'import',
  'in',
  'interface',
  'is',
  'lambda',
  'let',
  'loop',
  'match',
  'mod',
  'mut',
  'new',
  'None',
  'null',
  'of',
  'or',
  'package',
  'pass',
  'private',
  'protected',
  'pub',
  'public',
  'raise',
  'return',
  'self',
  'static',
  'struct',
  'super',
  'switch',
  'this',
  'throw',
  'trait',
  'true',
  'True',
  'False',
  'try',
  'type',
  'typeof',
  'undefined',
  'use',
  'var',
  'void',
  'while',
  'with',
  'yield',
  // SQL / Bash
  'SELECT',
  'FROM',
  'WHERE',
  'INSERT',
  'INTO',
  'VALUES',
  'UPDATE',
  'SET',
  'DELETE',
  'CREATE',
  'TABLE',
  'JOIN',
  'LEFT',
  'RIGHT',
  'INNER',
  'ON',
  'GROUP',
  'BY',
  'ORDER',
  'LIMIT',
  'AS',
  'AND',
  'OR',
  'NOT',
  'select',
  'from',
  'where',
  'insert',
  'update',
  'delete',
  'create',
  'table',
  'join',
  'fi',
  'then',
  'esac',
  'done',
  'echo',
  'export',
  'local',
]);

const BUILTIN_TYPES = new Set([
  'string',
  'number',
  'boolean',
  'any',
  'unknown',
  'never',
  'object',
  'Promise',
  'Array',
  'Record',
  'Map',
  'Set',
  'Date',
  'Error',
  'int',
  'float',
  'str',
  'bool',
  'list',
  'dict',
  'tuple',
  'usize',
  'isize',
  'u32',
  'u64',
  'i32',
  'i64',
  'f64',
  'Vec',
  'Option',
  'Result',
  'String',
  'React',
  'console',
  'Math',
  'JSON',
  'Object',
  'window',
  'document',
]);

function normalizeLanguage(lang: string): string {
  const l = lang.trim().toLowerCase();
  if (['js', 'jsx', 'mjs', 'cjs', 'javascript'].includes(l)) return 'js';
  if (['ts', 'tsx', 'typescript'].includes(l)) return 'ts';
  if (['py', 'python'].includes(l)) return 'python';
  if (['sh', 'bash', 'zsh', 'shell'].includes(l)) return 'bash';
  if (['json', 'jsonc'].includes(l)) return 'json';
  if (['html', 'xml', 'svg'].includes(l)) return 'html';
  if (['css', 'scss'].includes(l)) return 'css';
  if (['yaml', 'yml'].includes(l)) return 'yaml';
  if (['sql'].includes(l)) return 'sql';
  return l || 'text';
}

function tokenizeCode(code: string, rawLanguage: string): Token[] {
  const lang = normalizeLanguage(rawLanguage);
  if (lang === 'text' || lang === 'plaintext' || lang === 'txt') {
    return [{ type: 'plain', value: code }];
  }

  const tokens: Token[] = [];
  let i = 0;
  const len = code.length;

  const pushToken = (type: TokenType, value: string) => {
    if (!value) return;
    const prev = tokens[tokens.length - 1];
    if (prev && prev.type === type) {
      prev.value += value;
    } else {
      tokens.push({ type, value });
    }
  };

  while (i < len) {
    const ch = code[i];
    const next = code[i + 1];

    // Line comments: // or # (for python/bash/yaml) or -- (for sql)
    if (
      (ch === '/' && next === '/') ||
      (ch === '#' && ['python', 'bash', 'yaml'].includes(lang)) ||
      (ch === '-' && next === '-' && lang === 'sql')
    ) {
      const end = code.indexOf('\n', i);
      const sliceEnd = end === -1 ? len : end;
      pushToken('comment', code.slice(i, sliceEnd));
      i = sliceEnd;
      continue;
    }

    // Block comments: /* ... */
    if (ch === '/' && next === '*') {
      const end = code.indexOf('*/', i + 2);
      const sliceEnd = end === -1 ? len : end + 2;
      pushToken('comment', code.slice(i, sliceEnd));
      i = sliceEnd;
      continue;
    }

    // HTML comments <!-- ... -->
    if (lang === 'html' && code.startsWith('<!--', i)) {
      const end = code.indexOf('-->', i + 4);
      const sliceEnd = end === -1 ? len : end + 3;
      pushToken('comment', code.slice(i, sliceEnd));
      i = sliceEnd;
      continue;
    }

    // Strings: "...", '...', `...`
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      let j = i + 1;
      while (j < len) {
        if (code[j] === '\\') {
          j += 2;
          continue;
        }
        if (code[j] === quote) {
          j += 1;
          break;
        }
        if (quote !== '`' && code[j] === '\n') {
          break;
        }
        j += 1;
      }
      const strVal = code.slice(i, j);
      // In JSON, check if string is followed by ':' to style keys differently
      if (lang === 'json') {
        let k = j;
        while (k < len && (code[k] === ' ' || code[k] === '\t')) k++;
        if (code[k] === ':') {
          pushToken('property', strVal);
          i = j;
          continue;
        }
      }
      pushToken('string', strVal);
      i = j;
      continue;
    }

    // HTML / JSX tags like <div or </div
    if (lang === 'html' && ch === '<') {
      const tagMatch = code.slice(i).match(/^<\/?[a-zA-Z0-9_-]+/);
      if (tagMatch) {
        pushToken('tag', tagMatch[0]);
        i += tagMatch[0].length;
        continue;
      }
    }

    // Numbers (hex, float, int)
    if (
      /[0-9]/.test(ch) &&
      (i === 0 || !/[a-zA-Z0-9_$]/.test(code[i - 1]))
    ) {
      const numMatch = code.slice(i).match(/^(?:0x[0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
      if (numMatch) {
        pushToken('number', numMatch[0]);
        i += numMatch[0].length;
        continue;
      }
    }

    // Identifiers, keywords, types, functions
    if (/[a-zA-Z_$]/.test(ch)) {
      const idMatch = code.slice(i).match(/^[a-zA-Z0-9_$]+/);
      if (idMatch) {
        const word = idMatch[0];
        const afterIdx = i + word.length;
        let nextNonSpace = afterIdx;
        while (nextNonSpace < len && (code[nextNonSpace] === ' ' || code[nextNonSpace] === '\t')) {
          nextNonSpace++;
        }

        if (COMMON_KEYWORDS.has(word)) {
          pushToken('keyword', word);
        } else if (BUILTIN_TYPES.has(word) || /^[A-Z][a-zA-Z0-9_]*$/.test(word)) {
          pushToken('type', word);
        } else if (code[nextNonSpace] === '(') {
          pushToken('function', word);
        } else if (
          (lang === 'yaml' || lang === 'css') &&
          code[nextNonSpace] === ':'
        ) {
          pushToken('property', word);
        } else {
          pushToken('plain', word);
        }
        i = afterIdx;
        continue;
      }
    }

    // Punctuation / operators
    if (/[=+\-*/<>!&|^~%?:]+/.test(ch)) {
      pushToken('operator', ch);
      i += 1;
      continue;
    }

    pushToken('plain', ch);
    i += 1;
  }

  return tokens;
}

const TOKEN_CLASSES: Record<TokenType, string> = {
  plain: 'text-zinc-800 dark:text-zinc-200',
  comment: 'text-zinc-400 italic dark:text-zinc-500',
  string: 'text-emerald-700 dark:text-[#9ECE6A]',
  keyword: 'text-blue-700 font-medium dark:text-[#7AA2F7]',
  type: 'text-violet-700 dark:text-[#BB9AF7]',
  number: 'text-amber-700 dark:text-[#E0AF68]',
  operator: 'text-zinc-500 dark:text-zinc-400',
  property: 'text-sky-700 dark:text-[#7DCFFF]',
  function: 'text-indigo-700 dark:text-[#7DCFFF]',
  tag: 'text-blue-700 dark:text-[#7AA2F7]',
};

interface SyntaxHighlighterProps {
  code: string;
  language: string;
}

export const SyntaxHighlighter: React.FC<SyntaxHighlighterProps> = ({ code, language }) => {
  const tokens = useMemo(() => tokenizeCode(code, language), [code, language]);

  return (
    <code className="block">
      {tokens.map((token, idx) => (
        <span key={idx} className={TOKEN_CLASSES[token.type]}>
          {token.value}
        </span>
      ))}
    </code>
  );
};
