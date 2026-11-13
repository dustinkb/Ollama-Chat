import { Conversation, Persona } from '../types/chat';

function sanitizeFilename(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'ollama-chat'
  );
}

function triggerDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatIso(ts: number): string {
  return new Date(ts).toISOString();
}

function formatReadableDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function conversationToMarkdown(
  conv: Conversation,
  personaMap: Map<string, string>
): string {
  const personaName = personaMap.get(conv.personaId) || 'Default';
  const lines: string[] = [
    `# ${conv.title}`,
    '',
    `- **Persona:** ${personaName}`,
    `- **Model:** ${conv.model || 'Unknown'}`,
    `- **Created:** ${formatReadableDate(conv.createdAt)}`,
    `- **Updated:** ${formatReadableDate(conv.updatedAt)}`,
    '',
    '---',
    '',
  ];

  for (const msg of conv.messages) {
    const roleHeading =
      msg.role === 'user'
        ? '## User'
        : `## Assistant (${personaName}${msg.model ? ` · ${msg.model}` : ''})`;
    lines.push(roleHeading);
    lines.push(`*${formatReadableDate(msg.createdAt)}*`);
    lines.push('');
    lines.push(msg.content);
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

export function exportConversationAsMarkdown(
  conversation: Conversation,
  personas: Persona[]
): void {
  const personaMap = new Map(personas.map((p) => [p.id, p.name]));
  const markdown = conversationToMarkdown(conversation, personaMap);
  const filename = `${sanitizeFilename(conversation.title)}.md`;
  triggerDownload(filename, `${markdown}\n`, 'text/markdown;charset=utf-8');
}

export function exportConversationAsJson(
  conversation: Conversation,
  personas: Persona[]
): void {
  const personaMap = new Map(personas.map((p) => [p.id, p.name]));
  const payload = {
    app: 'Ollama Chat',
    version: '1.0.0',
    exportedAt: formatIso(Date.now()),
    conversation: {
      ...conversation,
      personaName: personaMap.get(conversation.personaId) || 'Default',
    },
  };
  const filename = `${sanitizeFilename(conversation.title)}.json`;
  triggerDownload(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
}

export function exportAllConversationsAsMarkdown(
  conversations: Conversation[],
  personas: Persona[]
): void {
  const personaMap = new Map(personas.map((p) => [p.id, p.name]));
  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  const header = [
    '# Ollama Chat — Exported History',
    '',
    `Exported on ${formatReadableDate(Date.now())} (${sorted.length} ${
      sorted.length === 1 ? 'conversation' : 'conversations'
    })`,
    '',
    '===',
    '',
  ].join('\n');

  const body = sorted
    .map((conv) => conversationToMarkdown(conv, personaMap))
    .join('\n\n===\n\n');

  const dateStamp = new Date().toISOString().slice(0, 10);
  triggerDownload(
    `ollama-chat-history-${dateStamp}.md`,
    `${header}${body}\n`,
    'text/markdown;charset=utf-8'
  );
}

export function exportAllConversationsAsJson(
  conversations: Conversation[],
  personas: Persona[]
): void {
  const personaMap = new Map(personas.map((p) => [p.id, p.name]));
  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  const payload = {
    app: 'Ollama Chat',
    version: '1.0.0',
    exportedAt: formatIso(Date.now()),
    count: sorted.length,
    conversations: sorted.map((conv) => ({
      ...conv,
      personaName: personaMap.get(conv.personaId) || 'Default',
    })),
  };

  const dateStamp = new Date().toISOString().slice(0, 10);
  triggerDownload(
    `ollama-chat-history-${dateStamp}.json`,
    JSON.stringify(payload, null, 2),
    'application/json;charset=utf-8'
  );
}
