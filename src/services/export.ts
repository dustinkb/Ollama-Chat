import { Conversation, Persona, PersonaMemory } from '../types/chat';

function generateImportId(prefix: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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

// --- Persona & Memory Export / Import ---

export function exportPersonaMemoriesAsJson(
  persona: Persona,
  memories: PersonaMemory[]
): void {
  const scoped = memories
    .filter((m) => m.personaId === persona.id)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const payload = {
    app: 'Ollama Chat',
    type: 'persona-memories',
    version: '1.0.0',
    exportedAt: formatIso(Date.now()),
    persona: {
      id: persona.id,
      name: persona.name,
    },
    count: scoped.length,
    memories: scoped,
  };

  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `${sanitizeFilename(persona.name)}-memories-${dateStamp}.json`;
  triggerDownload(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
}

export function exportPersonaAsJson(
  persona: Persona,
  memories: PersonaMemory[]
): void {
  const scoped = memories
    .filter((m) => m.personaId === persona.id)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const payload = {
    app: 'Ollama Chat',
    type: 'persona-bundle',
    version: '1.0.0',
    exportedAt: formatIso(Date.now()),
    count: 1,
    personas: [
      {
        ...persona,
        memories: scoped,
      },
    ],
  };

  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `${sanitizeFilename(persona.name)}-persona-${dateStamp}.json`;
  triggerDownload(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
}

export function exportAllPersonasAsJson(
  personas: Persona[],
  memories: PersonaMemory[]
): void {
  const payload = {
    app: 'Ollama Chat',
    type: 'personas-bundle',
    version: '1.0.0',
    exportedAt: formatIso(Date.now()),
    count: personas.length,
    personas: personas.map((persona) => ({
      ...persona,
      memories: memories
        .filter((m) => m.personaId === persona.id)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    })),
  };

  const dateStamp = new Date().toISOString().slice(0, 10);
  triggerDownload(
    `personas-backup-${dateStamp}.json`,
    JSON.stringify(payload, null, 2),
    'application/json;charset=utf-8'
  );
}

function normalizeMemoryItem(
  raw: unknown,
  targetPersonaId: string,
  now: number
): PersonaMemory | null {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return {
      id: generateImportId('mem'),
      personaId: targetPersonaId,
      summary: trimmed,
      createdAt: now,
      updatedAt: now,
    };
  }

  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const rawSummary =
    typeof obj.summary === 'string'
      ? obj.summary
      : typeof obj.content === 'string'
      ? obj.content
      : typeof obj.text === 'string'
      ? obj.text
      : '';

  const summary = rawSummary.trim();
  if (!summary) return null;

  const createdAt =
    typeof obj.createdAt === 'number' && Number.isFinite(obj.createdAt)
      ? obj.createdAt
      : now;
  const updatedAt =
    typeof obj.updatedAt === 'number' && Number.isFinite(obj.updatedAt)
      ? obj.updatedAt
      : createdAt;

  return {
    id: generateImportId('mem'),
    personaId: targetPersonaId,
    summary,
    ...(typeof obj.sourceConversationId === 'string'
      ? { sourceConversationId: obj.sourceConversationId }
      : {}),
    ...(typeof obj.sourceConversationTitle === 'string'
      ? { sourceConversationTitle: obj.sourceConversationTitle }
      : {}),
    createdAt,
    updatedAt,
  };
}

export function parseMemoriesImport(
  rawJson: string,
  targetPersonaId: string
): PersonaMemory[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('Invalid JSON file. Could not parse memories.');
  }

  const now = Date.now();
  let candidateList: unknown[] = [];

  if (Array.isArray(parsed)) {
    candidateList = parsed;
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.memories)) {
      candidateList = obj.memories;
    } else if (Array.isArray(obj.personas)) {
      // Allow extracting memories if a persona-bundle JSON is selected here
      candidateList = obj.personas.flatMap((p) =>
        p && typeof p === 'object' && Array.isArray((p as Record<string, unknown>).memories)
          ? ((p as Record<string, unknown>).memories as unknown[])
          : []
      );
    } else if (
      typeof obj.summary === 'string' ||
      typeof obj.content === 'string' ||
      typeof obj.text === 'string'
    ) {
      candidateList = [obj];
    }
  }

  const normalized = candidateList
    .map((item) => normalizeMemoryItem(item, targetPersonaId, now))
    .filter((item): item is PersonaMemory => item !== null);

  if (normalized.length === 0) {
    throw new Error('No valid memories found in the selected file.');
  }

  return normalized;
}

export interface ImportedPersonaBundle {
  persona: Persona;
  memories: PersonaMemory[];
}

export function parsePersonasImport(rawJson: string): ImportedPersonaBundle[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('Invalid JSON file. Could not parse personas.');
  }

  const now = Date.now();
  let rawPersonas: unknown[] = [];
  let topLevelMemories: unknown[] = [];

  if (Array.isArray(parsed)) {
    rawPersonas = parsed;
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.memories)) {
      topLevelMemories = obj.memories;
    }
    if (Array.isArray(obj.personas)) {
      rawPersonas = obj.personas;
    } else if (obj.persona && typeof obj.persona === 'object') {
      rawPersonas = [obj.persona];
    } else if (typeof obj.name === 'string') {
      rawPersonas = [obj];
    }
  }

  const bundles: ImportedPersonaBundle[] = [];

  for (const item of rawPersonas) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const rawName = typeof obj.name === 'string' ? obj.name.trim() : '';
    if (!rawName) continue;

    const originalId = typeof obj.id === 'string' ? obj.id : undefined;
    const newPersonaId = generateImportId('persona');
    const systemPrompt =
      typeof obj.systemPrompt === 'string'
        ? obj.systemPrompt
        : typeof obj.prompt === 'string'
        ? obj.prompt
        : '';

    const createdAt =
      typeof obj.createdAt === 'number' && Number.isFinite(obj.createdAt)
        ? obj.createdAt
        : now;
    const updatedAt =
      typeof obj.updatedAt === 'number' && Number.isFinite(obj.updatedAt)
        ? obj.updatedAt
        : createdAt;

    const persona: Persona = {
      id: newPersonaId,
      name: rawName,
      systemPrompt,
      createdAt,
      updatedAt,
    };

    const embeddedRawMemories = Array.isArray(obj.memories) ? obj.memories : [];
    const linkedTopLevelMemories = originalId
      ? topLevelMemories.filter(
          (m) => m && typeof m === 'object' && (m as Record<string, unknown>).personaId === originalId
        )
      : [];

    const coupledMemories = [...embeddedRawMemories, ...linkedTopLevelMemories]
      .map((m) => normalizeMemoryItem(m, newPersonaId, now))
      .filter((m): m is PersonaMemory => m !== null);

    bundles.push({
      persona,
      memories: coupledMemories,
    });
  }

  if (bundles.length === 0) {
    throw new Error('No valid personas found in the selected file.');
  }

  return bundles;
}

