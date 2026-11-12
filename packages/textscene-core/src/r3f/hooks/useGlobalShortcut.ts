/**
 * A global keyboard shortcut: one `window` keydown listener with the `isTypingTarget` guard built
 * in, so no shortcut can forget it. `onTrigger` lives in a ref, so the listener subscribes once
 * per `key`, not on every render whose closure changed.
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
    const isLetter = /^[a-z]$/.test(wanted);
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== wanted) return;
      // A held modifier means a chord (find on Ctrl/Cmd+F, OS shortcuts on Alt), never the bare key.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Shift with a letter is its own chord too (Shift+F toggles freelook). A symbol such as `?`
      // needs Shift to be typed at all.
      if (e.shiftKey && isLetter) return;
      if (isTypingTarget(e.target)) return;
      // Escape belongs to an open floating panel, so dismissing it does not also clear the
      // selection. Guarded here, not per call site, so no shortcut can forget it. `useDismissable`
      // dismisses through its own listener, so a panel never vetoes itself.
      if (wanted === 'escape' && hasOpenDismissable()) return;
      onTriggerRef.current();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key]);
}
