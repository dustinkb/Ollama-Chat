import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Globe,
  HardDrive,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { ModelProvider, OllamaModel, OpenRouterModel } from '../types/chat';

interface ModelSelectorProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
  activeProvider: ModelProvider;
  onSelectProvider: (provider: ModelProvider) => void;
  selectedModel: string;
  onSelectModel: (provider: ModelProvider, model: string) => void;
  // Ollama props
  ollamaModels: OllamaModel[];
  ollamaLoading: boolean;
  ollamaError: string | null;
  onRefreshOllama: () => void;
  ollamaUrl: string;
  onChangeOllamaUrl: (url: string) => void;
  // OpenRouter props
  openRouterModels: OpenRouterModel[];
  openRouterLoading: boolean;
  openRouterError: string | null;
  openRouterConfigured: boolean;
  onRefreshOpenRouter: () => void;
}

function formatModelSize(bytes?: number): string {
  if (!bytes) return '';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${Math.round(mb)} MB`;
}

function formatContextLength(ctx?: number | null): string {
  if (!ctx || ctx <= 0) return '';
  if (ctx >= 1000000) return `${(ctx / 1000000).toFixed(1).replace(/\.0$/, '')}M ctx`;
  if (ctx >= 1000) return `${Math.round(ctx / 1000)}K ctx`;
  return `${ctx} ctx`;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  isOpen,
  onToggleOpen,
  onClose,
  activeProvider,
  onSelectProvider,
  selectedModel,
  onSelectModel,
  ollamaModels,
  ollamaLoading,
  ollamaError,
  onRefreshOllama,
  ollamaUrl,
  onChangeOllamaUrl,
  openRouterModels,
  openRouterLoading,
  openRouterError,
  openRouterConfigured,
  onRefreshOpenRouter,
}) => {
  const [viewProvider, setViewProvider] = useState<ModelProvider>(activeProvider);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [urlDraft, setUrlDraft] = useState(ollamaUrl);
  const [customModelDraft, setCustomModelDraft] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUrlDraft(ollamaUrl);
  }, [ollamaUrl]);

  useEffect(() => {
    if (isOpen) {
      setViewProvider(activeProvider);
      setSearchQuery('');
      setHighlightedIndex(0);
      const timer = window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 30);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen, activeProvider]);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen, onClose]);

  const filteredOpenRouterModels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return openRouterModels;
    const terms = q.split(/\s+/).filter(Boolean);
    return openRouterModels.filter((m) => {
      const haystack = `${m.name} ${m.id} ${m.description || ''}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [openRouterModels, searchQuery]);

  const filteredOllamaModels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ollamaModels;
    const terms = q.split(/\s+/).filter(Boolean);
    return ollamaModels.filter((m) => {
      const haystack = `${m.name} ${m.details?.family || ''} ${m.details?.parameter_size || ''}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [ollamaModels, searchQuery]);

  const visibleCount =
    viewProvider === 'openrouter'
      ? filteredOpenRouterModels.length
      : filteredOllamaModels.length;

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery, viewProvider]);

  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>(
      `[data-model-index="${highlightedIndex}"]`
    );
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  const handleSwitchTab = (provider: ModelProvider) => {
    setViewProvider(provider);
    setSearchQuery('');
    setHighlightedIndex(0);
    onSelectProvider(provider);
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (visibleCount === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % visibleCount);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + visibleCount) % visibleCount);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (viewProvider === 'openrouter') {
        const picked = filteredOpenRouterModels[highlightedIndex];
        if (picked) {
          onSelectModel('openrouter', picked.id);
          onClose();
        }
      } else {
        const picked = filteredOllamaModels[highlightedIndex];
        if (picked) {
          onSelectModel('ollama', picked.name);
          onClose();
        }
      }
    }
  };

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
      onSelectModel('ollama', cleaned);
      setCustomModelDraft('');
      onClose();
    }
  };

  const activeOpenRouterMeta = useMemo(() => {
    if (activeProvider !== 'openrouter' || !selectedModel) return undefined;
    return openRouterModels.find((m) => m.id === selectedModel);
  }, [activeProvider, selectedModel, openRouterModels]);

  const triggerLabel =
    activeProvider === 'openrouter'
      ? activeOpenRouterMeta?.name || selectedModel || 'Select free model'
      : selectedModel || 'Select model';

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="inline-flex h-9 max-w-[175px] sm:max-w-[260px] items-center gap-1.5 rounded-xl border border-zinc-200/90 bg-gradient-to-b from-white to-zinc-50/80 px-2.5 sm:px-3 text-[12.5px] font-medium text-zinc-800 shadow-[0_2px_6px_-2px_rgba(0,0,0,0.06)] transition-all duration-200 ease-in-out hover:border-zinc-300 hover:shadow-sm active:scale-[0.98] dark:border-white/[0.09] dark:bg-gradient-to-b dark:from-[#141418] dark:to-[#0C0C0F] dark:text-zinc-200 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_12px_-4px_rgba(0,0,0,0.75)] dark:hover:border-white/[0.16]"
        title={
          selectedModel
            ? `${activeProvider === 'openrouter' ? 'OpenRouter (Free)' : 'Local Ollama'}: ${selectedModel}`
            : 'Select model'
        }
      >
        {activeProvider === 'openrouter' ? (
          <Globe
            className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
            strokeWidth={1.6}
          />
        ) : (
          <HardDrive
            className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400"
            strokeWidth={1.6}
          />
        )}
        <span className="truncate font-mono text-[12px]">{triggerLabel}</span>
        {activeProvider === 'openrouter' && (
          <span className="hidden shrink-0 rounded-md bg-emerald-500/12 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 sm:inline">
            FREE
          </span>
        )}
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          strokeWidth={1.5}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="absolute left-0 top-full z-40 mt-2 w-[310px] sm:w-[390px] origin-top-left rounded-xl border border-zinc-200/90 bg-white/95 p-2.5 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.16)] backdrop-blur-xl dark:border-white/[0.1] dark:bg-[#0E0E11]/95 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_50px_-12px_rgba(0,0,0,0.95)]"
          >
            {/* Provider Tabs */}
            <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl border border-zinc-200/80 bg-zinc-100/80 p-1 dark:border-white/[0.07] dark:bg-black/60">
              <button
                type="button"
                onClick={() => handleSwitchTab('ollama')}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition-all duration-150 ${
                  viewProvider === 'ollama'
                    ? 'bg-white text-zinc-950 shadow-xs dark:bg-[#19191F] dark:text-zinc-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                <HardDrive className="h-3.5 w-3.5" strokeWidth={1.6} />
                <span>Local Ollama</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchTab('openrouter')}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition-all duration-150 ${
                  viewProvider === 'openrouter'
                    ? 'bg-white text-zinc-950 shadow-xs dark:bg-[#19191F] dark:text-zinc-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                <Globe className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={1.6} />
                <span>OpenRouter Free</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative mb-2 flex items-center">
              <Search
                className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500"
                strokeWidth={1.5}
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={
                  viewProvider === 'openrouter'
                    ? 'Search free OpenRouter models...'
                    : 'Search local Ollama models...'
                }
                aria-label="Search models"
                className="w-full rounded-xl border border-zinc-200/90 bg-zinc-50/90 py-1.5 pr-7 pl-8 text-[12px] text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-blue-500/50 focus:bg-white focus:outline-none dark:border-white/[0.08] dark:bg-black/70 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-[#7AA2F7]/50 dark:focus:bg-[#101014]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2 rounded-lg p-0.5 text-zinc-400 transition-colors hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
                  aria-label="Clear model search"
                >
                  <X className="h-3 w-3" strokeWidth={1.75} />
                </button>
              )}
            </div>

            {/* Section Header + Refresh */}
            <div className="flex items-center justify-between px-1.5 pb-1.5">
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                {viewProvider === 'openrouter' ? (
                  <>
                    Free Models{' '}
                    <span className="font-mono tabular-nums text-zinc-400 dark:text-zinc-500">
                      ({searchQuery.trim()
                        ? `${filteredOpenRouterModels.length}/${openRouterModels.length}`
                        : openRouterModels.length}
                      )
                    </span>
                  </>
                ) : (
                  <>
                    Local Models{' '}
                    <span className="font-mono tabular-nums text-zinc-400 dark:text-zinc-500">
                      ({searchQuery.trim()
                        ? `${filteredOllamaModels.length}/${ollamaModels.length}`
                        : ollamaModels.length}
                      )
                    </span>
                  </>
                )}
              </span>

              <button
                type="button"
                onClick={viewProvider === 'openrouter' ? onRefreshOpenRouter : onRefreshOllama}
                disabled={viewProvider === 'openrouter' ? openRouterLoading : ollamaLoading}
                className="inline-flex items-center gap-1 rounded-xl px-2 py-0.5 text-[11px] text-zinc-500 transition-all duration-200 hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.97] disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100"
                title={
                  viewProvider === 'openrouter'
                    ? 'Refresh free models from OpenRouter'
                    : 'Refresh models from Ollama'
                }
              >
                <RefreshCw
                  className={`h-3 w-3 ${
                    (viewProvider === 'openrouter' ? openRouterLoading : ollamaLoading)
                      ? 'animate-spin'
                      : ''
                  }`}
                  strokeWidth={1.5}
                />
                <span>Refresh</span>
              </button>
            </div>

            {viewProvider === 'openrouter' ? (
              <>
                {!openRouterConfigured && (
                  <div className="mb-2 flex items-start gap-2 rounded-xl border border-amber-300/70 bg-amber-50/70 px-2.5 py-2 text-[11px] leading-snug text-amber-800 dark:border-amber-500/25 dark:bg-amber-950/25 dark:text-amber-300/90">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.6} />
                    <span>
                      <code className="font-mono">OPENROUTER_API_KEY</code> is not set in the
                      local Linux environment. Export it before starting the server to send chat
                      requests.
                    </span>
                  </div>
                )}

                <div
                  ref={listRef}
                  role="listbox"
                  aria-label="Free OpenRouter models"
                  className="max-h-64 overflow-y-auto py-0.5"
                >
                  {openRouterError && (
                    <p className="px-2 py-2 text-[11.5px] leading-relaxed text-red-600 dark:text-red-400">
                      {openRouterError}
                    </p>
                  )}

                  {!openRouterError && openRouterLoading && openRouterModels.length === 0 && (
                    <p className="px-2 py-4 text-center text-[12px] text-zinc-500">
                      Fetching free models from OpenRouter...
                    </p>
                  )}

                  {!openRouterError &&
                    !openRouterLoading &&
                    filteredOpenRouterModels.length === 0 && (
                      <p className="px-2 py-4 text-center text-[12px] text-zinc-500">
                        {searchQuery.trim()
                          ? `No free models match "${searchQuery.trim()}".`
                          : 'No free OpenRouter models available.'}
                      </p>
                    )}

                  {filteredOpenRouterModels.map((m, idx) => {
                    const isActive =
                      activeProvider === 'openrouter' && m.id === selectedModel;
                    const isHighlighted = idx === highlightedIndex;
                    const ctxLabel = formatContextLength(m.context_length);

                    return (
                      <button
                        key={m.id}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        data-model-index={idx}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        onClick={() => {
                          onSelectModel('openrouter', m.id);
                          onClose();
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition-all duration-150 ${
                          isActive
                            ? 'bg-zinc-100 text-zinc-950 shadow-xs dark:bg-white/[0.09] dark:text-white'
                            : isHighlighted
                            ? 'bg-zinc-50 text-zinc-900 dark:bg-white/[0.05] dark:text-zinc-100'
                            : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[12.5px] font-medium">
                              {m.name}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-zinc-500">
                            <span className="truncate font-mono">{m.id}</span>
                            {ctxLabel && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="shrink-0 tabular-nums">{ctxLabel}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                            Free
                          </span>
                          {isActive && (
                            <Check
                              className="h-3.5 w-3.5 text-blue-500 dark:text-[#7AA2F7]"
                              strokeWidth={1.75}
                            />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div
                  ref={listRef}
                  role="listbox"
                  aria-label="Local Ollama models"
                  className="max-h-48 overflow-y-auto py-0.5"
                >
                  {ollamaError && (
                    <p className="px-2 py-2 text-[11.5px] leading-relaxed text-red-600 dark:text-red-400">
                      {ollamaError}
                    </p>
                  )}

                  {!ollamaError && filteredOllamaModels.length === 0 && !ollamaLoading && (
                    <p className="px-2 py-2 text-[12px] text-zinc-500">
                      {searchQuery.trim()
                        ? `No local models match "${searchQuery.trim()}".`
                        : (
                          <>
                            No models found. Run{' '}
                            <code className="font-mono">ollama pull llama3.2</code> locally.
                          </>
                        )}
                    </p>
                  )}

                  {filteredOllamaModels.map((m, idx) => {
                    const isActive =
                      activeProvider === 'ollama' && m.name === selectedModel;
                    const isHighlighted = idx === highlightedIndex;
                    const meta = [m.details?.parameter_size, formatModelSize(m.size)]
                      .filter(Boolean)
                      .join(' · ');

                    return (
                      <button
                        key={m.name}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        data-model-index={idx}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        onClick={() => {
                          onSelectModel('ollama', m.name);
                          onClose();
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left transition-all duration-150 ${
                          isActive
                            ? 'bg-zinc-100 text-zinc-950 shadow-xs dark:bg-white/[0.09] dark:text-white'
                            : isHighlighted
                            ? 'bg-zinc-50 text-zinc-900 dark:bg-white/[0.05] dark:text-zinc-100'
                            : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="truncate font-mono text-[12px]">{m.name}</div>
                          {meta && (
                            <div className="text-[10.5px] tabular-nums text-zinc-500">{meta}</div>
                          )}
                        </div>
                        {isActive && (
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
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
