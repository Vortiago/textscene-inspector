/**
 * R3F entry point for the web app.
 *
 * Mounts `<TscnPreviewShell>` inside `<ResourceLoaderProvider>` so node
 * components can call `useResource()` to load textures and other
 * external resources. Missing-resource uploads are driven by the
 * shell's `<MissingResourcesPanel>` (one row per missing path,
 * per-row file input) instead of a global filename-guessing input.
 * The toolbar carries
 * three top-level app-shell entry points: scene-fixture dropdown,
 * "Upload TSCN File" for user-supplied .tscn content, and
 * "Reset Camera" to frame the orbit controls back to default.
 */
import { useCallback, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import {
  createResourcePipeline,
  resourceFilePath,
  ResourceLoaderProvider,
  TscnPreviewShell,
} from '@textscene/core';
import { fixtures } from './fixturesAll';
import { corpusRootFor, resToFixtureFile, fixtureFileToRes } from './corpusRoot';
import { useCorpusRoot } from './useCorpusRoot';
import { WebResourceProvider } from './providers/WebResourceProvider';
import { SourceGutter } from './SourceGutter';
import { useSceneSource } from './useSceneSource';
import { useFixtureSelection } from './useFixtureSelection';
import { useCameraDeepLink } from './useCameraDeepLink';
import { DEFAULT_FIXTURE, NO_FIXTURE, fixtureOptions } from './sceneSelection';
import { useSourcePane } from './sourcePane';
import { useSourceDiagnostics } from './useSourceDiagnostics';
import { downloadFilename, downloadTscn } from './downloadTscn';
import { createFileIngest } from './fileIngest';
import { useFileDrop } from './useFileDrop';
import { useUploadError } from './useUploadError';
import { Toolbar } from './R3FToolbar';
import styles from './r3f-main.module.css';

export function R3FApp() {
  const { sourcePane, toggleVisible: toggleSourcePane, onSplitterMouseDown } = useSourcePane();

  // When non-null, the user has loaded a TSCN file from their disk via
  // the toolbar's Upload button. We track the display name so the
  // toolbar can show what's active when the fixture dropdown is
  // deselected.
  const [uploadedTscnName, setUploadedTscnName] = useState<string | null>(null);

  // useFixtureSelection owns: deep-link init, localStorage persistence, URL writeback.
  const { fixtureFile, setFixtureFile } = useFixtureSelection({
    fixtures,
    defaultFixture: DEFAULT_FIXTURE,
  });

  // `?camera=<node path>` deep-link: look through a scene Camera3D on open.
  const initialActiveCameraPath = useCameraDeepLink();

  // Wire the resource pipeline. One provider + bus + loader for
  // the lifetime of the app; React component identity preserves them
  // across fixture switches so an already-uploaded texture survives a
  // fixture reload.
  const pipeline = useMemo(() => createResourcePipeline(new WebResourceProvider()), []);
  const { provider, loader } = pipeline;

  // Each vendored demo project keeps its own res:// namespace. The switch into
  // a subtree happens at the scene swap below — never while a scene is on
  // screen, which would make the OUTGOING scene re-request its res:// paths out
  // of the incoming corpus (see useCorpusRoot).
  const applyCorpusRoot = useCorpusRoot(pipeline);

  // useSceneSource owns the hold-last-valid invariant's full span: fixture
  // fetch + cancellation + editedSinceLoad tracking + debounced edit forward +
  // authoritative replace (ADR-0020). `onBeforeSwap` is read from a ref there,
  // so a plain function — not a useCallback — is what it wants.
  const { buffer, forwardedContent, renderedFixtureFile, isFetching: isFetchingFixture, loadError, onBufferChange: handleSourceChange, replace, clearRender, reload, editedSinceLoad } =
    useSceneSource({
      fixtureFile,
      uploadedTscnName,
      onBeforeSwap: (file) => applyCorpusRoot(corpusRootFor(file, fixtures)),
    });

  // The corpus root of the scene ON SCREEN. Keyed on the rendered fixture, not
  // the selected one: during a fixture fetch the selection has already moved on
  // while the previous scene — and its res:// namespace — is still live.
  const resourceRoot = useMemo(
    () => corpusRootFor(renderedFixtureFile, fixtures),
    [renderedFixtureFile]
  );

  /**
   * Cross a corpus boundary with the viewport EMPTY (the reason: `useCorpusRoot`).
   * Every scene replacement that may change corpus goes through here.
   *
   * `flushSync` so the unmount is COMMITTED, not merely scheduled, before the
   * root moves — a scene still mounted when the caches clear is the leak itself.
   * Both callers are event handlers, which is where flushSync is legal.
   *
   * The root is deliberately NOT re-pointed here, tempting as it looks: the
   * viewport is r3f's own reconciler root, and its unmount does NOT land inside
   * the parent's flushSync — it is scheduled. Clearing the caches at this
   * instant announces invalidation to scene consumers that are still
   * subscribed, and they answer it by refetching their res:// paths under the
   * new root. That is the original leak, measured, not theorised. The root
   * moves at the swap instead, a network round-trip later, by which point the
   * outgoing consumers are provably gone.
   */
  const tearDownIfCrossingCorpus = (nextRoot: string) => {
    if (nextRoot === resourceRoot) return;
    flushSync(() => clearRender());
  };

  // Edits are ephemeral (ADR-0020) — but the one-click switch affordances
  // (fixture palette, the tree's ⤢ open-sub-scene, a scene-replacing drop)
  // put total loss one misclick away, so loss must not be SILENT. Confirm
  // before any scene replacement that would discard pane keystrokes.
  const confirmDiscardEdits = () =>
    !editedSinceLoad() ||
    window.confirm(
      'Discard your Source-pane edits? They are not saved anywhere — use "Download .tscn" first to keep them.'
    );

  const { effectiveError: effectiveLoadError, reportUploadError, clearUploadError } =
    useUploadError(loadError);

  // Latest missing-paths set, fed by the shell's onMissingPathsChange. A ref,
  // not state, so handleFilesUpload (outside MissingResourcesProvider) reads
  // the current set without re-rendering R3FApp on each missing-path change.
  const missingPathsRef = useRef<ReadonlySet<string>>(new Set());
  const handleMissingPathsChange = useCallback((paths: ReadonlySet<string>) => {
    // A missing path may be a resource INSIDE a `.tres`, and the matcher below
    // keys on basename — an address's basename still carries its `::id`, so no
    // droppable file could ever match it and the right file would be discarded
    // with a misleading error. What the user can drop is the owning file.
    missingPathsRef.current = new Set([...paths].map(resourceFilePath));
  }, []);

  const { diagnosticsByLine, problemBadge, lineCount } = useSourceDiagnostics(buffer);
  const [gutterScrollTop, setGutterScrollTop] = useState(0);

  const options = useMemo(() => fixtureOptions(uploadedTscnName), [uploadedTscnName]);

  function handleFixtureChange(newFixture: string) {
    // Re-selecting the already-active fixture is a state no-op (the fetch
    // effect never re-runs) — return before the guard so the user isn't
    // shown a "discard your edits?" prompt whose acceptance discards nothing.
    // Unless the last load FAILED: picking the scene again is the only retry
    // affordance there is, and after a corpus crossing there is nothing on
    // screen to fall back to. (An edit since the failure clears `loadError`,
    // so this can never stomp the user's own buffer.)
    if (newFixture === fixtureFile && !uploadedTscnName) {
      if (loadError) reload();
      return;
    }
    // Guards the fixture palette AND the tree's ⤢ open-sub-scene (which
    // routes through here).
    if (!confirmDiscardEdits()) return;
    // Switching to a fixture replaces any user-loaded TSCN content — and
    // supersedes any upload-path error still on screen.
    setUploadedTscnName(null);
    clearUploadError();
    tearDownIfCrossingCorpus(corpusRootFor(newFixture, fixtures));
    setFixtureFile(newFixture);
  }

  // "Open sub-scene standalone": map an instance's res:// path onto the active
  // corpus root → fixture file, and load it as its own scene (≈ Open in Editor).
  function handleOpenSubScene(scenePath: string) {
    handleFixtureChange(resToFixtureFile(scenePath, resourceRoot));
  }

  function handleTscnUpload(file: File, text: string) {
    setFixtureFile(NO_FIXTURE);
    setUploadedTscnName(file.name);
    // An uploaded scene lives in the base ('') corpus — this is its scene swap,
    // so the root switch (and its cache clear) lands here, before the content:
    // companion files added synchronously after this call (multi-file upload)
    // must be keyed — and URL-resolved — under the uploaded scene's corpus, not
    // the fixture corpus being left behind. `handleFilesUpload` has already torn
    // the outgoing scene down when the two corpora differ.
    applyCorpusRoot('');
    replace(text);
  }

  function handleResourceUpload(path: string, file: File) {
    provider.addUploadedFile(path, file);
    loader.provideFile(path);
  }

  const handleFilesUpload = createFileIngest({
    resourceRoot,
    missingPathsRef,
    confirmDiscardEdits,
    tearDownIfCrossingCorpus,
    onTscnUpload: handleTscnUpload,
    onResourceUpload: handleResourceUpload,
    reportUploadError,
    clearUploadError,
  });

  const { dragActive, handleDragEnter, handleDragOver, handleDragLeave, handleDrop } =
    useFileDrop((files) => void handleFilesUpload(files));

  function handleBufferChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const newValue = e.target.value;
    // Clear any upload-level error when the user starts editing.
    clearUploadError();
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

  function handleDownloadTscn() {
    downloadTscn(buffer, downloadFilename(uploadedTscnName, fixtureFile));
  }

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
    !effectiveLoadError &&
    forwardedContent.trim().length === 0 &&
    buffer.trim().length > 0 &&
    // Only the user's OWN unparseable input earns this notice. A corpus-boundary
    // teardown also empties the render while the pane still holds the outgoing
    // source — that is a load in progress, not a buffer that fails to parse.
    editedSinceLoad();

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
            rootScenePath={
              // The scene's res:// identity is relative to its corpus root — so
              // it names the RENDERED fixture, which is what `resourceRoot` is
              // relative to; an uploaded scene is named by its upload name.
              renderedFixtureFile
                ? fixtureFileToRes(renderedFixtureFile, resourceRoot)
                : `res://${uploadedTscnName || 'empty.tscn'}`
            }
            onResourceUpload={handleResourceUpload}
            onResourceRemove={handleResourceRemove}
            onMissingPathsChange={handleMissingPathsChange}
            onOpenSubScene={handleOpenSubScene}
            initialActiveCameraPath={initialActiveCameraPath}
            toolbar={
              <Toolbar
                options={options}
                fixtureFile={fixtureFile}
                uploadedTscnName={uploadedTscnName}
                loadError={effectiveLoadError}
                onFixtureChange={handleFixtureChange}
                onFilesSelected={handleFilesUpload}
                paneVisible={sourcePane.visible}
                onTogglePane={toggleSourcePane}
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

export function mountR3F(container: HTMLElement): void {
  container.innerHTML = '';
  container.style.display = 'block';
  container.style.width = '100vw';
  container.style.height = '100vh';

  const root = createRoot(container);
  root.render(<R3FApp />);
}
