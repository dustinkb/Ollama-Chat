import { ChatMessage, OpenRouterModel, Persona, PersonaMemory } from '../types/chat';
import { buildPersonaSystemMessage, MEMORY_SUMMARIZATION_INSTRUCTION } from './ollama';

export interface OpenRouterModelsResponse {
  models: OpenRouterModel[];
  totalFetched: number;
  configured: boolean;
}

export function formatOpenRouterError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'Request cancelled.';
  }
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('Load failed')
  ) {
    return 'Could not reach the local server proxy for OpenRouter. Ensure the dev server is running.';
  }
  return message || 'Unexpected error communicating with OpenRouter.';
}

export async function fetchOpenRouterModels(
  signal?: AbortSignal
): Promise<OpenRouterModelsResponse> {
  const res = await fetch('/api/openrouter/models', {
    method: 'GET',
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
    throw new Error(
      errorDetail || `OpenRouter models request failed (${res.status}).`
    );
  }

  const data = (await res.json()) as Partial<OpenRouterModelsResponse>;
  return {
    models: Array.isArray(data.models) ? data.models : [],
    totalFetched: typeof data.totalFetched === 'number' ? data.totalFetched : 0,
    configured: Boolean(data.configured),
  };
}

interface OpenRouterApiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamOpenRouterChatParams {
  model: string;
  persona: Persona | undefined;
  personaMemories: PersonaMemory[];
  messages: ChatMessage[];
  signal?: AbortSignal;
  onToken: (accumulatedText: string) => void;
}

export async function streamOpenRouterChat({
  model,
  persona,
  personaMemories,
  messages,
  signal,
  onToken,
}: StreamOpenRouterChatParams): Promise<string> {
  if (!model.trim()) {
    throw new Error('No OpenRouter model selected. Choose a free model first.');
  }

  const systemContent = buildPersonaSystemMessage(persona, personaMemories);
  const apiMessages: OpenRouterApiMessage[] = [
    { role: 'system', content: systemContent },
    ...messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  const res = await fetch('/api/openrouter/chat', {
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
      const errJson = (await res.json()) as { error?: string | { message?: string } };
      if (typeof errJson.error === 'string') {
        errorDetail = errJson.error;
      } else if (errJson.error?.message) {
        errorDetail = errJson.error.message;
      }
    } catch {
      errorDetail = await res.text().catch(() => '');
    }
    throw new Error(errorDetail || `OpenRouter error (${res.status})`);
  }

  if (!res.body) {
    throw new Error('OpenRouter returned an empty response stream.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';

  const processLine = (rawLine: string) => {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith(':')) {
      return;
    }
    if (!trimmed.startsWith('data:')) {
      return;
    }

    const dataStr = trimmed.slice(5).trim();
    if (!dataStr || dataStr === '[DONE]') {
      return;
    }

    try {
      const parsed = JSON.parse(dataStr) as {
        error?: { message?: string } | string;
        choices?: Array<{
          delta?: { content?: string | null };
          message?: { content?: string | null };
        }>;
      };

      if (parsed.error) {
        const msg =
          typeof parsed.error === 'string'
            ? parsed.error
            : parsed.error.message || 'OpenRouter stream error.';
        throw new Error(msg);
      }

      const deltaContent =
        parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content;
      if (typeof deltaContent === 'string' && deltaContent.length > 0) {
        accumulated += deltaContent;
        onToken(accumulated);
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        return;
      }
      throw err;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      processLine(line);
    }
  }

  if (buffer.trim()) {
    processLine(buffer);
  }

  return accumulated;
}

export interface SummarizeOpenRouterMemoryParams {
  model: string;
  personaName: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
}

export async function summarizeOpenRouterMemory({
  model,
  personaName,
  messages,
  signal,
}: SummarizeOpenRouterMemoryParams): Promise<string> {
  if (!model.trim()) {
    throw new Error('Select an OpenRouter model before saving a memory.');
  }
  if (messages.length === 0) {
    throw new Error('Cannot summarize an empty conversation.');
  }

  const transcript = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  const res = await fetch('/api/openrouter/chat', {
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
      const errJson = (await res.json()) as { error?: string | { message?: string } };
      if (typeof errJson.error === 'string') {
        errorDetail = errJson.error;
      } else if (errJson.error?.message) {
        errorDetail = errJson.error.message;
      }
    } catch {
      errorDetail = await res.text().catch(() => '');
    }
    throw new Error(
      `Memory summarization failed (${res.status})${errorDetail ? `: ${errorDetail}` : ''}`
    );
  }

  const data = (await res.json()) as {
    error?: { message?: string } | string;
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  if (data.error) {
    const msg =
      typeof data.error === 'string'
        ? data.error
        : data.error.message || 'OpenRouter returned an error.';
    throw new Error(msg);
  }

  const summary = data.choices?.[0]?.message?.content?.trim();
  if (!summary) {
    throw new Error('Model returned an empty memory summary.');
  }

  return summary;
}
