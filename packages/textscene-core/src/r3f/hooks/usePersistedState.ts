/**
 * localStorage-backed `useState`. Mirrors the try/catch
 * getItem+JSON.parse-with-fallback pattern the web app already uses inline
 * for its fixture/Source-pane persistence (`apps/textscene-web/src/r3f-main.tsx`),
 * generalised so `<TscnPreviewShell>` (shared core, both hosts) can persist
 * dock layout and viewport mode too. VS Code webviews are a browser context,
 * so `localStorage` works there the same way it does in the standalone web
 * app — no host-specific branching needed.
 *
 * Never throws: a missing/corrupt/rejected persisted value silently falls
 * back to `defaultValue`, and a failed write (private-mode/quota/no
 * `window`) is swallowed — persistence is a nice-to-have, never a crash
 * surface. This is also the load-bearing contract behind the round-2
 * "no new default-visible render toggle" constraint: a FRESH session with
 * no localStorage entry always reads back `defaultValue`.
 *
 * Writes are DEBOUNCED (trailing edge, flushed on unmount): the dock
 * splitters call the setter once per pointermove (60–1000 Hz with high-rate
 * mice), and a synchronous `localStorage.setItem` per move would put
 * main-thread I/O inside the exact interaction where frame budget matters.
 * One write lands per settled change instead of hundreds per drag.
 */
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

const WRITE_DEBOUNCE_MS = 200;

/** One-shot read of a persisted value; falls back to `defaultValue` on any failure. */
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

/** One-shot write of a persisted value; failures (private mode/quota) are swallowed. */
export function writePersisted<T>(key: string, value: T): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    /* private mode / quota exceeded — the in-memory state still updates. */
  }
}

export function usePersistedState<T>(
  key: string,
  defaultValue: T,
  isValid?: (value: unknown) => value is T
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => readPersisted(key, defaultValue, isValid));

  // Trailing-debounce persistence (see module doc): each change re-arms the
  // timer; `pendingRef` remembers a not-yet-written value so unmount AND
  // `pagehide` can flush it — React unmount effects never run on a tab
  // close/reload or a VS Code webview disposal, so without the pagehide
  // flush a change made within the debounce window would be silently lost.
  const pendingRef = useRef<{ key: string; value: T } | null>(null);
  const isFirstRunRef = useRef(true);
  useEffect(() => {
    if (isFirstRunRef.current) {
      // Never write on mount: a fresh session must not materialize the
      // default into storage just by rendering.
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
