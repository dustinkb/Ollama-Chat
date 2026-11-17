import { useEffect, useRef } from 'react';

export interface ShortcutBinding {
  /** Lowercase key name (e.g. 'enter', 'n', 'p') */
  key: string;
  /** Requires Ctrl (Windows/Linux) or Cmd/Meta (macOS) */
  mod?: boolean;
  /** Optional shift requirement (defaults to false so Shift+Key doesn't accidentally trigger) */
  shift?: boolean;
  /** Optional alt requirement (defaults to false) */
  alt?: boolean;
  /** Prevent browser default action when matched (e.g. Ctrl+N, Ctrl+P, Ctrl+Enter) */
  preventDefault?: boolean;
  /** Handler invoked when shortcut matches */
  handler: (event: KeyboardEvent) => void;
}

export function isMacOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platform =
    nav.userAgentData?.platform || navigator.platform || navigator.userAgent || '';
  return /mac|iphone|ipad|ipod/i.test(platform);
}

export function getPrimaryModifierLabel(): string {
  return isMacOS() ? '⌘' : 'Ctrl';
}

function isImeComposing(event: KeyboardEvent): boolean {
  return event.isComposing || event.keyCode === 229;
}

/**
 * Global keyboard shortcut manager registered at the window level.
 * Supports Ctrl (Windows/Linux) and Cmd (metaKey on macOS) interchangeably,
 * leaves standard browser editing shortcuts (Ctrl/Cmd + C/V/X/Z/Y/A) untouched,
 * and cleans up listeners cleanly on unmount.
 */
export function useKeyboardShortcuts(bindings: ShortcutBinding[]): void {
  const bindingsRef = useRef<ShortcutBinding[]>(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isImeComposing(event)) return;

      const pressedKey = event.key.toLowerCase();
      const hasPrimaryMod = event.ctrlKey || event.metaKey;

      for (const binding of bindingsRef.current) {
        if (pressedKey !== binding.key.toLowerCase()) continue;

        const requiresMod = binding.mod ?? true;
        if (requiresMod && !hasPrimaryMod) continue;
        if (!requiresMod && hasPrimaryMod) continue;

        const requiresShift = binding.shift ?? false;
        if (event.shiftKey !== requiresShift) continue;

        const requiresAlt = binding.alt ?? false;
        if (event.altKey !== requiresAlt) continue;

        if (binding.preventDefault !== false) {
          event.preventDefault();
        }

        // Suppress repeated triggers when holding down shortcut keys
        if (event.repeat) return;

        binding.handler(event);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}
