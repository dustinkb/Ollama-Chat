import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Download, Pencil, Pin, Plus, Search, Trash2, X } from 'lucide-react';
import { Conversation, Persona } from '../types/chat';

interface SidebarProps {
  isOpen: boolean;
  onCloseMobile: () => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  activeConversation: Conversation | null;
  personas: Persona[];
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onTogglePin: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onDeleteConversation: (id: string) => void;
  onExportCurrentMarkdown: () => void;
  onExportCurrentJson: () => void;
  onExportAllMarkdown: () => void;
  onExportAllJson: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getMessageSnippet(content: string, query: string): string | null {
  const lower = content.toLowerCase();
  const idx = lower.indexOf(query);
  if (idx === -1) return null;
  const start = Math.max(0, idx - 22);
  const end = Math.min(content.length, idx + query.length + 38);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < content.length ? '...' : '';
  return `${prefix}${content.slice(start, end).replace(/\s+/g, ' ')}${suffix}`;
}

function renderHighlightedText(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-medium text-blue-600 dark:text-[#7AA2F7]">
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  );
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onCloseMobile,
  conversations,
  activeConversationId,
  activeConversation,
  personas,
  onSelectConversation,
  onNewChat,
  onTogglePin,
  onRenameConversation,
  onDeleteConversation,
  onExportCurrentMarkdown,
  onExportCurrentJson,
  onExportAllMarkdown,
  onExportAllJson,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const personaMap = useMemo(() => {
    const map = new Map<string, string>();
    personas.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [personas]);

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!q) return sorted;
    return sorted.filter((c) => {
      if (c.title.toLowerCase().includes(q)) return true;
      return c.messages.some((m) => m.content.toLowerCase().includes(q));
    });
  }, [conversations, searchQuery]);

  const pinned = useMemo(
    () => filteredConversations.filter((c) => c.pinned),
    [filteredConversations]
  );
  const unpinned = useMemo(
    () => filteredConversations.filter((c) => !c.pinned),
    [filteredConversations]
  );

  const startRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditingTitle(conv.title);
  };

  const commitRename = (id: string) => {
    const trimmed = editingTitle.trim();
    if (trimmed) {
      onRenameConversation(id, trimmed);
    }
    setEditingId(null);
  };

  const renderItem = (conv: Conversation) => {
    const isActive = conv.id === activeConversationId;
    const isEditing = editingId === conv.id;
    const personaName = personaMap.get(conv.personaId) || 'Default';

    return (
      <div
        key={conv.id}
        onClick={() => {
          if (!isEditing) {
            onSelectConversation(conv.id);
            onCloseMobile();
          }
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !isEditing) {
            onSelectConversation(conv.id);
            onCloseMobile();
          }
        }}
        className={`group relative flex cursor-pointer items-start justify-between gap-2 rounded-xl border px-3 py-2.5 transition-all duration-200 ease-in-out ${
          isActive
            ? 'border-zinc-300/90 bg-gradient-to-b from-white to-zinc-50 text-zinc-950 shadow-[0_3px_10px_-3px_rgba(0,0,0,0.08)] dark:border-white/[0.1] dark:bg-gradient-to-b dark:from-[#151519] dark:to-[#0E0E12] dark:text-zinc-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_14px_-4px_rgba(0,0,0,0.85)]'
            : 'border-transparent text-zinc-700 hover:bg-zinc-200/50 dark:text-zinc-300 dark:hover:bg-white/[0.04]'
        }`}
      >
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename(conv.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                onBlur={() => commitRename(conv.id)}
                autoFocus
                className="w-full rounded-xl border border-zinc-400 bg-white px-2 py-0.5 text-[13px] text-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={() => commitRename(conv.id)}
                className="rounded-xl p-1 text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
                aria-label="Save title"
              >
                <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                {conv.pinned && (
                  <Pin
                    className="h-3 w-3 shrink-0 text-blue-500 dark:text-[#7AA2F7]"
                    strokeWidth={1.75}
                  />
                )}
                <p className="truncate text-[13px] font-medium leading-snug">
                  {renderHighlightedText(conv.title, searchQuery.trim())}
                </p>
              </div>
              {searchQuery.trim() && (() => {
                const q = searchQuery.trim().toLowerCase();
                if (conv.title.toLowerCase().includes(q)) return null;
                const matchedMsg = conv.messages.find((m) =>
                  m.content.toLowerCase().includes(q)
                );
                const snippet = matchedMsg ? getMessageSnippet(matchedMsg.content, q) : null;
                if (!snippet) return null;
                return (
                  <p className="mt-0.5 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                    {renderHighlightedText(snippet, searchQuery.trim())}
                  </p>
                );
              })()}
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] tabular-nums text-zinc-500 dark:text-zinc-500">
                <span className="truncate">{personaName}</span>
                <span aria-hidden="true">·</span>
                <span className="shrink-0">{formatRelativeTime(conv.updatedAt)}</span>
              </div>
            </>
          )}
        </div>

        {!isEditing && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(conv.id);
              }}
              title={conv.pinned ? 'Unpin conversation' : 'Pin conversation'}
              aria-label={conv.pinned ? 'Unpin conversation' : 'Pin conversation'}
              className="rounded-xl p-1 text-zinc-500 transition-colors duration-200 hover:bg-zinc-300/60 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-white/[0.08] dark:hover:text-zinc-200"
            >
              <Pin className="h-3 w-3" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={(e) => startRename(conv, e)}
              title="Rename conversation"
              aria-label="Rename conversation"
              className="rounded-xl p-1 text-zinc-500 transition-colors duration-200 hover:bg-zinc-300/60 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-white/[0.08] dark:hover:text-zinc-200"
            >
              <Pencil className="h-3 w-3" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteConversation(conv.id);
              }}
              title="Delete conversation"
              aria-label="Delete conversation"
              className="rounded-xl p-1 text-zinc-500 transition-colors duration-200 hover:bg-zinc-300/60 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-white/[0.08] dark:hover:text-red-400"
            >
              <Trash2 className="h-3 w-3" strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>
    );
  };

  const sidebarContent = (
    <aside className="flex h-full w-[268px] flex-col border-r border-zinc-200/80 bg-[#EFEFF2]/80 dark:border-white/[0.07] dark:bg-gradient-to-b dark:from-[#060608] dark:to-black">
      {/* Brand Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3">
        <div>
          <h1 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-900 dark:text-zinc-100">
            Ollama Chat
          </h1>
          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-500">
            v1.0.0
          </p>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="rounded-xl p-1.5 text-zinc-500 transition-colors duration-200 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.07] dark:hover:text-zinc-100 md:hidden"
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* New Chat Button */}
      <div className="px-3 pb-2.5">
        <button
          type="button"
          onClick={() => {
            onNewChat();
            onCloseMobile();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200/90 bg-gradient-to-b from-white to-zinc-50 px-3 py-2 text-[13px] font-medium text-zinc-900 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] transition-all duration-200 ease-in-out hover:border-zinc-300 hover:shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 dark:border-white/[0.09] dark:bg-gradient-to-b dark:from-[#15151A] dark:to-[#0C0C10] dark:text-zinc-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_12px_-4px_rgba(0,0,0,0.8)] dark:hover:border-white/[0.16]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span className="whitespace-nowrap">New chat</span>
        </button>
      </div>

      {/* Search Conversations */}
      <div className="px-3 pb-3">
        <div className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500"
            strokeWidth={1.5}
          />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search titles & messages..."
            aria-label="Search conversations"
            className="w-full rounded-xl border border-zinc-200/90 bg-white/90 py-1.5 pr-7 pl-8.5 text-[12.5px] text-zinc-900 shadow-2xs placeholder:text-zinc-400 transition-all duration-200 focus:border-blue-500/50 focus:bg-white focus:outline-none dark:border-white/[0.07] dark:bg-[#0B0B0E] dark:text-zinc-200 dark:placeholder:text-zinc-600 dark:focus:border-[#7AA2F7]/50 dark:focus:bg-[#101014]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 rounded-xl p-0.5 text-zinc-400 transition-colors hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" strokeWidth={1.75} />
            </button>
          )}
        </div>
        {searchQuery.trim() && (
          <p className="mt-1.5 px-1 text-[11px] tabular-nums text-zinc-500">
            {filteredConversations.length}{' '}
            {filteredConversations.length === 1 ? 'result' : 'results'}
          </p>
        )}
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2.5 pb-4">
        {filteredConversations.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-[12px] text-zinc-500 dark:text-zinc-500">
              {searchQuery ? 'No matching chats' : 'No saved chats yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pinned.length > 0 && (
              <div>
                <div className="px-2.5 pb-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-500">
                  Pinned
                </div>
                <div className="space-y-1">{pinned.map(renderItem)}</div>
              </div>
            )}

            {unpinned.length > 0 && (
              <div>
                {pinned.length > 0 && (
                  <div className="px-2.5 pb-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-500">
                    History
                  </div>
                )}
                <div className="space-y-1">{unpinned.map(renderItem)}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sidebar Footer: Export */}
      <div
        className="relative z-30 border-t border-zinc-200/80 px-3 py-2.5 dark:border-white/[0.07]"
        ref={exportMenuRef}
      >
        <AnimatePresence>
          {exportMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="absolute right-3 bottom-full left-3 z-40 mb-2 origin-bottom rounded-xl border border-zinc-200/90 bg-white/95 p-2.5 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.16)] backdrop-blur-xl dark:border-white/[0.1] dark:bg-[#0E0E11]/95 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_50px_-12px_rgba(0,0,0,0.95)]"
            >
              <div className="px-1.5 pb-1.5 text-[11px] font-medium text-zinc-500">
                Current conversation
              </div>
              <div className="grid grid-cols-2 gap-1.5 pb-2.5">
                <button
                  type="button"
                  disabled={!activeConversation || activeConversation.messages.length === 0}
                  onClick={() => {
                    onExportCurrentMarkdown();
                    setExportMenuOpen(false);
                  }}
                  className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-2 py-1.5 text-[11.5px] font-medium text-zinc-800 shadow-2xs transition-all duration-200 hover:bg-zinc-100 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/[0.09] dark:bg-[#16161B] dark:text-zinc-200 dark:hover:bg-[#1F1F26]"
                >
                  Markdown
                </button>
                <button
                  type="button"
                  disabled={!activeConversation || activeConversation.messages.length === 0}
                  onClick={() => {
                    onExportCurrentJson();
                    setExportMenuOpen(false);
                  }}
                  className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-2 py-1.5 text-[11.5px] font-medium text-zinc-800 shadow-2xs transition-all duration-200 hover:bg-zinc-100 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/[0.09] dark:bg-[#16161B] dark:text-zinc-200 dark:hover:bg-[#1F1F26]"
                >
                  JSON
                </button>
              </div>

              <div className="border-t border-zinc-200/80 pt-2.5 dark:border-white/[0.08]">
                <div className="px-1.5 pb-1.5 text-[11px] font-medium text-zinc-500">
                  All chat history ({conversations.length})
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    disabled={conversations.length === 0}
                    onClick={() => {
                      onExportAllMarkdown();
                      setExportMenuOpen(false);
                    }}
                    className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-2 py-1.5 text-[11.5px] font-medium text-zinc-800 shadow-2xs transition-all duration-200 hover:bg-zinc-100 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/[0.09] dark:bg-[#16161B] dark:text-zinc-200 dark:hover:bg-[#1F1F26]"
                  >
                    Markdown
                  </button>
                  <button
                    type="button"
                    disabled={conversations.length === 0}
                    onClick={() => {
                      onExportAllJson();
                      setExportMenuOpen(false);
                    }}
                    className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-2 py-1.5 text-[11.5px] font-medium text-zinc-800 shadow-2xs transition-all duration-200 hover:bg-zinc-100 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/[0.09] dark:bg-[#16161B] dark:text-zinc-200 dark:hover:bg-[#1F1F26]"
                  >
                    JSON
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => setExportMenuOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-[12.5px] text-zinc-600 transition-all duration-200 ease-in-out hover:bg-zinc-200/70 hover:text-zinc-950 active:scale-[0.98] dark:text-zinc-400 dark:hover:bg-white/[0.05] dark:hover:text-zinc-100"
        >
          <span className="inline-flex items-center gap-2">
            <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>Export chats</span>
          </span>
          <span className="font-mono text-[10.5px] text-zinc-400 dark:text-zinc-600">
            .md / .json
          </span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <div className="hidden h-full md:block">{sidebarContent}</div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/75 backdrop-blur-xs"
              onClick={onCloseMobile}
              aria-hidden="true"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="relative z-10 h-full shadow-2xl"
            >
              {sidebarContent}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
