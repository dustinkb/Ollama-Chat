export type ThemeMode = 'dark' | 'light';

export type ModelProvider = 'ollama' | 'openrouter';

export interface Persona {
  id: string;
  name: string;
  systemPrompt: string;
  createdAt: number;
  updatedAt: number;
}

export interface PersonaMemory {
  id: string;
  personaId: string;
  summary: string;
  sourceConversationId?: string;
  sourceConversationTitle?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  provider?: ModelProvider;
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  personaId: string;
  model: string;
  provider?: ModelProvider;
  pinned: boolean;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface OllamaModel {
  name: string;
  model: string;
  size: number;
  modified_at?: string;
  details?: {
    parameter_size?: string;
    quantization_level?: string;
    family?: string;
  };
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length?: number | null;
  pricing?: {
    prompt?: string;
    completion?: string;
    request?: string;
    image?: string;
  };
  architecture?: {
    modality?: string;
    tokenizer?: string;
    instruct_type?: string | null;
  };
}

