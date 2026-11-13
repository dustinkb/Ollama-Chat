import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bookmark, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Persona, PersonaMemory } from '../types/chat';

interface PersonaModalProps {
  isOpen: boolean;
  initialPersonaId?: string;
  personas: Persona[];
  activePersonaId: string;
  memories: PersonaMemory[];
  onClose: () => void;
  onSelectActivePersona: (id: string) => void;
  onCreatePersona: (name: string, systemPrompt: string) => Persona;
  onUpdatePersona: (id: string, name: string, systemPrompt: string) => void;
  onDeletePersona: (id: string) => void;
  onAddMemory: (personaId: string, summary: string) => void;
  onUpdateMemory: (memoryId: string, summary: string) => void;
  onDeleteMemory: (memoryId: string) => void;
}

export const PersonaModal: React.FC<PersonaModalProps> = ({
  isOpen,
  initialPersonaId,
  personas,
  activePersonaId,
  memories,
  onClose,
  onSelectActivePersona,
  onCreatePersona,
  onUpdatePersona,
  onDeletePersona,
  onAddMemory,
  onUpdateMemory,
  onDeleteMemory,
}) => {
  const [selectedId, setSelectedId] = useState<string>(activePersonaId);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [promptDraft, setPromptDraft] = useState('');
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Memory editing state
  const [newMemoryDraft, setNewMemoryDraft] = useState('');
  const [showAddMemory, setShowAddMemory] = useState(false);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editingMemoryText, setEditingMemoryText] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (initialPersonaId === '__new__') {
      setIsCreatingNew(true);
      setNameDraft('');
      setPromptDraft('');
    } else {
      const targetId = initialPersonaId || activePersonaId || personas[0]?.id;
      const target = personas.find((p) => p.id === targetId) || personas[0];
      setIsCreatingNew(false);
      if (target) {
        setSelectedId(target.id);
        setNameDraft(target.name);
        setPromptDraft(target.systemPrompt);
      }
    }
    setEditingMemoryId(null);
    setShowAddMemory(false);
    setNewMemoryDraft('');
  }, [isOpen, initialPersonaId, activePersonaId, personas]);

  const selectedPersona = useMemo(
    () => (isCreatingNew ? undefined : personas.find((p) => p.id === selectedId)),
    [isCreatingNew, personas, selectedId]
  );

  // Strictly filter memories for ONLY the selected persona
  const personaMemories = useMemo(() => {
    if (!selectedPersona) return [];
    return memories
      .filter((m) => m.personaId === selectedPersona.id)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [memories, selectedPersona]);

  const handleSelectListItem = (persona: Persona) => {
    setIsCreatingNew(false);
    setSelectedId(persona.id);
    setNameDraft(persona.name);
    setPromptDraft(persona.systemPrompt);
    setEditingMemoryId(null);
    setShowAddMemory(false);
  };

  const handleStartNew = () => {
    setIsCreatingNew(true);
    setNameDraft('');
    setPromptDraft('');
    setEditingMemoryId(null);
    setShowAddMemory(false);
  };

  const handleSavePersona = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = nameDraft.trim() || 'Untitled Persona';
    const cleanPrompt = promptDraft.trim();

    if (isCreatingNew) {
      const created = onCreatePersona(cleanName, cleanPrompt);
      setIsCreatingNew(false);
      setSelectedId(created.id);
      onSelectActivePersona(created.id);
    } else if (selectedPersona) {
      onUpdatePersona(selectedPersona.id, cleanName, cleanPrompt);
    }

    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 1400);
  };

  const handleSaveNewMemory = () => {
    if (!selectedPersona) return;
    const trimmed = newMemoryDraft.trim();
    if (!trimmed) return;
    onAddMemory(selectedPersona.id, trimmed);
    setNewMemoryDraft('');
    setShowAddMemory(false);
  };

  const handleSaveMemoryEdit = (memoryId: string) => {
    const trimmed = editingMemoryText.trim();
    if (trimmed) {
      onUpdateMemory(memoryId, trimmed);
    }
    setEditingMemoryId(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-xs sm:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
            className="flex h-[86vh] max-h-[760px] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-[0_24px_64px_-12px_rgba(0,0,0,0.28)] dark:border-white/[0.1] dark:bg-gradient-to-b dark:from-[#0F0F13] dark:to-[#070709] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_30px_80px_-15px_rgba(0,0,0,0.95)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Personas and Persona Memories"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-200/80 px-5 py-4 dark:border-white/[0.07]">
              <div>
                <h2 className="text-[14.5px] font-semibold text-zinc-950 dark:text-zinc-100">
                  Personas & Memory
                </h2>
                <p className="mt-0.5 text-[12px] text-zinc-500">
                  Reusable system prompts with isolated per-persona memory
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-1.5 text-zinc-500 transition-all duration-200 hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.95] dark:hover:bg-white/[0.07] dark:hover:text-zinc-100"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            {/* Body Split */}
            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              {/* Left Persona List */}
              <div className="flex w-full shrink-0 flex-col border-b border-zinc-200/80 bg-zinc-50/80 p-3.5 md:w-64 md:border-r md:border-b-0 dark:border-white/[0.07] dark:bg-black/60">
                <button
                  type="button"
                  onClick={handleStartNew}
                  className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-200/90 bg-gradient-to-b from-white to-zinc-50 px-3 py-2 text-[12.5px] font-medium text-zinc-900 shadow-xs transition-all duration-200 ease-in-out hover:border-zinc-300 active:scale-[0.98] dark:border-white/[0.09] dark:bg-gradient-to-b dark:from-[#16161B] dark:to-[#0E0E12] dark:text-zinc-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] dark:hover:border-white/[0.16]"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span>New persona</span>
                </button>

                <div className="flex flex-row gap-1.5 overflow-x-auto md:flex-1 md:flex-col md:overflow-y-auto">
                  {personas.map((persona) => {
                    const isSelected = !isCreatingNew && persona.id === selectedId;
                    const isActive = persona.id === activePersonaId;
                    const memCount = memories.filter((m) => m.personaId === persona.id).length;

                    return (
                      <button
                        key={persona.id}
                        type="button"
                        onClick={() => handleSelectListItem(persona)}
                        className={`flex shrink-0 items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-all duration-200 md:w-full ${
                          isSelected
                            ? 'border-zinc-300/90 bg-white text-zinc-950 shadow-xs dark:border-white/[0.1] dark:bg-gradient-to-b dark:from-[#17171C] dark:to-[#101014] dark:text-zinc-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                            : 'border-transparent text-zinc-600 hover:bg-zinc-200/50 dark:text-zinc-400 dark:hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="truncate text-[13px] font-medium">{persona.name}</div>
                          <div className="mt-0.5 text-[11px] tabular-nums text-zinc-500">
                            {isActive ? 'Active' : 'Saved'}
                            {memCount > 0 && ` · ${memCount} ${memCount === 1 ? 'memory' : 'memories'}`}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Editor & Scoped Memories */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6">
                <form onSubmit={handleSavePersona} className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-[13.5px] font-semibold text-zinc-900 dark:text-zinc-100">
                      {isCreatingNew ? 'Create Persona' : 'Persona Configuration'}
                    </h3>
                    {!isCreatingNew && selectedPersona && (
                      <div className="flex items-center gap-2">
                        {selectedPersona.id !== activePersonaId ? (
                          <button
                            type="button"
                            onClick={() => onSelectActivePersona(selectedPersona.id)}
                            className="rounded-xl border border-zinc-200/90 bg-white px-3 py-1 text-[12px] font-medium text-zinc-800 shadow-2xs transition-all duration-200 hover:bg-zinc-50 active:scale-[0.97] dark:border-white/[0.09] dark:bg-[#16161B] dark:text-zinc-200 dark:hover:bg-[#1D1D24]"
                          >
                            Set as active
                          </button>
                        ) : (
                          <span className="text-[12px] font-medium text-blue-600 dark:text-[#7AA2F7]">
                            Currently active
                          </span>
                        )}
                        {personas.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onDeletePersona(selectedPersona.id)}
                            className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[12px] text-zinc-500 transition-all duration-200 hover:bg-red-50 hover:text-red-600 active:scale-[0.97] dark:hover:bg-red-950/30 dark:hover:text-red-400"
                            title="Delete persona and its memories"
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[12px] font-medium text-zinc-600 dark:text-zinc-400">
                      Name
                    </label>
                    <input
                      type="text"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      placeholder="e.g. Systems Architect, Writing Editor"
                      required
                      className="w-full rounded-xl border border-zinc-200/90 bg-zinc-50/70 px-3.5 py-2 text-[13.5px] text-zinc-950 shadow-2xs placeholder:text-zinc-400 transition-all duration-200 focus:border-blue-500/50 focus:bg-white focus:outline-none dark:border-white/[0.09] dark:bg-black/70 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-[#7AA2F7]/50"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[12px] font-medium text-zinc-600 dark:text-zinc-400">
                      System Prompt
                    </label>
                    <textarea
                      value={promptDraft}
                      onChange={(e) => setPromptDraft(e.target.value)}
                      rows={5}
                      placeholder="Instructions sent at the start of every conversation using this persona..."
                      className="w-full rounded-xl border border-zinc-200/90 bg-zinc-50/70 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-zinc-950 shadow-2xs placeholder:text-zinc-400 transition-all duration-200 focus:border-blue-500/50 focus:bg-white focus:outline-none dark:border-white/[0.09] dark:bg-black/70 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-[#7AA2F7]/50"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    {savedFeedback && (
                      <span className="inline-flex items-center gap-1 text-[12px] text-blue-600 dark:text-[#7AA2F7]">
                        <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
                        <span>Saved</span>
                      </span>
                    )}
                    <button
                      type="submit"
                      className="rounded-xl bg-gradient-to-b from-zinc-800 to-zinc-950 px-4 py-2 text-[13px] font-medium text-white shadow-[0_3px_10px_-2px_rgba(0,0,0,0.3)] transition-all duration-200 hover:from-zinc-700 hover:to-zinc-900 active:scale-[0.97] dark:from-zinc-100 dark:to-zinc-300 dark:text-black dark:shadow-[0_3px_12px_-3px_rgba(255,255,255,0.22)] dark:hover:from-white dark:hover:to-zinc-200"
                    >
                      {isCreatingNew ? 'Create Persona' : 'Save Changes'}
                    </button>
                  </div>
                </form>

                {/* Persona-Coupled Memories Section */}
                {!isCreatingNew && selectedPersona && (
                  <div className="mt-7 border-t border-zinc-200/80 pt-5 dark:border-white/[0.07]">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h4 className="flex items-center gap-2 text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                          <Bookmark className="h-3.5 w-3.5 text-zinc-500" strokeWidth={1.5} />
                          <span>Memories for {selectedPersona.name}</span>
                          <span className="font-mono text-[11.5px] font-normal tabular-nums text-zinc-500">
                            ({personaMemories.length})
                          </span>
                        </h4>
                        <p className="mt-0.5 text-[12px] text-zinc-500">
                          Injected automatically only when {selectedPersona.name} is active.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAddMemory((v) => !v)}
                        className="inline-flex items-center gap-1 rounded-xl border border-zinc-200/90 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-700 shadow-2xs transition-all duration-200 hover:bg-zinc-50 active:scale-[0.97] dark:border-white/[0.09] dark:bg-[#151519] dark:text-zinc-300 dark:hover:bg-[#1D1D23]"
                      >
                        <Plus className="h-3 w-3" strokeWidth={1.75} />
                        <span>Add note</span>
                      </button>
                    </div>

                    <AnimatePresence>
                      {showAddMemory && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                          className="mt-3 rounded-xl border border-zinc-200/90 bg-zinc-50/80 p-3.5 shadow-xs dark:border-white/[0.08] dark:bg-black/70"
                        >
                          <textarea
                            value={newMemoryDraft}
                            onChange={(e) => setNewMemoryDraft(e.target.value)}
                            rows={3}
                            placeholder="Write a concise bullet point or durable fact for this persona..."
                            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-zinc-900 focus:border-blue-500/50 focus:outline-none dark:border-white/[0.08] dark:bg-[#0D0D11] dark:text-zinc-100"
                          />
                          <div className="mt-2.5 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddMemory(false);
                                setNewMemoryDraft('');
                              }}
                              className="rounded-xl px-3 py-1 text-[12px] text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-200"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveNewMemory}
                              className="rounded-xl bg-zinc-900 px-3.5 py-1 text-[12px] font-medium text-white shadow-xs transition-all duration-200 hover:bg-zinc-800 active:scale-[0.97] dark:bg-zinc-100 dark:text-black dark:hover:bg-white"
                            >
                              Save memory
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {personaMemories.length === 0 ? (
                      <div className="mt-4 rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-center dark:border-white/[0.08]">
                        <p className="text-[12.5px] text-zinc-500">
                          No saved memories for {selectedPersona.name} yet. Click the bookmark icon in
                          the chat header to summarize a conversation into memory.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2.5">
                        {personaMemories.map((mem) => {
                          const isEditing = editingMemoryId === mem.id;
                          return (
                            <div
                              key={mem.id}
                              className="rounded-xl border border-zinc-200/90 bg-gradient-to-b from-white to-zinc-50/60 p-3.5 shadow-xs transition-all duration-200 dark:border-white/[0.08] dark:bg-gradient-to-b dark:from-[#121216] dark:to-[#0C0C0F] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                            >
                              {isEditing ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={editingMemoryText}
                                    onChange={(e) => setEditingMemoryText(e.target.value)}
                                    rows={4}
                                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-zinc-900 focus:border-blue-500/50 focus:outline-none dark:border-white/[0.08] dark:bg-black dark:text-zinc-100"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setEditingMemoryId(null)}
                                      className="rounded-xl px-3 py-1 text-[12px] text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-200"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveMemoryEdit(mem.id)}
                                      className="rounded-xl bg-zinc-900 px-3.5 py-1 text-[12px] font-medium text-white shadow-xs transition-all duration-200 hover:bg-zinc-800 active:scale-[0.97] dark:bg-zinc-100 dark:text-black dark:hover:bg-white"
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-800 dark:text-zinc-200">
                                      {mem.summary}
                                    </div>
                                    <div className="flex shrink-0 items-center gap-0.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingMemoryId(mem.id);
                                          setEditingMemoryText(mem.summary);
                                        }}
                                        title="Edit memory"
                                        aria-label="Edit memory"
                                        className="rounded-xl p-1.5 text-zinc-400 transition-colors duration-200 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-white/[0.08] dark:hover:text-zinc-200"
                                      >
                                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onDeleteMemory(mem.id)}
                                        title="Delete memory"
                                        aria-label="Delete memory"
                                        className="rounded-xl p-1.5 text-zinc-400 transition-colors duration-200 hover:bg-zinc-200/70 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-white/[0.08] dark:hover:text-red-400"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="mt-2 flex items-center gap-2 text-[11px] tabular-nums text-zinc-500">
                                    <span>
                                      {new Date(mem.updatedAt).toLocaleDateString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                      })}
                                    </span>
                                    {mem.sourceConversationTitle && (
                                      <>
                                        <span aria-hidden="true">·</span>
                                        <span className="truncate">
                                          From: {mem.sourceConversationTitle}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
