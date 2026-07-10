/**
 * localStorage-backed `useState` (#224). Mirrors the try/catch
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
 */
import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

function readPersisted<T>(key: string, defaultValue: T, isValid?: (value: unknown) => value is T): T {
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

export function usePersistedState<T>(
  key: string,
  defaultValue: T,
  isValid?: (value: unknown) => value is T
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => readPersisted(key, defaultValue, isValid));

  const setPersistedState = useCallback<Dispatch<SetStateAction<T>>>(
    (update) => {
      setState((prev) => {
        const next = update instanceof Function ? update(prev) : update;
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(key, JSON.stringify(next));
          }
        } catch {
          /* private mode / quota exceeded — the in-memory state still updates. */
        }
        return next;
      });
    },
    [key]
  );

  return [state, setPersistedState];
}
