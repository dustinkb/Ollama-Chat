export type ThemeMode = 'dark' | 'light';

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
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  personaId: string;
  model: string;
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
