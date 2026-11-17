import { Conversation, ModelProvider, Persona, PersonaMemory, ThemeMode } from '../types/chat';

const STORAGE_KEYS = {
  THEME: 'voidchat_theme_v1',
  OLLAMA_URL: 'voidchat_ollama_url_v1',
  ACTIVE_PROVIDER: 'voidchat_active_provider_v1',
  SELECTED_MODEL: 'voidchat_selected_model_v1',
  SELECTED_OPENROUTER_MODEL: 'voidchat_selected_openrouter_model_v1',
  ACTIVE_PERSONA_ID: 'voidchat_active_persona_id_v1',
  ACTIVE_CONVERSATION_ID: 'voidchat_active_conversation_id_v1',
  PERSONAS: 'voidchat_personas_v1',
  MEMORIES: 'voidchat_memories_v1',
  CONVERSATIONS: 'voidchat_conversations_v1',
} as const;

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

export const DEFAULT_PERSONAS: Persona[] = [
  {
    id: 'persona-default',
    name: 'Default',
    systemPrompt:
      'You are a clear, concise, and thoughtful assistant. Provide direct, accurate answers without unnecessary filler.',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: 'persona-engineer',
    name: 'Systems Engineer',
    systemPrompt:
      'You are a pragmatic senior systems and software engineer. Prioritize correctness, minimal complexity, clean tradeoffs, and production-ready code.',
    createdAt: 1700000001000,
    updatedAt: 1700000001000,
  },
];

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function loadTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    return saved === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function saveTheme(theme: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  } catch {
    // Ignore
  }
}

export function loadOllamaUrl(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.OLLAMA_URL);
    return saved && saved.trim() ? saved.trim() : DEFAULT_OLLAMA_URL;
  } catch {
    return DEFAULT_OLLAMA_URL;
  }
}

export function saveOllamaUrl(url: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.OLLAMA_URL, url.trim() || DEFAULT_OLLAMA_URL);
  } catch {
    // Ignore
  }
}

export function loadProvider(): ModelProvider {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_PROVIDER);
    return saved === 'openrouter' ? 'openrouter' : 'ollama';
  } catch {
    return 'ollama';
  }
}

export function saveProvider(provider: ModelProvider): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PROVIDER, provider);
  } catch {
    // Ignore
  }
}

export function loadSelectedModel(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.SELECTED_MODEL) || '';
  } catch {
    return '';
  }
}

export function saveSelectedModel(model: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SELECTED_MODEL, model);
  } catch {
    // Ignore
  }
}

export function loadSelectedOpenRouterModel(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.SELECTED_OPENROUTER_MODEL) || '';
  } catch {
    return '';
  }
}

export function saveSelectedOpenRouterModel(model: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SELECTED_OPENROUTER_MODEL, model);
  } catch {
    // Ignore
  }
}

export function loadPersonas(): Persona[] {
  const saved = safeReadJson<Persona[] | null>(STORAGE_KEYS.PERSONAS, null);
  if (Array.isArray(saved) && saved.length > 0) {
    return saved;
  }
  return DEFAULT_PERSONAS;
}

export function savePersonas(personas: Persona[]): void {
  safeWriteJson(STORAGE_KEYS.PERSONAS, personas);
}

export function loadMemories(): PersonaMemory[] {
  const saved = safeReadJson<PersonaMemory[]>(STORAGE_KEYS.MEMORIES, []);
  return Array.isArray(saved) ? saved : [];
}

export function saveMemories(memories: PersonaMemory[]): void {
  safeWriteJson(STORAGE_KEYS.MEMORIES, memories);
}

export function loadConversations(): Conversation[] {
  const saved = safeReadJson<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, []);
  return Array.isArray(saved) ? saved : [];
}

export function saveConversations(conversations: Conversation[]): void {
  safeWriteJson(STORAGE_KEYS.CONVERSATIONS, conversations);
}

export function loadActivePersonaId(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_PERSONA_ID) || DEFAULT_PERSONAS[0].id;
  } catch {
    return DEFAULT_PERSONAS[0].id;
  }
}

export function saveActivePersonaId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PERSONA_ID, id);
  } catch {
    // Ignore
  }
}

export function loadActiveConversationId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_CONVERSATION_ID);
  } catch {
    return null;
  }
}

export function saveActiveConversationId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_CONVERSATION_ID, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_CONVERSATION_ID);
    }
  } catch {
    // Ignore
  }
}
