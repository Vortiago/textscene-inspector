/**
 * R3F entry point for the web app.
 *
 * Mounts `<TscnPreviewShell>` inside `<ResourceLoaderProvider>` so node
 * components can call `useResource()` to load textures and other
 * external resources. Missing-resource uploads are driven by the
 * shell's `<MissingResourcesPanel>` (one row per missing path,
 * per-row file input) instead of a global filename-guessing input
 * (see `docs/archive/UX-REGRESSIONS.md` §3). The toolbar carries
 * three top-level app-shell entry points: scene-fixture dropdown,
 * "Upload TSCN File" for user-supplied .tscn content, and
 * "Reset Camera" to frame the orbit controls back to default.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createRoot } from 'react-dom/client';
import {
  createResourcePipeline,
  ResourceLoaderProvider,
  TscnPreviewShell,
  useMissingResources,
  usePersistedState,
  type ViewportSelectorOption,
} from '@textscene/core';
import { Linter, type Diagnostic } from '@textscene/core/linter';
import { fixtures } from './fixturesAll';
import { FixtureTreeView } from './FixtureTree';
import { corpusRootFor } from './corpusRoot';
import { switchCorpusRoot, useCorpusRoot } from './useCorpusRoot';
import { WebResourceProvider } from './providers/WebResourceProvider';
import {
  groupDiagnosticsByLine,
  summarizeDiagnostics,
  formatProblemBadge,
  countLines,
} from './lineDiagnostics';
import { SourceGutter } from './SourceGutter';
import { info, warn } from '@textscene/core/logger';
import {
  pickRootMostTscn,
  matchResourceFiles,
  extResourcePaths,
  type MatchResult,
} from './multiFileUpload';
import { useSceneSource, DEBOUNCE_MS } from './useSceneSource';
import { useFixtureSelection } from './useFixtureSelection';
import styles from './r3f-main.module.css';

/** Sentinel value used by `<ViewportSelector>` when no fixture is active (user is on an uploaded .tscn). */
const NO_FIXTURE = '';

const SOURCE_PANE_STORAGE_KEY = 'tscn-web-source-pane';

/**
 * The web app is the first browser consumer of `@textscene/core/linter`.
 * One instance for the app's lifetime — `Linter` carries no per-call state,
 * and the rule/validator registries it reads from are populated once at
 * import time (self-registration side effects in `linter/index.ts`).
 */
const linter = new Linter();

/** The Source pane's persisted shape: shown/hidden + its dragged width. */
interface SourcePaneState {
  visible: boolean;
  width: number;
}

const DEFAULT_SOURCE_PANE_STATE: SourcePaneState = { visible: true, width: 320 };

/** Reject a corrupt/unexpected persisted shape (any missing/invalid field) in favor of the default. */
function isSourcePaneState(value: unknown): value is SourcePaneState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.visible === 'boolean' &&
    typeof v.width === 'number' &&
    Number.isFinite(v.width) &&
    v.width > 0
  );
}
/**
 * First-visit default. Pick a fixture with zero `ext_resource`
 * lines so a new visitor's first paint shows a clean scene, not a wall
 * of missing-file warnings. `unit-plane-mesh.tscn` is the canonical
 * "hello world" of the app: single PlaneMesh, no externals, parses
 * instantly. Falls back to `integration-all-primitives.tscn` (the
 * previous default) and then `fixtures[0]` so the app never lands on
 * an undefined fixture.
 */
const DEFAULT_FIXTURE =
  fixtures.find((f) => f.file === 'unit-plane-mesh.tscn')?.file ??
  fixtures.find((f) => f.file === 'integration-all-primitives.tscn')?.file ??
  fixtures[0]?.file ??
  '';

