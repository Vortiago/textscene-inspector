/**
 * `localStorage`-backed `useState` for both hosts, since a VS Code webview is a browser context.
 * It never throws: a missing, corrupt or rejected value reads as `defaultValue`, so a fresh
 * session always gets the default, and a failed write is swallowed.
 */
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * Trailing debounce: a dock splitter calls the setter per pointermove (60–1000 Hz), and a
 * synchronous `setItem` per move puts main-thread I/O inside the drag.
 */
const WRITE_DEBOUNCE_MS = 200;

/** Falls back to `defaultValue` on any failure. */
export function readPersisted<T>(
  key: string,
  defaultValue: T,
  isValid?: (value: unknown) => value is T
): T {
  try {
    if (typeof window === 'undefined') return defaultValue;
    const raw = window.localStorage.getItem(key);
    if (raw === null) return defaultValue;
    const parsed: unknown = JSON.parse(raw);
    if (isValid && !isValid(parsed)) return defaultValue;
    return parsed as T;
  } catch {
    return defaultValue;
  }
}

/** Swallows a failed write, as in private mode or a full quota. */
export function writePersisted<T>(key: string, value: T): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    /* Private mode or a full quota: the in-memory state still updates. */
  }
}

export function usePersistedState<T>(
  key: string,
  defaultValue: T,
  isValid?: (value: unknown) => value is T
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => readPersisted(key, defaultValue, isValid));

  // `pendingRef` holds an unwritten value so unmount and `pagehide` can flush it. Unmount effects
  // never run on a tab close, a reload or a webview disposal, so without `pagehide` a change inside
  // the debounce window is lost.
  const pendingRef = useRef<{ key: string; value: T } | null>(null);
  const isFirstRunRef = useRef(true);
  useEffect(() => {
    if (isFirstRunRef.current) {
      // Never write on mount: rendering alone must not store the default.
      isFirstRunRef.current = false;
      return;
    }
    pendingRef.current = { key, value: state };
    const timer = setTimeout(() => {
      writePersisted(key, state);
      pendingRef.current = null;
    }, WRITE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [key, state]);
  useEffect(() => {
    const flushPending = () => {
      if (pendingRef.current !== null) {
        writePersisted(pendingRef.current.key, pendingRef.current.value);
        pendingRef.current = null;
      }
    };
    window.addEventListener('pagehide', flushPending);
    return () => {
      window.removeEventListener('pagehide', flushPending);
      flushPending(); // unmount flush
    };
  }, []);

  return [state, setState];
}
