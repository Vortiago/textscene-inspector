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
 * Unit-testable with a stubbed fetch, no DOM.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveForwardedContent } from './sourceGate';
import { FIXTURE_STORAGE_KEY } from './useFixtureSelection';

/** Pane edits reach the renderer only after this pause — never on the keystroke itself (ADR-0020). */
export const DEBOUNCE_MS = 250;

export interface UseSceneSourceOptions {
  /** The currently selected fixture file path, or '' when on an upload. */
  fixtureFile: string;
  /** Non-null when the user has loaded a .tscn from disk, so the fetch effect is skipped. */
  uploadedTscnName: string | null;
  /**
   * Called synchronously with the arriving fixture's file path immediately
   * before its content becomes the rendered scene — the only moment at which
   * the host may re-point resource resolution (see `useCorpusRoot`), because
   * the outgoing scene is already gone and the incoming one has not rendered.
   * Read from a ref, so an unstable callback never re-triggers the fetch.
   */
  onBeforeSwap?: (fixtureFile: string) => void;
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
   * The fixture file the RENDERED content came from — '' for an uploaded
   * scene, a blanked render, or a fixture whose fetch is still in flight.
   * Distinct from the selected `fixtureFile`, which runs ahead of the render
   * for the whole fetch; anything scoped to what is actually on screen (the
   * corpus root above all) must key on this, not on the selection.
   */
  renderedFixtureFile: string;
  /**
   * Called on every textarea change event value.
   * Sets the buffer immediately and arms a debounced forward.
   */
  onBufferChange: (value: string) => void;
  /**
   * Authoritative replacement — sets buffer and forwardedContent together,
   * cancelling any pending debounce. Used by uploads (unconditional path).
   * `from` records the fixture the text came from; omitted for content that
   * belongs to no fixture (an upload).
   */
  replace: (text: string, from?: string) => void;
  /**
   * Drop the RENDERED scene, leaving the pane buffer alone — the
   * corpus-boundary teardown. Only what the renderer holds has to go (a
   * mounted scene is what turns a root switch into cross-corpus fetches); the
   * editor keeps showing the outgoing source until the incoming scene lands,
   * exactly as a same-corpus switch does.
   */
  clearRender: () => void;
  /**
   * True when the pane holds keystrokes newer than the last load/replace —
   * i.e. content that a fixture switch, ⤢ open-sub-scene, or upload-replace
   * would silently discard. A function (reads the live ref) so event
   * handlers get the current answer without re-render churn.
   */
  editedSinceLoad: () => boolean;
}

export function useSceneSource({
  fixtureFile,
  uploadedTscnName,
  onBeforeSwap,
}: UseSceneSourceOptions): UseSceneSourceResult {
  const [buffer, setBuffer] = useState<string>('');
  const [forwardedContent, setForwardedContent] = useState<string>('');
  const [renderedFixtureFile, setRenderedFixtureFile] = useState<string>('');
  const [isFetching, setIsFetching] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Kept in a ref so a caller's inline callback can never land in the fetch
  // effect's deps and re-trigger the fetch.
  const onBeforeSwapRef = useRef(onBeforeSwap);
  onBeforeSwapRef.current = onBeforeSwap;

  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Flips true when the user edits after the current fixture load started.
  // A resolving load must never stomp newer keystrokes.
  const editedSinceLoadRef = useRef(false);

  // Authoritative replacement: buffer and forwardedContent move together,
  // superseding any pending debounced edit forward. The pane now holds known
  // content, so a fetch error no longer describes it — clear it (uploads
  // never re-run the fetch effect, so nothing else would) — and any earlier
  // keystrokes are gone, so the edited flag resets too.
  const replace = useCallback((text: string, from = '') => {
    clearTimeout(timerRef.current);
    setBuffer(text);
    setForwardedContent(text);
    setRenderedFixtureFile(from);
    setLoadError(null);
    editedSinceLoadRef.current = false;
  }, []);

  // Teardown half of a corpus crossing. Deliberately does NOT touch `buffer`,
  // `loadError` or the edited flag: the caller either has a fetch about to
  // reset them or an upload's `replace` about to supersede them, and blanking
  // the editor for the whole fetch is not something the leak requires.
  const clearRender = useCallback(() => {
    clearTimeout(timerRef.current);
    setForwardedContent('');
    setRenderedFixtureFile('');
  }, []);

  // Fixture fetch effect. Re-runs when fixtureFile or uploadedTscnName changes.
  useEffect(() => {
    let cancelled = false;

    const cleanup = () => {
      cancelled = true;
      clearTimeout(timerRef.current);
    };

    if (!fixtureFile) {
      // A previous fixture's fetch may still be in flight — the `cancelled`
      // guard makes its finally() skip the reset, so reset the flag here.
      setIsFetching(false);
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
        // The scene swap. Resource resolution is re-pointed FIRST, in the same
        // synchronous turn: the outgoing scene is gone by now (a corpus-crossing
        // selection tore it down before this fetch started) and the incoming one
        // has not rendered, so this is the only moment at which no consumer can
        // observe a foreign corpus root.
        onBeforeSwapRef.current?.(fixtureFile);
        // Forward fetched text unconditionally (like upload): a zero-node
        // fixture must surface the shell's parse-error banner, not silently
        // hold the previous render — hold-last-valid applies to the edit loop
        // only.
        replace(text, fixtureFile);
        try {
          window.localStorage.setItem(FIXTURE_STORAGE_KEY, fixtureFile);
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

  const editedSinceLoad = useCallback(() => editedSinceLoadRef.current, []);

  return {
    buffer,
    forwardedContent,
    renderedFixtureFile,
    isFetching,
    loadError,
    onBufferChange,
    replace,
    clearRender,
    editedSinceLoad,
  };
}
