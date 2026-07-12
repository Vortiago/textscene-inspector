/**
 * Global keyboard shortcut (#224): one `window` keydown listener with the
 * `isTypingTarget` guard built in, so every shortcut (F-to-frame,
 * Escape-deselect, and whatever comes next) gets the don't-hijack-typing
 * behavior without re-rolling the wiring — and can't forget the guard.
 *
 * `onTrigger` is kept in a ref, so the listener subscribes ONCE per `key`
 * instead of tearing down and re-adding on every render whose closure
 * state changed (e.g. each selection change).
 */
import { useEffect, useRef } from 'react';
import { isTypingTarget } from './isTypingTarget.js';

export function useGlobalShortcut(key: string, onTrigger: () => void): void {
  const onTriggerRef = useRef(onTrigger);
  useEffect(() => {
    onTriggerRef.current = onTrigger;
  });

  useEffect(() => {
    const wanted = key.toLowerCase();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== wanted) return;
      // A held modifier means a CHORD (browser/host find on Ctrl/Cmd+F, OS
      // shortcuts on Alt) — never ours to hijack as the bare key.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      onTriggerRef.current();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key]);
}
