import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { ChatArea } from './components/ChatArea';
import { Header } from './components/Header';
import { PersonaModal } from './components/PersonaModal';
import { Sidebar } from './components/Sidebar';
import {
  exportAllConversationsAsJson,
  exportAllConversationsAsMarkdown,
  exportConversationAsJson,
  exportConversationAsMarkdown,
} from './services/export';
import {
  fetchOllamaModels,
  formatOllamaError,
  streamOllamaChat,
  summarizeConversationMemory,
} from './services/ollama';
import {
  loadActiveConversationId,
  loadActivePersonaId,
  loadConversations,
  loadMemories,
  loadOllamaUrl,
  loadPersonas,
  loadSelectedModel,
  loadTheme,
  saveActiveConversationId,
  saveActivePersonaId,
  saveConversations,
  saveMemories,
  saveOllamaUrl,
  savePersonas,
  saveSelectedModel,
  saveTheme,
} from './services/storage';
import {
  ChatMessage,
  Conversation,
  OllamaModel,
  Persona,
  PersonaMemory,
  ThemeMode,
} from './types/chat';

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function deriveConversationTitle(firstMessage: string): string {
  const singleLine = firstMessage.replace(/\s+/g, ' ').trim();
  if (!singleLine) return 'Untitled note';
  return singleLine.length > 48 ? `${singleLine.slice(0, 48)}...` : singleLine;
}

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme());
  const [ollamaUrl, setOllamaUrl] = useState<string>(() => loadOllamaUrl());
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(() => loadSelectedModel());
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const [personas, setPersonas] = useState<Persona[]>(() => loadPersonas());
  const [memories, setMemories] = useState<PersonaMemory[]>(() => loadMemories());
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations());

  const [activePersonaId, setActivePersonaId] = useState<string>(() => loadActivePersonaId());
  const [activeConversationId, setActiveConversationId] = useState<string | null>(() =>
    loadActiveConversationId()
  );

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [personaModalOpen, setPersonaModalOpen] = useState(false);
  const [personaModalInitialId, setPersonaModalInitialId] = useState<string | undefined>(undefined);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSummarizingMemory, setIsSummarizingMemory] = useState(false);
  const [memorySavedRecently, setMemorySavedRecently] = useState(false);
  const [memoryNotice, setMemoryNotice] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    saveTheme(theme);
  }, [theme]);

  // Persist local state changes
  useEffect(() => {
    saveOllamaUrl(ollamaUrl);
  }, [ollamaUrl]);

  useEffect(() => {
    saveSelectedModel(selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    savePersonas(personas);
  }, [personas]);

  useEffect(() => {
    saveMemories(memories);
  }, [memories]);

  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    saveActivePersonaId(activePersonaId);
  }, [activePersonaId]);

  useEffect(() => {
    saveActiveConversationId(activeConversationId);
  }, [activeConversationId]);

  // Ensure activePersonaId always points to an existing persona
  const activePersona = useMemo(() => {
    return personas.find((p) => p.id === activePersonaId) || personas[0];
  }, [personas, activePersonaId]);

  // Strictly scoped memories for ONLY the active persona
  const activePersonaMemories = useMemo(() => {
    if (!activePersona) return [];
    return memories.filter((m) => m.personaId === activePersona.id);
  }, [memories, activePersona]);

  const activeConversation = useMemo(() => {
    if (!activeConversationId) return null;
    return conversations.find((c) => c.id === activeConversationId) || null;
  }, [conversations, activeConversationId]);

  // Fetch local Ollama models
  const refreshModels = useCallback(async (targetUrl: string) => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const fetched = await fetchOllamaModels(targetUrl);
      setModels(fetched);
      if (fetched.length > 0) {
        setSelectedModel((current) => {
          if (current && fetched.some((m) => m.name === current)) {
            return current;
          }
          return fetched[0].name;
        });
      }
    } catch (err) {
      setModelsError(formatOllamaError(err, targetUrl));
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshModels(ollamaUrl);
  }, [ollamaUrl, refreshModels]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleNewChat = () => {
    if (isGenerating) {
      abortControllerRef.current?.abort();
      setIsGenerating(false);
    }
    setActiveConversationId(null);
    setChatError(null);
    setMemoryNotice(null);
  };

  const handleSelectConversation = (id: string) => {
    if (isGenerating) {
      abortControllerRef.current?.abort();
      setIsGenerating(false);
    }
    setActiveConversationId(id);
    setChatError(null);
    setMemoryNotice(null);
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      if (personas.some((p) => p.id === conv.personaId)) {
        setActivePersonaId(conv.personaId);
      }
      if (conv.model) {
        setSelectedModel(conv.model);
      }
    }
  };

  const handleSelectPersona = (personaId: string) => {
    setActivePersonaId(personaId);
    if (activeConversationId) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversationId ? { ...c, personaId, updatedAt: Date.now() } : c
        )
      );
    }
  };

  const handleTogglePin = (id: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c))
    );
  };

  const handleRenameConversation = (id: string, title: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title, updatedAt: Date.now() } : c))
    );
  };

  const handleDeleteConversation = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConversationId === id) {
      setActiveConversationId(null);
      setChatError(null);
    }
  };

  const executeChatCompletion = async (
    conversationId: string,
    historyMessages: ChatMessage[],
    modelToUse: string,
    personaToUse: Persona | undefined,
    scopedMemories: PersonaMemory[]
  ) => {
    const assistantMsgId = generateId('msg');
    const placeholderAssistant: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      model: modelToUse,
      createdAt: Date.now(),
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              model: modelToUse,
              messages: [...historyMessages, placeholderAssistant],
              updatedAt: Date.now(),
            }
          : c
      )
    );

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsGenerating(true);
    setChatError(null);

    try {
      const fullReply = await streamOllamaChat({
        baseUrl: ollamaUrl,
        model: modelToUse,
        persona: personaToUse,
        personaMemories: scopedMemories,
        messages: historyMessages,
        signal: controller.signal,
        onToken: (accumulated) => {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === conversationId
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === assistantMsgId ? { ...m, content: accumulated } : m
                    ),
                    updatedAt: Date.now(),
                  }
                : c
            )
          );
        },
      });

      if (!fullReply.trim()) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: c.messages.filter((m) => m.id !== assistantMsgId),
                }
              : c
          )
        );
      }
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      if (!isAbort) {
        setChatError(formatOllamaError(err, ollamaUrl));
      }
      // Remove empty assistant placeholder if generation failed before any token
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: c.messages.filter(
                  (m) => !(m.id === assistantMsgId && m.content.trim() === '')
                ),
              }
            : c
        )
      );
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleSendMessage = async (content: string) => {
    const modelToUse = selectedModel.trim() || models[0]?.name || '';
    if (!modelToUse) {
      setChatError(
        `No Ollama model selected. Connect to Ollama at ${ollamaUrl} or enter a custom model tag in the model selector.`
      );
      return;
    }

    const now = Date.now();
    const userMessage: ChatMessage = {
      id: generateId('msg'),
      role: 'user',
      content,
      createdAt: now,
    };

    let targetConversationId = activeConversationId;
    let updatedMessages: ChatMessage[] = [];

    if (!targetConversationId || !activeConversation) {
      targetConversationId = generateId('conv');
      const newConv: Conversation = {
        id: targetConversationId,
        title: deriveConversationTitle(content),
        personaId: activePersona?.id || activePersonaId,
        model: modelToUse,
        pinned: false,
        messages: [userMessage],
        createdAt: now,
        updatedAt: now,
      };
      updatedMessages = newConv.messages;
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(targetConversationId);
    } else {
      updatedMessages = [...activeConversation.messages, userMessage];
      setConversations((prev) =>
        prev.map((c) =>
          c.id === targetConversationId
            ? {
                ...c,
                messages: updatedMessages,
                updatedAt: now,
              }
            : c
        )
      );
    }

    await executeChatCompletion(
      targetConversationId,
      updatedMessages,
      modelToUse,
      activePersona,
      activePersonaMemories
    );
  };

  const handleStopGenerating = () => {
    abortControllerRef.current?.abort();
  };

  const handleRetryLast = async () => {
    if (!activeConversation || isGenerating) return;
    const msgs = [...activeConversation.messages];
    // If last message is a partial/failed assistant reply, drop it before retrying
    while (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
      msgs.pop();
    }
    if (msgs.length === 0) return;

    const modelToUse = selectedModel.trim() || activeConversation.model || models[0]?.name || '';
    await executeChatCompletion(
      activeConversation.id,
      msgs,
      modelToUse,
      activePersona,
      activePersonaMemories
    );
  };

  // Bookmark / Memory Summarization linked ONLY to active persona
  const handleSaveMemoryBookmark = async () => {
    if (!activeConversation || activeConversation.messages.length === 0 || !activePersona) {
      return;
    }
    const modelToUse = selectedModel.trim() || activeConversation.model || models[0]?.name || '';
    if (!modelToUse) {
      setChatError('Select an Ollama model before saving a memory.');
      return;
    }

    setIsSummarizingMemory(true);
    setChatError(null);
    setMemoryNotice(null);

    try {
      const summary = await summarizeConversationMemory({
        baseUrl: ollamaUrl,
        model: modelToUse,
        personaName: activePersona.name,
        messages: activeConversation.messages,
      });

      const now = Date.now();
      const newMemory: PersonaMemory = {
        id: generateId('mem'),
        personaId: activePersona.id,
        summary,
        sourceConversationId: activeConversation.id,
        sourceConversationTitle: activeConversation.title,
        createdAt: now,
        updatedAt: now,
      };

      setMemories((prev) => [newMemory, ...prev]);
      setMemorySavedRecently(true);
      setMemoryNotice(`Saved memory to "${activePersona.name}".`);
      setTimeout(() => setMemorySavedRecently(false), 2200);
    } catch (err) {
      setChatError(formatOllamaError(err, ollamaUrl));
    } finally {
      setIsSummarizingMemory(false);
    }
  };

  // Persona CRUD
  const handleCreatePersona = (name: string, systemPrompt: string): Persona => {
    const now = Date.now();
    const created: Persona = {
      id: generateId('persona'),
      name,
      systemPrompt,
      createdAt: now,
      updatedAt: now,
    };
    setPersonas((prev) => [...prev, created]);
    return created;
  };

  const handleUpdatePersona = (id: string, name: string, systemPrompt: string) => {
    setPersonas((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name, systemPrompt, updatedAt: Date.now() } : p))
    );
  };

  const handleDeletePersona = (id: string) => {
    if (personas.length <= 1) return;
    const remaining = personas.filter((p) => p.id !== id);
    setPersonas(remaining);
    // Remove memories coupled to deleted persona
    setMemories((prev) => prev.filter((m) => m.personaId !== id));
    if (activePersonaId === id && remaining[0]) {
      setActivePersonaId(remaining[0].id);
    }
  };

  // PersonaMemory CRUD
  const handleAddMemory = (personaId: string, summary: string) => {
    const now = Date.now();
    const newMem: PersonaMemory = {
      id: generateId('mem'),
      personaId,
      summary,
      createdAt: now,
      updatedAt: now,
    };
    setMemories((prev) => [newMem, ...prev]);
  };

  const handleUpdateMemory = (memoryId: string, summary: string) => {
    setMemories((prev) =>
      prev.map((m) => (m.id === memoryId ? { ...m, summary, updatedAt: Date.now() } : m))
    );
  };

  const handleDeleteMemory = (memoryId: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== memoryId));
  };

  const openPersonaModal = (initialId?: string) => {
    setPersonaModalInitialId(initialId);
    setPersonaModalOpen(true);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex h-dvh w-screen overflow-hidden bg-[#F6F6F8] text-zinc-900 dark:bg-black dark:text-zinc-100">
        <Sidebar
          isOpen={sidebarOpen}
          onCloseMobile={() => setSidebarOpen(false)}
          conversations={conversations}
          activeConversationId={activeConversationId}
          activeConversation={activeConversation}
          personas={personas}
          onSelectConversation={handleSelectConversation}
          onNewChat={handleNewChat}
          onTogglePin={handleTogglePin}
          onRenameConversation={handleRenameConversation}
          onDeleteConversation={handleDeleteConversation}
          onExportCurrentMarkdown={() => {
            if (activeConversation) {
              exportConversationAsMarkdown(activeConversation, personas);
            }
          }}
          onExportCurrentJson={() => {
            if (activeConversation) {
              exportConversationAsJson(activeConversation, personas);
            }
          }}
          onExportAllMarkdown={() => {
            if (conversations.length > 0) {
              exportAllConversationsAsMarkdown(conversations, personas);
            }
          }}
          onExportAllJson={() => {
            if (conversations.length > 0) {
              exportAllConversationsAsJson(conversations, personas);
            }
          }}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            onOpenSidebar={() => setSidebarOpen(true)}
            models={models}
            selectedModel={selectedModel}
            onSelectModel={(model) => {
              setSelectedModel(model);
              if (activeConversationId) {
                setConversations((prev) =>
                  prev.map((c) => (c.id === activeConversationId ? { ...c, model } : c))
                );
              }
            }}
            modelsLoading={modelsLoading}
            modelsError={modelsError}
            onRefreshModels={() => refreshModels(ollamaUrl)}
            ollamaUrl={ollamaUrl}
            onChangeOllamaUrl={(url) => setOllamaUrl(url)}
            personas={personas}
            activePersona={activePersona}
            activePersonaMemoryCount={activePersonaMemories.length}
            onSelectPersona={handleSelectPersona}
            onOpenPersonaModal={openPersonaModal}
            onSaveMemoryBookmark={handleSaveMemoryBookmark}
            isSummarizingMemory={isSummarizingMemory}
            memorySavedRecently={memorySavedRecently}
            canBookmarkMemory={Boolean(
              activeConversation && activeConversation.messages.length > 0 && !isGenerating
            )}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            onNewChat={handleNewChat}
          />

          <ChatArea
            conversationKey={activeConversationId || '__new__'}
            messages={activeConversation?.messages || []}
            activePersona={activePersona}
            activePersonaMemoryCount={activePersonaMemories.length}
            selectedModel={selectedModel}
            isGenerating={isGenerating}
            isSummarizingMemory={isSummarizingMemory}
            error={chatError}
            memoryNotice={memoryNotice}
            onDismissError={() => setChatError(null)}
            onDismissMemoryNotice={() => setMemoryNotice(null)}
            onSendMessage={handleSendMessage}
            onStopGenerating={handleStopGenerating}
            onRetryLast={handleRetryLast}
            onOpenPersonaModal={() => openPersonaModal(activePersona?.id)}
          />
        </div>

        <PersonaModal
          isOpen={personaModalOpen}
          initialPersonaId={personaModalInitialId}
          personas={personas}
          activePersonaId={activePersona?.id || activePersonaId}
          memories={memories}
          onClose={() => setPersonaModalOpen(false)}
          onSelectActivePersona={handleSelectPersona}
          onCreatePersona={handleCreatePersona}
          onUpdatePersona={handleUpdatePersona}
          onDeletePersona={handleDeletePersona}
          onAddMemory={handleAddMemory}
          onUpdateMemory={handleUpdateMemory}
          onDeleteMemory={handleDeleteMemory}
        />
      </div>
    </MotionConfig>
  );
}
