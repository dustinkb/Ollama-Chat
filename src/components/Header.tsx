import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bookmark,
  Check,
  ChevronDown,
  Loader2,
  Menu,
  Moon,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  SquarePen,
  Sun,
} from 'lucide-react';
import { OllamaModel, Persona, ThemeMode } from '../types/chat';

interface HeaderProps {
  onOpenSidebar: () => void;
  models: OllamaModel[];
  selectedModel: string;
  onSelectModel: (model: string) => void;
  modelsLoading: boolean;
  modelsError: string | null;
  onRefreshModels: () => void;
  ollamaUrl: string;
  onChangeOllamaUrl: (url: string) => void;
  personas: Persona[];
  activePersona: Persona | undefined;
  activePersonaMemoryCount: number;
  onSelectPersona: (id: string) => void;
  onOpenPersonaModal: (initialPersonaId?: string) => void;
  onSaveMemoryBookmark: () => void;
  isSummarizingMemory: boolean;
  memorySavedRecently: boolean;
  canBookmarkMemory: boolean;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onNewChat: () => void;
}

function formatModelSize(bytes?: number): string {
  if (!bytes) return '';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${Math.round(mb)} MB`;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSidebar,
  models,
  selectedModel,
  onSelectModel,
  modelsLoading,
  modelsError,
  onRefreshModels,
  ollamaUrl,
  onChangeOllamaUrl,
  personas,
  activePersona,
  activePersonaMemoryCount,
  onSelectPersona,
  onOpenPersonaModal,
  onSaveMemoryBookmark,
  isSummarizingMemory,
  memorySavedRecently,
  canBookmarkMemory,
  theme,
  onToggleTheme,
  onNewChat,
}) => {
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [personaMenuOpen, setPersonaMenuOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState(ollamaUrl);
  const [customModelDraft, setCustomModelDraft] = useState('');

  const modelRef = useRef<HTMLDivElement>(null);
  const personaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUrlDraft(ollamaUrl);
  }, [ollamaUrl]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setModelMenuOpen(false);
      }
      if (personaRef.current && !personaRef.current.contains(e.target as Node)) {
        setPersonaMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleApplyUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = urlDraft.trim();
    if (cleaned) {
      onChangeOllamaUrl(cleaned);
    }
  };

  const handleApplyCustomModel = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customModelDraft.trim();
    if (cleaned) {
      onSelectModel(cleaned);
      setCustomModelDraft('');
      setModelMenuOpen(false);
    }
  };

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-zinc-200/80 bg-[#F6F6F8]/85 px-3 backdrop-blur-md sm:px-4 dark:border-white/[0.07] dark:bg-black/85">
      {/* Left: Mobile Sidebar Toggle + Model & Persona Selectors */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-transparent text-zinc-600 transition-all duration-200 ease-in-out hover:border-zinc-200 hover:bg-white hover:text-zinc-900 hover:shadow-xs active:scale-[0.96] dark:text-zinc-400 dark:hover:border-white/[0.08] dark:hover:bg-[#111114] dark:hover:text-zinc-100 md:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-4 w-4" strokeWidth={1.5} />
        </button>

        {/* Model Selector */}
        <div className="relative" ref={modelRef}>
          <button
            type="button"
            onClick={() => {
              setModelMenuOpen((v) => !v);
              setPersonaMenuOpen(false);
            }}
            className="inline-flex h-9 max-w-[155px] sm:max-w-[220px] items-center gap-1.5 rounded-xl border border-zinc-200/90 bg-gradient-to-b from-white to-zinc-50/80 px-3 text-[12.5px] font-medium text-zinc-800 shadow-[0_2px_6px_-2px_rgba(0,0,0,0.06)] transition-all duration-200 ease-in-out hover:border-zinc-300 hover:shadow-sm active:scale-[0.98] dark:border-white/[0.09] dark:bg-gradient-to-b dark:from-[#141418] dark:to-[#0C0C0F] dark:text-zinc-200 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_12px_-4px_rgba(0,0,0,0.75)] dark:hover:border-white/[0.16]"
            title={selectedModel || 'Select Ollama model'}
          >
            <span className="truncate font-mono text-[12px]">
              {selectedModel || 'Select model'}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform duration-200 ${
                modelMenuOpen ? 'rotate-180' : ''
              }`}
              strokeWidth={1.5}
            />
          </button>

          <AnimatePresence>
            {modelMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                className="absolute left-0 top-full z-40 mt-2 w-72 origin-top-left rounded-xl border border-zinc-200/90 bg-white/95 p-2.5 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.16)] backdrop-blur-xl dark:border-white/[0.1] dark:bg-[#0E0E11]/95 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_50px_-12px_rgba(0,0,0,0.95)]"
              >
                <div className="flex items-center justify-between px-2 pb-1.5">
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                    Local Ollama Models
                  </span>
                  <button
                    type="button"
                    onClick={onRefreshModels}
                    disabled={modelsLoading}
                    className="inline-flex items-center gap-1 rounded-xl px-2 py-0.5 text-[11px] text-zinc-500 transition-all duration-200 hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.97] disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100"
                    title="Refresh models from Ollama"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${modelsLoading ? 'animate-spin' : ''}`}
                      strokeWidth={1.5}
                    />
                    <span>Refresh</span>
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto py-1">
                  {modelsError && (
                    <p className="px-2 py-2 text-[11.5px] leading-relaxed text-red-600 dark:text-red-400">
                      {modelsError}
                    </p>
                  )}

                  {!modelsError && models.length === 0 && !modelsLoading && (
                    <p className="px-2 py-2 text-[12px] text-zinc-500">
                      No models found. Run <code className="font-mono">ollama pull llama3.2</code> locally.
                    </p>
                  )}

                  {models.map((m) => {
                    const active = m.name === selectedModel;
                    const meta = [m.details?.parameter_size, formatModelSize(m.size)]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <button
                        key={m.name}
                        type="button"
                        onClick={() => {
                          onSelectModel(m.name);
                          setModelMenuOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left transition-all duration-200 ${
                          active
                            ? 'bg-zinc-100 text-zinc-950 shadow-xs dark:bg-white/[0.08] dark:text-white'
                            : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="truncate font-mono text-[12px]">{m.name}</div>
                          {meta && (
                            <div className="text-[10.5px] tabular-nums text-zinc-500">{meta}</div>
                          )}
                        </div>
                        {active && (
                          <Check
                            className="h-3.5 w-3.5 shrink-0 text-blue-500 dark:text-[#7AA2F7]"
                            strokeWidth={1.75}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Manual model tag entry */}
                <form
                  onSubmit={handleApplyCustomModel}
                  className="mt-1.5 flex items-center gap-1.5 border-t border-zinc-200/80 pt-2 dark:border-white/[0.08]"
                >
                  <input
                    type="text"
                    value={customModelDraft}
                    onChange={(e) => setCustomModelDraft(e.target.value)}
                    placeholder="Custom tag (e.g. qwen2.5:7b)"
                    className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 font-mono text-[11.5px] text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500/50 focus:outline-none dark:border-white/[0.08] dark:bg-black/70 dark:text-zinc-200 dark:placeholder:text-zinc-600"
                  />
                  <button
                    type="submit"
                    className="rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-zinc-700 shadow-xs transition-all duration-200 hover:bg-zinc-100 active:scale-[0.97] dark:border-white/[0.09] dark:bg-[#17171C] dark:text-zinc-200 dark:hover:bg-[#1F1F26]"
                  >
                    Use
                  </button>
                </form>

                {/* Ollama Base URL */}
                <form
                  onSubmit={handleApplyUrl}
                  className="mt-2 border-t border-zinc-200/80 pt-2 dark:border-white/[0.08]"
                >
                  <label className="mb-1 block text-[10.5px] text-zinc-500">
                    Ollama Endpoint
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={urlDraft}
                      onChange={(e) => setUrlDraft(e.target.value)}
                      className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 font-mono text-[11.5px] text-zinc-900 focus:border-blue-500/50 focus:outline-none dark:border-white/[0.08] dark:bg-black/70 dark:text-zinc-200"
                    />
                    <button
                      type="submit"
                      className="rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-zinc-700 shadow-xs transition-all duration-200 hover:bg-zinc-100 active:scale-[0.97] dark:border-white/[0.09] dark:bg-[#17171C] dark:text-zinc-200 dark:hover:bg-[#1F1F26]"
                    >
                      Save
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Persona Selector */}
        <div className="relative" ref={personaRef}>
          <button
            type="button"
            onClick={() => {
              setPersonaMenuOpen((v) => !v);
              setModelMenuOpen(false);
            }}
            className="inline-flex h-9 max-w-[160px] sm:max-w-[220px] items-center gap-1.5 rounded-xl border border-zinc-200/90 bg-gradient-to-b from-white to-zinc-50/80 px-3 text-[12.5px] font-medium text-zinc-800 shadow-[0_2px_6px_-2px_rgba(0,0,0,0.06)] transition-all duration-200 ease-in-out hover:border-zinc-300 hover:shadow-sm active:scale-[0.98] dark:border-white/[0.09] dark:bg-gradient-to-b dark:from-[#141418] dark:to-[#0C0C0F] dark:text-zinc-200 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_12px_-4px_rgba(0,0,0,0.75)] dark:hover:border-white/[0.16]"
            title="Switch active persona"
          >
            <span className="truncate">{activePersona?.name || 'Persona'}</span>
            {activePersonaMemoryCount > 0 && (
              <span className="hidden shrink-0 font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500 sm:inline">
                · {activePersonaMemoryCount}m
              </span>
            )}
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform duration-200 ${
                personaMenuOpen ? 'rotate-180' : ''
              }`}
              strokeWidth={1.5}
            />
          </button>

          <AnimatePresence>
            {personaMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                className="absolute left-0 top-full z-40 mt-2 w-64 origin-top-left rounded-xl border border-zinc-200/90 bg-white/95 p-2 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.16)] backdrop-blur-xl dark:border-white/[0.1] dark:bg-[#0E0E11]/95 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_50px_-12px_rgba(0,0,0,0.95)]"
              >
                <div className="px-2 py-1 text-[11px] font-medium text-zinc-500">
                  Personas
                </div>
                <div className="max-h-56 overflow-y-auto py-0.5">
                  {personas.map((persona) => {
                    const isSelected = persona.id === activePersona?.id;
                    return (
                      <button
                        key={persona.id}
                        type="button"
                        onClick={() => {
                          onSelectPersona(persona.id);
                          setPersonaMenuOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-[12.5px] transition-all duration-200 ${
                          isSelected
                            ? 'bg-zinc-100 text-zinc-950 shadow-xs dark:bg-white/[0.08] dark:text-white'
                            : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-white/[0.04]'
                        }`}
                      >
                        <span className="truncate pr-2">{persona.name}</span>
                        {isSelected && (
                          <Check
                            className="h-3.5 w-3.5 shrink-0 text-blue-500 dark:text-[#7AA2F7]"
                            strokeWidth={1.75}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-1 border-t border-zinc-200/80 pt-1.5 dark:border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => {
                      setPersonaMenuOpen(false);
                      onOpenPersonaModal(activePersona?.id);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-[12px] text-zinc-600 transition-all duration-200 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
                    <span>Manage personas & memories</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPersonaMenuOpen(false);
                      onOpenPersonaModal('__new__');
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-[12px] text-zinc-600 transition-all duration-200 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                    <span>New persona</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right: Bookmark/Memory, New Chat, Theme Toggle */}
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onSaveMemoryBookmark}
          disabled={!canBookmarkMemory || isSummarizingMemory}
          title={
            !canBookmarkMemory
              ? 'Send at least one message before saving memory'
              : `Summarize conversation into memory for "${activePersona?.name || 'persona'}"`
          }
          aria-label="Save conversation memory to active persona"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-zinc-600 transition-all duration-200 ease-in-out hover:border-zinc-200 hover:bg-white hover:text-zinc-950 hover:shadow-xs active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-transparent disabled:hover:bg-transparent disabled:hover:shadow-none dark:text-zinc-400 dark:hover:border-white/[0.08] dark:hover:bg-[#141418] dark:hover:text-zinc-100"
        >
          {isSummarizingMemory ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-500 dark:text-[#7AA2F7]" strokeWidth={1.5} />
          ) : memorySavedRecently ? (
            <Check className="h-4 w-4 text-blue-500 dark:text-[#7AA2F7]" strokeWidth={1.75} />
          ) : (
            <Bookmark className="h-4 w-4" strokeWidth={1.5} />
          )}
        </button>

        <button
          type="button"
          onClick={onNewChat}
          title="New chat"
          aria-label="New chat"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-zinc-600 transition-all duration-200 ease-in-out hover:border-zinc-200 hover:bg-white hover:text-zinc-950 hover:shadow-xs active:scale-[0.95] dark:text-zinc-400 dark:hover:border-white/[0.08] dark:hover:bg-[#141418] dark:hover:text-zinc-100"
        >
          <SquarePen className="h-4 w-4" strokeWidth={1.5} />
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to AMOLED dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to AMOLED dark mode'}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-zinc-600 transition-all duration-200 ease-in-out hover:border-zinc-200 hover:bg-white hover:text-zinc-950 hover:shadow-xs active:scale-[0.95] dark:text-zinc-400 dark:hover:border-white/[0.08] dark:hover:bg-[#141418] dark:hover:text-zinc-100"
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4" strokeWidth={1.5} />
          ) : (
            <Moon className="h-4 w-4" strokeWidth={1.5} />
          )}
        </button>
      </div>
    </header>
  );
};
