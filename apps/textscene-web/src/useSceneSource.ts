/**
 * useSceneSource — owns the hold-last-valid edit-loop invariant (ADR-0020).
 *
 * The invariant: a resolving fixture load must never stomp newer keystrokes.
 * This hook is the single owner of that invariant's full span:
 *   - fixture fetch + cancellation
 *   - editedSinceLoad tracking
 *   - loadError / isFetching state
 *   - debounced edit forward through resolveForwardedContent (sourceGate)
 *   - authoritative replace (the unconditional path upload uses)
 *
 * Unit-testable with fake timers + stubbed fetch, no DOM.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveForwardedContent } from './sourceGate';

const STORAGE_KEY = 'tscn-web-r3f-fixture';

/** Pane edits reach the renderer only after this pause — never on the keystroke itself (ADR-0020). */
const DEBOUNCE_MS = 250;

export interface UseSceneSourceOptions {
  /** The currently selected fixture file path, or '' when on an upload. */
  fixtureFile: string;
  /** Non-null when the user has loaded a .tscn from disk, so the fetch effect is skipped. */
  uploadedTscnName: string | null;
}

export interface UseSceneSourceResult {
  /** Raw pane buffer — always up to date with the latest keystroke. */
  buffer: string;
  /**
   * Gate-filtered content forwarded to the renderer. Updated after the
   * debounce delay (edit path) or immediately (fetch resolve / upload).
   */
  forwardedContent: string;
  /** True while a fixture fetch is in flight. */
  isFetching: boolean;
  /** Non-null when the last fetch failed; cleared on the next edit. */
  loadError: string | null;
  /**
   * Called on every textarea change event value.
   * Sets the buffer immediately and arms a debounced forward.
   */
  onBufferChange: (value: string) => void;
  /**
   * Authoritative replacement — sets buffer and forwardedContent together,
   * cancelling any pending debounce. Used by uploads (unconditional path).
   */
  replace: (text: string) => void;
}

export function useSceneSource({
  fixtureFile,
  uploadedTscnName,
}: UseSceneSourceOptions): UseSceneSourceResult {
  const [buffer, setBuffer] = useState<string>('');
  const [forwardedContent, setForwardedContent] = useState<string>('');
  const [isFetching, setIsFetching] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Flips true when the user edits after the current fixture load started.
  // A resolving load must never stomp newer keystrokes.
  const editedSinceLoadRef = useRef(false);

  // Authoritative replacement: buffer and forwardedContent move together,
  // superseding any pending debounced edit forward.
  const replace = useCallback((text: string) => {
    clearTimeout(timerRef.current);
    setBuffer(text);
    setForwardedContent(text);
  }, []);

  // Fixture fetch effect. Re-runs when fixtureFile or uploadedTscnName changes.
  useEffect(() => {
    let cancelled = false;

    const cleanup = () => {
      cancelled = true;
      clearTimeout(timerRef.current);
    };

    if (!fixtureFile) {
      // User is on an uploaded TSCN or the fixture is genuinely cleared with
      // no upload — do not overwrite whatever replace() already set.
      if (!uploadedTscnName) {
        replace('');
      }
      return cleanup;
    }

    // New fixture load starts — reset the edited guard.
    editedSinceLoadRef.current = false;
    setLoadError(null);
    setIsFetching(true);

    fetch(`/fixtures/${fixtureFile}`)
      .then((r) => {
        if (!r.ok) {
          throw new Error(`Failed to load fixture: ${r.statusText}`);
        }
        return r.text();
      })
      .then((text) => {
        if (cancelled || editedSinceLoadRef.current) return;
        // Forward fetched text unconditionally (like upload): a zero-node
        // fixture must surface the shell's parse-error banner, not silently
        // hold the previous render — hold-last-valid applies to the edit loop
        // only.
        replace(text);
        try {
          window.localStorage.setItem(STORAGE_KEY, fixtureFile);
        } catch {
          // Best-effort.
        }
      })
      .catch((err: unknown) => {
        if (cancelled || editedSinceLoadRef.current) return;
        const message = err instanceof Error ? err.message : String(err);
        setLoadError(message);
        setBuffer('');
        // forwardedContent unchanged — hold last valid render on fetch failure.
      })
      .finally(() => {
        if (cancelled) return;
        setIsFetching(false);
      });

    return cleanup;
  }, [fixtureFile, uploadedTscnName, replace]);

  const onBufferChange = useCallback(
    (value: string) => {
      setBuffer(value);
      editedSinceLoadRef.current = true;
      // The user has taken over from the load — a fetch error no longer
      // describes what the pane holds.
      setLoadError(null);

      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setForwardedContent((prev) => resolveForwardedContent(value, prev));
      }, DEBOUNCE_MS);
    },
    []
  );

  return { buffer, forwardedContent, isFetching, loadError, onBufferChange, replace };
}
