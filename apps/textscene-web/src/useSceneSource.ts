/**
 * The scene source for the pane and the renderer. It owns the hold-last-valid invariant
 * (ADR-0020): a resolving fixture load never overwrites newer keystrokes. It holds the
 * fixture fetch and its cancellation, the edited flag, the load state, the debounced
 * forward through `resolveForwardedContent`, and the unconditional `replace` of an upload.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveForwardedContent } from './sourceGate';
import { FIXTURE_STORAGE_KEY } from './useFixtureSelection';

/** Pane edits reach the renderer only after this pause, never on the keystroke itself (ADR-0020). */
export const DEBOUNCE_MS = 250;

/**
 * One failed fixture fetch. Each failure is a new object, also when a retry fails with the
 * same message, so a consumer keyed on it sees every failure arrive.
 */
export interface LoadError {
  readonly message: string;
}

export interface UseSceneSourceOptions {
  /** The currently selected fixture file path, or '' when on an upload. */
  fixtureFile: string;
  /** Non-null when the user has loaded a .tscn from disk, so the fetch effect is skipped. */
  uploadedTscnName: string | null;
  /**
   * Called synchronously with the arriving fixture's path just before it renders. Only then
   * may the host re-point resource resolution (`useCorpusRoot`): the outgoing scene is gone
   * and the incoming one has not rendered. Read from a ref, so an unstable callback never
   * re-triggers the fetch.
   */
  onBeforeSwap?: (fixtureFile: string) => void;
}

export interface UseSceneSourceResult {
  /** Raw pane buffer, up to date with the latest keystroke. */
  buffer: string;
  /**
   * Gate-filtered content forwarded to the renderer. Updated after the
   * debounce delay (edit path) or immediately (fetch resolve / upload).
   */
  forwardedContent: string;
  /** True while a fixture fetch is in flight. */
  isFetching: boolean;
  /**
   * Non-null when the last fetch failed. An edit, a new load, `replace` or `clearRender`
   * clears it.
   */
  loadError: LoadError | null;
  /**
   * The fixture file the rendered content came from: '' for an upload, a blanked render,
   * or a fetch still in flight. The selected `fixtureFile` runs ahead of it for the whole
   * fetch, so anything scoped to what is on screen (the corpus root) keys on this.
   */
  renderedFixtureFile: string;
  /**
   * Called on every textarea change event value.
   * Sets the buffer immediately and arms a debounced forward.
   */
  onBufferChange: (value: string) => void;
  /**
   * Authoritative replacement: sets buffer and forwardedContent together and cancels any
   * pending debounce. `from` is the fixture the text came from, omitted for an upload.
   */
  replace: (text: string, from?: string) => void;
  /**
   * Drop the rendered scene and leave the pane buffer alone: the corpus-boundary teardown.
   * A mounted scene turns a root switch into cross-corpus fetches, so only the render goes.
   * The editor shows the outgoing source until the incoming scene lands.
   */
  clearRender: () => void;
  /**
   * Re-run the current fixture's fetch. Selecting the selected fixture again is a state
   * no-op, so without this a failed load has no way back.
   */
  reload: () => void;
  /**
   * True when the pane holds keystrokes newer than the last load or replace, which a
   * fixture switch, ⤢ open-sub-scene or upload would discard. A function over the live
   * ref, so event handlers get the current answer without a re-render.
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
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  // Bumped by `reload` to re-run the fetch effect at an unchanged fixtureFile.
  const [reloadNonce, setReloadNonce] = useState(0);

  // A ref, so a caller's inline callback never lands in the fetch effect's deps.
  const onBeforeSwapRef = useRef(onBeforeSwap);
  onBeforeSwapRef.current = onBeforeSwap;

  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // True when the user edits after the current fixture load started.
  const editedSinceLoadRef = useRef(false);

  // The pane now holds known content, so a fetch error no longer describes it. An upload
  // never re-runs the fetch effect, so nothing else clears it. Earlier keystrokes are
  // gone, so the edited flag resets too.
  const replace = useCallback((text: string, from = '') => {
    clearTimeout(timerRef.current);
    setBuffer(text);
    setForwardedContent(text);
    setRenderedFixtureFile(from);
    setLoadError(null);
    editedSinceLoadRef.current = false;
  }, []);

  // Leaves `buffer` and the edited flag alone: a fetch or an upload's `replace` is about
  // to reset them. `loadError` goes, or it would caption the blank viewport with a
  // previous fixture's failure.
  const clearRender = useCallback(() => {
    clearTimeout(timerRef.current);
    setForwardedContent('');
    setRenderedFixtureFile('');
    setLoadError(null);
  }, []);

  const reload = useCallback(() => setReloadNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    const cleanup = () => {
      cancelled = true;
      clearTimeout(timerRef.current);
    };

    if (!fixtureFile) {
      // A previous fetch may be in flight, and `cancelled` makes its finally() skip the reset.
      setIsFetching(false);
      // On an upload, keep what replace() already set.
      if (!uploadedTscnName) {
        replace('');
      }
      return cleanup;
    }

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
        // Re-point resource resolution first, in the same synchronous turn. The outgoing
        // scene is gone and the incoming one has not rendered, so no consumer can observe a
        // foreign corpus root.
        onBeforeSwapRef.current?.(fixtureFile);
        // Unconditional, like an upload: a zero-node fixture must show the parse-error
        // banner. Hold-last-valid applies to the edit loop only.
        replace(text, fixtureFile);
        try {
          window.localStorage.setItem(FIXTURE_STORAGE_KEY, fixtureFile);
        } catch {
          // Remembering the fixture is optional: storage can be blocked.
        }
      })
      .catch((err: unknown) => {
        if (cancelled || editedSinceLoadRef.current) return;
        const message = err instanceof Error ? err.message : String(err);
        setLoadError({ message });
        setBuffer('');
        // forwardedContent stays: a failed fetch holds the last valid render.
      })
      .finally(() => {
        if (cancelled) return;
        setIsFetching(false);
      });

    return cleanup;
  }, [fixtureFile, uploadedTscnName, replace, reloadNonce]);

  const onBufferChange = useCallback(
    (value: string) => {
      setBuffer(value);
      editedSinceLoadRef.current = true;
      // A fetch error no longer describes what the pane holds.
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
    reload,
    editedSinceLoad,
  };
}