export function R3FApp() {
  // The same debounced-write persistence `<TscnPreviewShell>` uses for dock
  // layout — a plain `useEffect` writing on every state change (the previous
  // approach here) fires a synchronous `localStorage.setItem` on EVERY
  // splitter `mousemove`, putting main-thread I/O inside the exact drag
  // interaction where frame budget matters; `usePersistedState` debounces the
  // write (trailing edge, flushed on unmount/pagehide) instead.
  const [sourcePane, setSourcePane] = usePersistedState(
    SOURCE_PANE_STORAGE_KEY,
    DEFAULT_SOURCE_PANE_STATE,
    isSourcePaneState
  );

  const splitterStartRef = useRef<number>(0);

  const onSplitterMove = useCallback(
    (e: MouseEvent) => {
      const dx = e.clientX - splitterStartRef.current;
      setSourcePane((prev) => ({
        ...prev,
        width: Math.max(180, Math.min(800, prev.width + dx)),
      }));
      splitterStartRef.current = e.clientX;
    },
    [setSourcePane]
  );

  // The mouse-up handler ends the drag by detaching both document listeners.
  // Kept as one callback so the exact detach sequence lives in a single place —
  // the unmount cleanup below reuses it (self-removing as the 'mouseup' handler).
  const detachDragListeners = useCallback(() => {
    document.removeEventListener('mousemove', onSplitterMove);
    document.removeEventListener('mouseup', detachDragListeners);
  }, [onSplitterMove]);

  const onSplitterMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      splitterStartRef.current = e.clientX;
      document.addEventListener('mousemove', onSplitterMove);
      document.addEventListener('mouseup', detachDragListeners);
    },
    [onSplitterMove, detachDragListeners]
  );

  // Detach any in-flight drag listeners if the app unmounts mid-drag, so we
  // don't leak document listeners or setState on an unmounted component.
  useEffect(() => detachDragListeners, [detachDragListeners]);

  // When non-null, the user has loaded a TSCN file from their disk via
  // the toolbar's Upload button. We track the display name so the
  // toolbar can show what's active when the fixture dropdown is
  // deselected.
  const [uploadedTscnName, setUploadedTscnName] = useState<string | null>(null);

  // Upload-path errors (unreadable file, no .tscn among the dropped/selected
  // files). Distinct from `loadError`, which useSceneSource owns for fixture
  // fetches; cleared on the next successful upload, fixture switch, or edit.
  const [uploadError, setUploadError] = useState<string | null>(null);

  // useFixtureSelection owns: deep-link init, localStorage persistence, URL writeback.
  const { fixtureFile, setFixtureFile } = useFixtureSelection({
    fixtures,
    defaultFixture: DEFAULT_FIXTURE,
  });

  // useSceneSource owns the hold-last-valid invariant's full span: fixture
  // fetch + cancellation + editedSinceLoad tracking + debounced edit forward +
  // authoritative replace (ADR-0020).
  const { buffer, forwardedContent, isFetching: isFetchingFixture, loadError, onBufferChange: handleSourceChange, replace, editedSinceLoad } =
    useSceneSource({ fixtureFile, uploadedTscnName });

  // Edits are ephemeral (ADR-0020) — but the one-click switch affordances
  // (fixture palette, the tree's ⤢ open-sub-scene, a scene-replacing drop)
  // put total loss one misclick away, so loss must not be SILENT. Confirm
  // before any scene replacement that would discard pane keystrokes.
  const confirmDiscardEdits = () =>
    !editedSinceLoad() ||
    window.confirm(
      'Discard your Source-pane edits? They are not saved anywhere — use "Download .tscn" first to keep them.'
    );

  // Two error channels owned by different layers (uploadError here, loadError
  // inside useSceneSource) feed one toolbar banner, which must show whichever
  // was set most recently. Value order can't encode that — an in-flight fixture
  // fetch can reject AFTER an upload error was set — so set-order is tracked
  // explicitly: upload failures bump the channel at their set sites, and this
  // effect records a fetch error's arrival.
  const [newestErrorChannel, setNewestErrorChannel] = useState<'upload' | 'load'>('upload');
  useEffect(() => {
    if (loadError !== null) setNewestErrorChannel('load');
  }, [loadError]);

  // Drag-and-drop a .tscn (+ resource files) onto the page. A counter,
  // not a boolean, because dragenter/dragleave bubble from every descendant
  // as the cursor crosses child element boundaries during one continuous
  // drag over the app root — only net-zero really means "left the window".
  const dragCounterRef = useRef(0);
  const [dragActive, setDragActive] = useState(false);

  // Latest missing-paths set, fed by the shell's onMissingPathsChange. A ref,
  // not state, so handleFilesUpload (outside MissingResourcesProvider) reads
  // the current set without re-rendering R3FApp on each missing-path change.
  const missingPathsRef = useRef<ReadonlySet<string>>(new Set());
  const handleMissingPathsChange = useCallback((paths: ReadonlySet<string>) => {
    missingPathsRef.current = paths;
  }, []);

  // Lint the buffer continuously, debounced at the same cadence as
  // useSceneSource's render-forward — but independent of its gate (a buffer
  // that fails to RENDER can still be LINTED; the gutter is what tells the
  // user why). Re-runs whenever the buffer changes for any reason (typing,
  // fixture load, upload).
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDiagnostics(linter.lint(buffer));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [buffer]);
  const diagnosticsByLine = useMemo(() => groupDiagnosticsByLine(diagnostics), [diagnostics]);
  const problemBadge = useMemo(
    () => formatProblemBadge(summarizeDiagnostics(diagnostics)),
    [diagnostics]
  );
  // Counts newlines directly instead of `buffer.split('\n').length`, which
  // would materialize a full array of every source line on every render
  // (this recomputes on each keystroke, since `buffer` is R3FApp state).
  const lineCount = useMemo(() => countLines(buffer), [buffer]);
  const [gutterScrollTop, setGutterScrollTop] = useState(0);

  // Wire the resource pipeline. One provider + bus + loader for
  // the lifetime of the app; React component identity preserves them
  // across fixture switches so an already-uploaded texture survives a
  // fixture reload.
  const pipeline = useMemo(() => createResourcePipeline(new WebResourceProvider()), []);
  const { provider, loader } = pipeline;

  // Each vendored demo project keeps its own res:// namespace; the active
  // fixture's `root` scopes the provider's lookups to that subtree. Declared
  // BEFORE the content-fetch effect so the root is in place by the time the
  // newly-mounted scene starts requesting resources.
  const resourceRoot = useMemo(() => corpusRootFor(fixtureFile, fixtures), [fixtureFile]);
  useCorpusRoot(pipeline, resourceRoot);

  const options = useMemo<ViewportSelectorOption[]>(() => {
    const fixtureOptions: ViewportSelectorOption[] = fixtures.map((f) => ({
      value: f.file,
      label: f.name,
      category: f.category,
    }));
    // When the user is on an uploaded TSCN the dropdown's `value` is
    // `''`, but a native `<select>` falls back to the first `<option>`
    // visually if no option matches. Inject a placeholder so the
    // dropdown stays in an explicit "(Uploaded file)" state.
    if (uploadedTscnName) {
      return [
        { value: NO_FIXTURE, label: `(Uploaded: ${uploadedTscnName})` },
        ...fixtureOptions,
      ];
    }
    return fixtureOptions;
  }, [uploadedTscnName]);

  function handleFixtureChange(newFixture: string) {
    // Re-selecting the already-active fixture is a state no-op (the fetch
    // effect never re-runs) — return before the guard so the user isn't
    // shown a "discard your edits?" prompt whose acceptance discards nothing.
    if (newFixture === fixtureFile && !uploadedTscnName) return;
    // Guards the fixture palette AND the tree's ⤢ open-sub-scene (which
    // routes through here).
    if (!confirmDiscardEdits()) return;
    // Switching to a fixture replaces any user-loaded TSCN content — and
    // supersedes any upload-path error still on screen.
    setUploadedTscnName(null);
    setUploadError(null);
    setFixtureFile(newFixture);
  }

  // "Open sub-scene standalone": map an instance's res:// path onto the active
  // corpus root → fixture file, and load it as its own scene (≈ Open in Editor).
  function handleOpenSubScene(scenePath: string) {
    const rest = scenePath.startsWith('res://') ? scenePath.slice('res://'.length) : scenePath;
    handleFixtureChange(resourceRoot ? `${resourceRoot}/${rest}` : rest);
  }

  function handleTscnUpload(file: File, text: string) {
    setFixtureFile(NO_FIXTURE);
    setUploadedTscnName(file.name);
    // An uploaded scene lives in the base ('') corpus. Apply the switch now,
    // not just via useCorpusRoot's post-render effect: companion files added
    // synchronously after this call (multi-file upload) must be keyed — and
    // URL-resolved — under the uploaded scene's corpus, not the fixture corpus
    // being left behind. The hook's effect still settles the cache clear.
    switchCorpusRoot(pipeline, '');
    replace(text);
  }

  function handleResourceUpload(path: string, file: File) {
    provider.addUploadedFile(path, file);
    loader.provideFile(path);
  }

  // Surfaces one matching round's diagnostics and wires every matched file
  // into the resource pipeline.
  function applyMatchResult({ matches, ambiguousMatches, unmatched }: MatchResult) {
    for (const { candidates, file } of ambiguousMatches) {
      warn(
        `[MultiFileUpload] Ambiguous basename match for "${file.name}": candidates are ${candidates.join(', ')}. Using first match.`
      );
    }
    if (unmatched.length > 0) {
      info(`[MultiFileUpload] ${unmatched.length} dropped file(s) matched no res:// reference and were ignored.`);
    }
    for (const { path, file } of matches) {
      handleResourceUpload(path, file);
    }
  }

  // Shared entry point for BOTH drag-and-drop and the toolbar's (now
  // multi-select) file input, implementing the Multi-file matching contract:
  //
  // 1. Root-most scene pick: the .tscn whose basename no other dropped .tscn
  //    references becomes the active scene; tie/cycle falls back to first.
  // 2. Missing-list matching: every other file is matched against the picked
  //    scene's ExtResources AND the current missing paths (as last reported
  //    by the shell), so a sub-scene's own dependencies arrive by
  //    repeated drops.
  // 3. No-.tscn drop: when there are no .tscn files, attempt to fulfill the
  //    missing paths directly instead of surfacing an error.
  async function handleFilesUpload(files: readonly File[]) {
    const missingPaths = missingPathsRef.current;
    const tscnFiles = files.filter((f) => f.name.toLowerCase().endsWith('.tscn'));

    // A batch with a .tscn replaces the active scene (and the pane buffer);
    // a resource-only batch fulfills missing rows without touching edits.
    if (tscnFiles.length > 0 && !confirmDiscardEdits()) return;

    if (tscnFiles.length === 0) {
      // No .tscn — the drop can still fulfill currently-missing res:// rows.
      const result = matchResourceFiles([], files, missingPaths);
      if (result.matches.length === 0) {
        setUploadError('No .tscn file found among the dropped/selected files.');
        setNewestErrorChannel('upload');
        return;
      }
      setUploadError(null);
      applyMatchResult(result);
      return;
    }

    // Read all tscn texts for the root-most pick.
    let tscnPairs: { file: File; text: string }[];
    try {
      tscnPairs = await Promise.all(
        tscnFiles.map(async (file) => ({ file, text: await file.text() }))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setUploadError(`Failed to read TSCN file: ${message}`);
      setNewestErrorChannel('upload');
      return;
    }

    const picked = pickRootMostTscn(tscnPairs);
    if (picked.ambiguous) {
      info(
        '[MultiFileUpload] Could not determine root-most scene unambiguously; using first .tscn file.'
      );
    }

    setUploadError(null);
    handleTscnUpload(picked.file, picked.text);

    const others = files.filter((f) => f !== picked.file);
    if (others.length > 0) {
      // Tier-2 (missing-list) matching exists for the repeated-drop workflow
      // WITHIN the '' upload corpus. When this drop leaves a fixture corpus
      // (resourceRoot !== ''), the outgoing scene's missing paths belong to a
      // namespace the upload keying just abandoned — matching against them
      // would silently store files under keys the new scene can never request.
      const replaceMissingPaths = resourceRoot === '' ? missingPaths : new Set<string>();
      // A multi-.tscn pick already parsed the scene — reuse those paths; a
      // single-.tscn batch parses here, only because there are files to match.
      applyMatchResult(
        matchResourceFiles(
          picked.extResourcePaths ?? extResourcePaths(picked.text),
          others,
          replaceMissingPaths
        )
      );
    }
  }

  function handleDragEnter(e: ReactDragEvent) {
    e.preventDefault();
    if (!e.dataTransfer.types.includes('Files')) return;
    dragCounterRef.current += 1;
    setDragActive(true);
  }

  // Required so the browser's default "reject the drop" behavior doesn't
  // win — without this, `onDrop` never fires.
  function handleDragOver(e: ReactDragEvent) {
    e.preventDefault();
  }

  function handleDragLeave(e: ReactDragEvent) {
    e.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setDragActive(false);
  }

  function handleDrop(e: ReactDragEvent) {
    e.preventDefault();
    dragCounterRef.current = 0;
    setDragActive(false);
    void handleFilesUpload(Array.from(e.dataTransfer.files));
  }

  function handleBufferChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const newValue = e.target.value;
    // Clear any upload-level error when the user starts editing.
    setUploadError(null);
    handleSourceChange(newValue);
  }

  function handleResourceRemove(path: string) {
    // Drop the uploaded file AND re-request through the loader
    // so dependents flip back to `missing`. Without provideFile() the
    // dispatcher's `useResource` would keep its `loaded` value (cached
    // texture) and the panel row would never reappear in the missing
    // list — defeating the "Remove → row reappears" round-trip.
    provider.removeUploadedFile(path);
    loader.provideFile(path);
  }

  // Download .tscn — a Blob + anchor export, no write-back to disk
  // (ADR-0020). Named after whatever is active so a batch of downloads
  // doesn't collide on a generic "scene.tscn".
  function downloadFilename(): string {
    const base = uploadedTscnName || fixtureFile.split('/').pop() || 'scene.tscn';
    return base.endsWith('.tscn') ? base : `${base}.tscn`;
  }

  function handleDownloadTscn() {
    const blob = new Blob([buffer], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = downloadFilename();
      anchor.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // The toolbar shows the most recently SET error (newestErrorChannel above);
  // if that channel has since been cleared, the other one — if still live —
  // shows instead. Each error is cleared by the interactions that supersede
  // it: edits clear both, fixture switches clear uploadError, replace()
  // clears loadError.
  const effectiveLoadError =
    newestErrorChannel === 'load' ? (loadError ?? uploadError) : (uploadError ?? loadError);

  // Nothing has EVER rendered (forwardedContent stays '' once a valid
  // render has occurred — hold-last-valid never reverts it) AND the current
  // buffer isn't blank either — so the user pasted/typed something that
  // simply doesn't parse. The shell's own content==='' state ("Loading
  // scene…") would otherwise look identical to a genuinely empty pane, so
  // this notice — outside the (unmodified) shared shell — fills that gap.
  // `!effectiveLoadError` keeps this mutually exclusive with the toolbar's own
  // role="alert" banner by construction, not by relying on every call site
  // that sets one to also clear the other.
  const showUnrenderableNotice =
    !effectiveLoadError && forwardedContent.trim().length === 0 && buffer.trim().length > 0;

  return (
    <ResourceLoaderProvider loader={loader}>
      <div
        data-testid="app-root"
        style={{ width: '100vw', height: '100vh', display: 'flex', position: 'relative' }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {dragActive && (
          <div data-testid="drop-zone-hint" className={styles.dropZoneHint}>
            Drop a .tscn file (and its resources) to open it
          </div>
        )}
        {sourcePane.visible && (
          <>
            {/* flex-shrink:0 (in .sourcePane) keeps the pane at its set/dragged
                width; the shell wrapper below takes flex:1 to fill the rest. */}
            <div
              data-testid="source-pane"
              className={styles.sourcePane}
              style={{ width: sourcePane.width, minWidth: 0 }}
            >
              <div className={styles.sourcePaneHeader}>
                <span className={styles.sourcePaneTitle}>Source</span>
                <button
                  type="button"
                  className={styles.downloadButton}
                  data-testid="download-tscn-button"
                  onClick={handleDownloadTscn}
                  disabled={buffer.trim().length === 0}
                  title="Download the current buffer as a .tscn file"
                >
                  ⭳ Download .tscn
                </button>
              </div>
              <div className={styles.sourceBody}>
                <SourceGutter
                  lineCount={lineCount}
                  byLine={diagnosticsByLine}
                  scrollTop={gutterScrollTop}
                />
                <textarea
                  className={styles.sourceTextarea}
                  value={buffer}
                  onChange={handleBufferChange}
                  onScroll={(e) => setGutterScrollTop(e.currentTarget.scrollTop)}
                  wrap="off"
                  aria-label="Scene source"
                  placeholder="Paste or type your .tscn here…"
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
            </div>
            <div
              className={styles.sourceSplitter}
              data-testid="source-pane-splitter"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize source pane"
              onMouseDown={onSplitterMouseDown}
            />
          </>
        )}
        <div style={{ flex: 1, minWidth: 0, height: '100%', position: 'relative' }}>
          <TscnPreviewShell
            panelId={`web-${fixtureFile || uploadedTscnName || 'empty'}`}
            content={forwardedContent}
            rootScenePath={`res://${
              // The scene's res:// identity is relative to its corpus root.
              (resourceRoot && fixtureFile.startsWith(`${resourceRoot}/`)
                ? fixtureFile.slice(resourceRoot.length + 1)
                : fixtureFile) ||
              uploadedTscnName ||
              'empty.tscn'
            }`}
            onResourceUpload={handleResourceUpload}
            onResourceRemove={handleResourceRemove}
            onMissingPathsChange={handleMissingPathsChange}
            onOpenSubScene={handleOpenSubScene}
            toolbar={
              <Toolbar
                options={options}
                fixtureFile={fixtureFile}
                uploadedTscnName={uploadedTscnName}
                loadError={effectiveLoadError}
                onFixtureChange={handleFixtureChange}
                onFilesSelected={handleFilesUpload}
                paneVisible={sourcePane.visible}
                onTogglePane={() =>
                  setSourcePane((prev) => ({ ...prev, visible: !prev.visible }))
                }
                problemBadge={problemBadge}
              />
            }
          />
          {isFetchingFixture ? (
            <div
              data-testid="fixture-loading"
              role="status"
              aria-live="polite"
              className={styles.fixtureLoading}
            >
              Loading scene…
            </div>
          ) : (
            showUnrenderableNotice && (
              <div
                data-testid="unrenderable-buffer-notice"
                role="alert"
                className={styles.unrenderableNotice}
              >
                <strong>Nothing has rendered yet.</strong> The pasted/typed content doesn't parse
                as a valid .tscn scene — fix the errors marked in the Source pane's gutter to see
                a preview.
              </div>
            )
          )}
        </div>
      </div>
    </ResourceLoaderProvider>
  );
}

interface ToolbarProps {
  options: readonly ViewportSelectorOption[];
  fixtureFile: string;
  uploadedTscnName: string | null;
  loadError: string | null;
  onFixtureChange: (value: string) => void;
  /**
   * One or more files picked via the file input — a scene plus, optionally,
   * its resources. The handler matches them against the shell-reported
   * missing-paths set.
   */
  onFilesSelected: (files: File[]) => void;
  paneVisible: boolean;
  onTogglePane: () => void;
  /** Compact problem-count text (e.g. "✖ 1 / ⚠ 2"), or `null` when the buffer is clean. */
  problemBadge: string | null;
}

/** Small scene/node glyph for the scene chip. */
function SceneGlyph() {
  return (
    <svg className={styles.sceneGlyph} viewBox="0 0 16 16" aria-hidden focusable="false">
      <path d="M8 1.6 14 5v6L8 14.4 2 11V5z" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 5l6 3 6-3M8 8v6.4" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/**
 * Web toolbar: a compact "scene chip" in the shell top bar that opens a
 * command palette (click, or Ctrl/Cmd+K) for opening a `.tscn` and switching
 * scenes. The palette LEADS with "Open a .tscn from disk…" — the real-world
 * primary action — and lists the built-in fixtures below under a "dev only"
 * heading. Those fixtures are development scaffolding slated for removal; when
 * `options` is empty the palette degrades cleanly to just the open action +
 * the current-file chip.
 *
 * Note on missing files: a scene's missing `res://` dependencies are provided
 * separately and per-path in the shell's Resources tab — deliberately kept
 * distinct from "open a scene" so a picked file always maps to a known
 * target. A compact badge nudges the user toward that tab without
 * requiring it be open first.
 */
function Toolbar({
  options,
  fixtureFile,
  uploadedTscnName,
  loadError,
  onFixtureChange,
  onFilesSelected,
  paneVisible,
  onTogglePane,
  problemBadge,
}: ToolbarProps) {
  // Reset Camera lives in the shared <ViewportToolbar>, floated over the viewport.
  const tscnInputRef = useRef<HTMLInputElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // `<Toolbar>` is rendered THROUGH the shell's `toolbar` slot, i.e. as
  // a descendant of the shell's own `<MissingResourcesProvider>` — so this
  // reads the SAME live missing-paths set the shell's own
  // `<MissingResourcesPanel>` (in the Resources tab) aggregates, without any
  // new plumbing. Surfacing it here means a missing texture/scene is visible
  // without opening that tab first.
  const { missingPaths } = useMissingResources();

  // Built-in dev fixtures to switch between (drop the uploaded-placeholder
  // option, whose value is the empty sentinel).
  const scenes = useMemo(() => options.filter((o) => o.value !== NO_FIXTURE), [options]);

  const currentLabel =
    uploadedTscnName ?? scenes.find((o) => o.value === fixtureFile)?.label ?? 'No scene';

  // Ctrl/Cmd+K toggles the palette; Escape closes it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Reset + focus search each time the palette opens.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    const id = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  function selectScene(value: string) {
    onFixtureChange(value);
    setOpen(false);
  }

  function handleTscnFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    onFilesSelected(Array.from(files));
    // Reset so the same filename(s) can be re-opened.
    if (tscnInputRef.current) tscnInputRef.current.value = '';
    setOpen(false);
  }

  return (
    <div className={styles.toolbar}>
      <button
        type="button"
        className={styles.openButton}
        data-testid="source-pane-toggle"
        onClick={onTogglePane}
        aria-expanded={paneVisible}
        title="Toggle the source pane"
      >
        {paneVisible ? 'Hide' : 'Show'} Source
        {problemBadge && (
          <span className={styles.problemBadge} data-testid="problem-badge">
            {problemBadge}
          </span>
        )}
      </button>
      {/* Primary action — open your own .tscn from disk. Triggers the same
          hidden input the ⌘K palette uses; kept visible because the built-in
          fixtures are dev-only scaffolding, so this is the real entry point. */}
      <button
        type="button"
        className={styles.openButton}
        onClick={() => tscnInputRef.current?.click()}
        title="Open a .tscn file from disk"
      >
        <span className={styles.openIcon} aria-hidden>
          ⤓
        </span>
        Open <code className={styles.openExt}>.tscn</code>
      </button>
      <button
        type="button"
        className={styles.sceneChip}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Current scene — click to switch (Ctrl+K)"
      >
        <SceneGlyph />
        {uploadedTscnName ? (
          <span
            className={styles.sceneName}
            data-testid="uploaded-tscn-label"
            title={uploadedTscnName}
          >
            {uploadedTscnName}
          </span>
        ) : (
          <span className={styles.sceneName}>{currentLabel}</span>
        )}
        <span className={styles.caret} aria-hidden>
          ▾
        </span>
      </button>

      {missingPaths.size > 0 && (
        <span
          className={styles.missingResourcesBadge}
          data-testid="missing-resources-badge"
          title="Resources referenced by this scene are missing — see the Resources tab"
        >
          ⚠ {missingPaths.size} missing
        </span>
      )}

      {loadError && (
        <span role="alert" className={styles.errorMessage}>
          {loadError}
        </span>
      )}

      {/* Always rendered (visually hidden) so the open-file action — and the
          upload tests — can reach it whether or not the palette is open. */}
      <input
        ref={tscnInputRef}
        type="file"
        // Multi-select — a .tscn plus its resource files can be picked
        // in one gesture. `accept` covers the file kinds handleFilesUpload's
        // basename-matching can actually resolve: the binary resource
        // extensions (resourceProviderUtils.isBinaryResourceType) plus the
        // text resources the pipeline routes (.tres materials/tilesets) —
        // missing rows are routinely .tres, and drag-and-drop already
        // accepts them, so the picker must too.
        accept=".tscn,.tres,.glb,.gltf,.png,.jpg,.jpeg,.webp,.svg,.wav,.ogg,.mp3"
        multiple
        onChange={handleTscnFileChange}
        className={styles.srOnly}
        data-testid="upload-tscn-input"
        tabIndex={-1}
        aria-hidden
      />

      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} aria-hidden />
          <div className={styles.palette} role="dialog" aria-label="Open or switch scene">
            {/* Primary action — open the user's own .tscn. */}
            <button
              type="button"
              className={styles.openDisk}
              onClick={() => tscnInputRef.current?.click()}
            >
              <span className={styles.openDiskIcon} aria-hidden>
                ⤓
              </span>
              Open a <code>.tscn</code> from disk…
            </button>

            {scenes.length > 0 && (
              <>
                <input
                  ref={searchRef}
                  className={styles.search}
                  placeholder="Search built-in scenes…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Filter built-in scenes"
                />
                <div className={styles.list}>
                  <FixtureTreeView
                    fixtures={fixtures}
                    query={query}
                    selectedFile={uploadedTscnName ? '' : fixtureFile}
                    onSelect={selectScene}
                  />
                </div>
                <div className={styles.devNote}>Built-in scenes are a development aid.</div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function mountR3F(container: HTMLElement): void {
  container.innerHTML = '';
  container.style.display = 'block';
  container.style.width = '100vw';
  container.style.height = '100vh';

  const root = createRoot(container);
  root.render(<R3FApp />);
}
