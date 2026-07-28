/**
 * Global keyboard shortcut: one `window` keydown listener with the
 * `isTypingTarget` guard built in, so every shortcut (F-to-frame,
 * Escape-deselect, and whatever comes next) gets the don't-hijack-typing
 * behavior without re-rolling the wiring — and can't forget the guard. The
 * same applies to `escape`, which yields to any open dismissable panel.
 *
 * `onTrigger` is kept in a ref, so the listener subscribes ONCE per `key`
 * instead of tearing down and re-adding on every render whose closure
 * state changed (e.g. each selection change).
 */
import { useEffect, useRef } from 'react';
import { hasOpenDismissable } from './useDismissable.js';
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
      // Escape belongs to the topmost floating panel while one is open —
      // dismissing the controls legend must not also clear the selection.
      // Guarded here rather than at each call site for the same reason
      // `isTypingTarget` is: a shortcut cannot forget what it never wires.
      // `useDismissable` dismisses through its own listener, so a panel can
      // never veto itself.
      if (wanted === 'escape' && hasOpenDismissable()) return;
      onTriggerRef.current();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key]);
}
