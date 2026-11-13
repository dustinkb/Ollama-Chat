import { ChatMessage, OllamaModel, Persona, PersonaMemory } from '../types/chat';

export const MEMORY_SUMMARIZATION_INSTRUCTION =
  'Summarize the key reusable context from this conversation. Focus on durable facts, user preferences, project decisions, terminology, constraints, and implementation details. Do not include small talk. Do not include temporary mood unless it is relevant to the project. Write concise bullet points. This memory will be saved only for the currently active persona.';

const MAX_MEMORY_INJECTION_CHARS = 2400;

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

export function formatOllamaError(error: unknown, baseUrl: string): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'Request cancelled.';
  }
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('Load failed') ||
    message.includes('fetch')
  ) {
    return `Could not connect to Ollama at ${normalizeBaseUrl(baseUrl)}. Ensure Ollama is running locally (and if accessed from another origin, set OLLAMA_ORIGINS="*").`;
  }
  return message || 'Unexpected error communicating with Ollama.';
}

export async function fetchOllamaModels(baseUrl: string, signal?: AbortSignal): Promise<OllamaModel[]> {
  const url = `${normalizeBaseUrl(baseUrl)}/api/tags`;
  const res = await fetch(url, {
    method: 'GET',
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ollama returned ${res.status}${text ? `: ${text}` : ''}`);
  }

  const data = (await res.json()) as { models?: OllamaModel[] };
  return Array.isArray(data.models) ? data.models : [];
}

/**
 * Builds the concise system message combining the active persona prompt
 * and ONLY memories linked to that persona.
 */
export function buildPersonaSystemMessage(
  persona: Persona | undefined,
  personaMemories: PersonaMemory[]
): string {
  const promptText = persona?.systemPrompt?.trim() || 'You are a helpful assistant.';

  if (!personaMemories || personaMemories.length === 0) {
    return `System prompt:\n${promptText}`;
  }

  // Sort newest memories first and keep within concise character budget
  const sorted = [...personaMemories].sort((a, b) => b.updatedAt - a.updatedAt);
  const includedSummaries: string[] = [];
  let charCount = 0;

  for (const mem of sorted) {
    const trimmed = mem.summary.trim();
    if (!trimmed) continue;
    if (charCount + trimmed.length > MAX_MEMORY_INJECTION_CHARS && includedSummaries.length > 0) {
      break;
    }
    includedSummaries.push(trimmed);
    charCount += trimmed.length;
  }

  if (includedSummaries.length === 0) {
    return `System prompt:\n${promptText}`;
  }

  return [
    'System prompt:',
    promptText,
    '',
    'Relevant saved memories for this persona:',
    includedSummaries.join('\n\n'),
  ].join('\n');
}

interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamChatParams {
  baseUrl: string;
  model: string;
  persona: Persona | undefined;
  personaMemories: PersonaMemory[];
  messages: ChatMessage[];
  signal?: AbortSignal;
  onToken: (accumulatedText: string) => void;
}

export async function streamOllamaChat({
  baseUrl,
  model,
  persona,
  personaMemories,
  messages,
  signal,
  onToken,
}: StreamChatParams): Promise<string> {
  if (!model.trim()) {
    throw new Error('No Ollama model selected. Pull or select a model first.');
  }

  const systemContent = buildPersonaSystemMessage(persona, personaMemories);
  const apiMessages: OllamaChatMessage[] = [
    { role: 'system', content: systemContent },
    ...messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  const url = `${normalizeBaseUrl(baseUrl)}/api/chat`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: apiMessages,
      stream: true,
    }),
    signal,
  });

  if (!res.ok) {
    let errorDetail = '';
    try {
      const errJson = (await res.json()) as { error?: string };
      errorDetail = errJson.error || '';
    } catch {
      errorDetail = await res.text().catch(() => '');
    }
    throw new Error(`Ollama error (${res.status})${errorDetail ? `: ${errorDetail}` : ''}`);
  }

  if (!res.body) {
    throw new Error('Ollama returned an empty response stream.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed) as {
          error?: string;
          message?: { content?: string };
          done?: boolean;
        };
        if (parsed.error) {
          throw new Error(parsed.error);
        }
        if (parsed.message?.content) {
          accumulated += parsed.message.content;
          onToken(accumulated);
        }
      } catch (err) {
        if (err instanceof SyntaxError) {
          // Partial line, ignore until complete
          continue;
        }
        throw err;
      }
    }
  }

  // Flush any remaining buffered JSON line
  const remaining = buffer.trim();
  if (remaining) {
    try {
      const parsed = JSON.parse(remaining) as {
        error?: string;
        message?: { content?: string };
      };
      if (parsed.error) {
        throw new Error(parsed.error);
      }
      if (parsed.message?.content) {
        accumulated += parsed.message.content;
        onToken(accumulated);
      }
    } catch (err) {
      if (!(err instanceof SyntaxError)) {
        throw err;
      }
    }
  }

  return accumulated;
}

export interface SummarizeMemoryParams {
  baseUrl: string;
  model: string;
  personaName: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
}

export async function summarizeConversationMemory({
  baseUrl,
  model,
  personaName,
  messages,
  signal,
}: SummarizeMemoryParams): Promise<string> {
  if (!model.trim()) {
    throw new Error('Select an Ollama model before saving a memory.');
  }
  if (messages.length === 0) {
    throw new Error('Cannot summarize an empty conversation.');
  }

  const transcript = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  const url = `${normalizeBaseUrl(baseUrl)}/api/chat`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: 'system',
          content: MEMORY_SUMMARIZATION_INSTRUCTION,
        },
        {
          role: 'user',
          content: `Active persona: ${personaName}\n\nConversation transcript:\n\n${transcript}`,
        },
      ],
    }),
    signal,
  });

  if (!res.ok) {
    let errorDetail = '';
    try {
      const errJson = (await res.json()) as { error?: string };
      errorDetail = errJson.error || '';
    } catch {
      errorDetail = await res.text().catch(() => '');
    }
    throw new Error(`Memory summarization failed (${res.status})${errorDetail ? `: ${errorDetail}` : ''}`);
  }

  const data = (await res.json()) as {
    error?: string;
    message?: { content?: string };
  };

  if (data.error) {
    throw new Error(data.error);
  }

  const summary = data.message?.content?.trim();
  if (!summary) {
    throw new Error('Model returned an empty memory summary.');
  }

  return summary;
}
