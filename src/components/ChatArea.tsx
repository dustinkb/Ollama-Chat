import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  RefreshCw,
  SlidersHorizontal,
  Square,
  X,
} from 'lucide-react';
import { getPrimaryModifierLabel } from '../hooks/useKeyboardShortcuts';
import { ChatMessage, ModelProvider, Persona } from '../types/chat';
import { MarkdownContent } from './MarkdownContent';

export interface ChatAreaHandle {
  submit: () => void;
  focusInput: () => void;
}

interface ChatAreaProps {
  ref?: React.Ref<ChatAreaHandle>;
  conversationKey: string;
  messages: ChatMessage[];
  activePersona: Persona | undefined;
  activePersonaMemoryCount: number;
  activeProvider: ModelProvider;
  selectedModel: string;
  isGenerating: boolean;
  isSummarizingMemory: boolean;
  error: string | null;
  memoryNotice: string | null;
  onDismissError: () => void;
  onDismissMemoryNotice: () => void;
  onSendMessage: (content: string) => void;
  onStopGenerating: () => void;
  onRetryLast: () => void;
  onOpenPersonaModal: () => void;
}

function formatMessageTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  ref,
  conversationKey,
  messages,
  activePersona,
  activePersonaMemoryCount,
  activeProvider,
  selectedModel,
  isGenerating,
  isSummarizingMemory,
  error,
  memoryNotice,
  onDismissError,
  onDismissMemoryNotice,
  onSendMessage,
  onStopGenerating,
  onRetryLast,
  onOpenPersonaModal,
}) => {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAutoScrollPaused, setIsAutoScrollPaused] = useState(false);
  const modKey = getPrimaryModifierLabel();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isProgrammaticScrollRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const pausedRef = useRef(false);

  const setPaused = useCallback((paused: boolean) => {
    pausedRef.current = paused;
    setIsAutoScrollPaused(paused);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    isProgrammaticScrollRef.current = true;
    el.scrollTo({
      top: el.scrollHeight,
      behavior,
    });
    lastScrollTopRef.current = el.scrollHeight;
    requestAnimationFrame(() => {
      isProgrammaticScrollRef.current = false;
    });
  }, []);

  // Reset auto-scroll when switching conversations
  useEffect(() => {
    setPaused(false);
    scrollToBottom('auto');
  }, [conversationKey, setPaused, scrollToBottom]);

  // Keep latest message in view while AI streams unless user paused by scrolling up
  const lastMessageContent = messages[messages.length - 1]?.content || '';
  useEffect(() => {
    if (!pausedRef.current) {
      scrollToBottom('auto');
    }
  }, [messages.length, lastMessageContent, isGenerating, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el || isProgrammaticScrollRef.current) return;

    const currentTop = el.scrollTop;
    const distanceFromBottom = el.scrollHeight - currentTop - el.clientHeight;
    const scrolledUp = currentTop < lastScrollTopRef.current - 4;
    lastScrollTopRef.current = currentTop;

    if (scrolledUp && distanceFromBottom > 36) {
      if (!pausedRef.current) setPaused(true);
    } else if (distanceFromBottom <= 24) {
      if (pausedRef.current) setPaused(false);
    } else if (distanceFromBottom > 80 && !pausedRef.current) {
      setPaused(true);
    }
  }, [setPaused]);

  const handleJumpToLatest = () => {
    setPaused(false);
    scrollToBottom('smooth');
  };

  // Auto-resize textarea up to 180px
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [input]);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isGenerating || isSummarizingMemory) return;
    setPaused(false);
    onSendMessage(trimmed);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    requestAnimationFrame(() => scrollToBottom('smooth'));
  }, [input, isGenerating, isSummarizingMemory, onSendMessage, setPaused, scrollToBottom]);

  useImperativeHandle(
    ref,
    () => ({
      submit: handleSubmit,
      focusInput: () => {
        textareaRef.current?.focus();
      },
    }),
    [handleSubmit]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Plain Enter sends the message; Ctrl/Cmd+Enter is handled globally by the shortcut manager
    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      !e.nativeEvent.isComposing
    ) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopyMessage = async (msg: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopiedId(msg.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <div className="relative z-0 flex min-h-0 flex-1 flex-col bg-[#F6F6F8] dark:bg-black">
      {/* Inline Memory Notice */}
      <AnimatePresence>
        {memoryNotice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="border-b border-zinc-200/80 bg-white/80 px-4 py-2.5 backdrop-blur-md dark:border-white/[0.08] dark:bg-[#0B0B0E]/90"
          >
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 text-[12.5px] text-zinc-700 dark:text-zinc-300">
              <span>{memoryNotice}</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onOpenPersonaModal}
                  className="rounded-xl px-2 py-0.5 text-[12px] font-medium text-blue-600 transition-colors duration-200 hover:bg-blue-50 dark:text-[#7AA2F7] dark:hover:bg-blue-500/10"
                >
                  View memories
                </button>
                <button
                  type="button"
                  onClick={onDismissMemoryNotice}
                  className="rounded-xl p-1 text-zinc-400 transition-colors duration-200 hover:bg-zinc-200/60 hover:text-zinc-700 dark:hover:bg-white/[0.06] dark:hover:text-zinc-200"
                  aria-label="Dismiss notice"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message Feed */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-6 sm:px-6"
      >
        <div className="mx-auto max-w-3xl">
          {messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              className="flex min-h-[54vh] flex-col items-center justify-center text-center"
            >
              <div className="w-full max-w-md rounded-2xl border border-zinc-200/90 bg-gradient-to-b from-white to-zinc-50/90 p-7 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.08)] dark:border-white/[0.08] dark:bg-gradient-to-b dark:from-[#121216] dark:to-[#08080A] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_40px_-12px_rgba(0,0,0,0.85)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">
                  Ollama Chat
                </p>
                <h2 className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Local note & model workspace
                </h2>
                <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {activePersona ? (
                    <>
                      Using persona{' '}
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {activePersona.name}
                      </span>
                      {activePersonaMemoryCount > 0 ? (
                        <>
                          {' '}
                          with{' '}
                          <button
                            type="button"
                            onClick={onOpenPersonaModal}
                            className="font-medium text-blue-600 underline decoration-blue-400/50 underline-offset-4 transition-colors duration-200 hover:text-blue-700 dark:text-[#7AA2F7] dark:decoration-[#7AA2F7]/40 dark:hover:text-blue-300"
                          >
                            {activePersonaMemoryCount} saved{' '}
                            {activePersonaMemoryCount === 1 ? 'memory' : 'memories'}
                          </button>
                        </>
                      ) : (
                        ' · No saved memories yet'
                      )}
                    </>
                  ) : (
                    'Select a persona and start writing.'
                  )}
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3 border-t border-zinc-200/80 pt-4 text-[12px] text-zinc-500 dark:border-white/[0.06]">
                  <span className="font-mono">
                    {activeProvider === 'openrouter' ? 'OpenRouter (Free)' : 'Local Ollama'}
                    {selectedModel ? ` · ${selectedModel}` : ' · No model selected'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={onOpenPersonaModal}
                    className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-zinc-700 transition-all duration-200 ease-in-out hover:bg-zinc-100 hover:text-zinc-950 active:scale-[0.98] dark:text-zinc-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
                    <span>Edit persona & memories</span>
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-6 pb-4">
              {messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                const isLastAssistant = !isUser && index === messages.length - 1;
                const isWaitingFirstToken = isLastAssistant && isGenerating && !msg.content;

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    className="group"
                  >
                    {isUser ? (
                      <div className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl border border-zinc-200/90 bg-gradient-to-b from-white to-zinc-50 px-4 py-2.5 text-[15px] leading-[1.6] text-zinc-900 shadow-[0_3px_12px_-4px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.03)] dark:border-white/[0.09] dark:bg-gradient-to-b dark:from-[#16161B] dark:to-[#0E0E12] dark:text-zinc-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_6px_18px_-6px_rgba(0,0,0,0.8)]">
                          <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 rounded-2xl border border-transparent px-1 py-1 transition-colors duration-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-[11.5px] tabular-nums text-zinc-500">
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">
                              {activePersona?.name || 'Assistant'}
                            </span>
                            {msg.model && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono">{msg.model}</span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span>{formatMessageTime(msg.createdAt)}</span>
                          </div>

                          {msg.content && (
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(msg)}
                              className="inline-flex items-center gap-1 rounded-xl px-2 py-0.5 text-[11px] text-zinc-400 opacity-0 transition-all duration-200 ease-in-out hover:bg-zinc-200/60 hover:text-zinc-900 group-hover:opacity-100 focus:opacity-100 active:scale-[0.97] dark:text-zinc-500 dark:hover:bg-white/[0.06] dark:hover:text-zinc-200"
                              aria-label="Copy message"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="h-3 w-3 text-blue-500 dark:text-[#7AA2F7]" strokeWidth={1.75} />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" strokeWidth={1.5} />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {isWaitingFirstToken ? (
                          <div className="flex items-center gap-2.5 py-2 text-[13px] text-zinc-500">
                            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500/80 dark:bg-[#7AA2F7]/80" />
                            <span>Thinking...</span>
                          </div>
                        ) : (
                          <MarkdownContent content={msg.content} />
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Error Banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.99 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                className="my-4 rounded-xl border border-red-300/80 bg-gradient-to-b from-red-50 to-red-50/70 px-4 py-3 shadow-sm dark:border-red-900/50 dark:bg-gradient-to-b dark:from-red-950/30 dark:to-red-950/15"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle
                      className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400"
                      strokeWidth={1.5}
                    />
                    <div className="text-[13px] leading-relaxed text-red-800 dark:text-red-300">
                      <p>{error}</p>
                      {messages.length > 0 && (
                        <button
                          type="button"
                          onClick={onRetryLast}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-red-300/70 bg-white/70 px-3 py-1 text-[12px] font-medium text-red-700 shadow-xs transition-all duration-200 ease-in-out hover:bg-white active:scale-[0.98] dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/70"
                        >
                          <RefreshCw className="h-3 w-3" strokeWidth={1.5} />
                          <span>Retry last message</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onDismissError}
                    className="rounded-xl p-1 text-red-500 transition-colors duration-200 hover:bg-red-100 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/30 dark:hover:text-red-200"
                    aria-label="Dismiss error"
                  >
                    <X className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Floating Jump to Latest button when user pauses auto-scroll */}
      <AnimatePresence>
        {isAutoScrollPaused && messages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="pointer-events-none absolute inset-x-0 bottom-[84px] z-20 flex justify-center px-4 sm:bottom-[94px]"
          >
            <button
              type="button"
              onClick={handleJumpToLatest}
              className="pointer-events-auto inline-flex items-center gap-2 rounded-xl border border-zinc-200/90 bg-white/95 px-3.5 py-1.5 text-[12px] font-medium text-zinc-800 shadow-[0_8px_24px_-4px_rgba(0,0,0,0.14)] backdrop-blur-md transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-white active:scale-[0.97] dark:border-white/[0.12] dark:bg-[#141418]/95 dark:text-zinc-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_28px_-4px_rgba(0,0,0,0.9)] dark:hover:border-white/[0.18]"
            >
              {isGenerating && (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500 dark:bg-[#7AA2F7]" />
              )}
              <span>{isGenerating ? 'Auto-scroll paused · Jump to live' : 'Jump to latest'}</span>
              <ArrowDown className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" strokeWidth={1.75} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Composer */}
      <div className="shrink-0 border-t border-zinc-200/80 bg-[#F6F6F8]/90 px-3 pt-2.5 pb-3 backdrop-blur-md sm:px-6 dark:border-white/[0.07] dark:bg-black/90">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-xl border border-zinc-300/80 bg-gradient-to-b from-white to-zinc-50/70 px-3.5 py-2.5 shadow-[0_4px_16px_-6px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.03)] transition-all duration-200 ease-in-out focus-within:border-blue-500/50 focus-within:shadow-[0_6px_20px_-6px_rgba(59,130,246,0.14)] dark:border-white/[0.1] dark:bg-gradient-to-b dark:from-[#121216] dark:to-[#0A0A0D] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_-8px_rgba(0,0,0,0.85)] dark:focus-within:border-[#7AA2F7]/50 dark:focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_28px_-6px_rgba(122,162,247,0.12)]">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedModel
                  ? `Message ${selectedModel}...`
                  : activeProvider === 'openrouter'
                  ? 'Select a free OpenRouter model above to start...'
                  : 'Select an Ollama model above to start...'
              }
              rows={1}
              disabled={isSummarizingMemory}
              className="max-h-[180px] min-h-[24px] flex-1 resize-none bg-transparent py-0.5 text-[14.5px] leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus:outline-none disabled:opacity-50 dark:text-zinc-100 dark:placeholder:text-zinc-600"
            />
            {isGenerating ? (
              <button
                type="button"
                onClick={onStopGenerating}
                title="Stop generating"
                aria-label="Stop generating"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-zinc-300 bg-gradient-to-b from-white to-zinc-100 text-zinc-900 shadow-xs transition-all duration-200 ease-in-out hover:bg-zinc-200 active:scale-[0.94] dark:border-white/[0.12] dark:bg-gradient-to-b dark:from-[#1D1D22] dark:to-[#131317] dark:text-zinc-100 dark:hover:border-white/[0.2]"
              >
                <Square className="h-3.5 w-3.5 fill-current" strokeWidth={1.5} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!input.trim() || isSummarizingMemory}
                title="Send message"
                aria-label="Send message"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-zinc-800 to-zinc-950 text-white shadow-[0_2px_8px_-1px_rgba(0,0,0,0.3)] transition-all duration-200 ease-in-out hover:from-zinc-700 hover:to-zinc-900 active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-25 disabled:shadow-none dark:from-zinc-100 dark:to-zinc-300 dark:text-black dark:shadow-[0_2px_10px_-2px_rgba(255,255,255,0.25)] dark:hover:from-white dark:hover:to-zinc-200"
              >
                <ArrowUp className="h-4 w-4" strokeWidth={1.75} />
              </button>
            )}
          </div>
          <div className="mt-1.5 hidden items-center justify-between px-1 text-[11px] text-zinc-400 dark:text-zinc-600 sm:flex">
            <span>
              {modKey}+Enter to send · Shift+Enter newline · {modKey}+N new · {modKey}+P personas
            </span>
            <span>
              {activePersona?.name || 'Default'}
              {activePersonaMemoryCount > 0 && ` · ${activePersonaMemoryCount} memories active`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
