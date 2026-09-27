/**
 * The web app's R3F entry point. It mounts `<TscnPreviewShell>` inside
 * `<ResourceLoaderProvider>`, so node components load resources with `useResource()`.
 * The shell's `<MissingResourcesPanel>` takes one upload per missing path.
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
import { FileProblems } from './FileProblems';
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

/** The site mirrors exactly the scenes it lists, so an empty catalog means no mirror. */
const HAS_FIXTURES_MIRROR = fixtures.length > 0;

export function R3FApp() {
  const { sourcePane, toggleVisible: toggleSourcePane, onSplitterMouseDown } = useSourcePane();

  // The display name of a .tscn the user loaded from disk, which the toolbar shows while
  // no fixture is selected.
  const [uploadedTscnName, setUploadedTscnName] = useState<string | null>(null);

  // Owns the deep-link start, the localStorage persistence and the URL writeback.
  const { fixtureFile, setFixtureFile } = useFixtureSelection({
    fixtures,
    defaultFixture: DEFAULT_FIXTURE,
  });

  // `?camera=<node path>` deep-link: look through a scene Camera3D on open.
  const initialActiveCameraPath = useCameraDeepLink();

  // One provider, bus and loader for the app's lifetime, so an uploaded texture survives a
  // fixture switch.
  const pipeline = useMemo(
    () => createResourcePipeline(new WebResourceProvider({ hasFixturesMirror: HAS_FIXTURES_MIRROR })),
    []
  );
  const { provider, loader } = pipeline;

  // Each vendored demo project keeps its own res:// namespace. The root switches at the
  // scene swap, never while a scene is on screen: the outgoing scene would re-request its
  // res:// paths from the incoming corpus (useCorpusRoot).
  const applyCorpusRoot = useCorpusRoot(pipeline);

  // `onBeforeSwap` is read from a ref, so a plain function serves, not a useCallback.
  const { buffer, forwardedContent, renderedFixtureFile, isFetching: isFetchingFixture, loadError, onBufferChange: handleSourceChange, replace, clearRender, reload, editedSinceLoad } =
    useSceneSource({
      fixtureFile,
      uploadedTscnName,
      onBeforeSwap: (file) => applyCorpusRoot(corpusRootFor(file, fixtures)),
    });

  // The corpus root of the scene on screen. During a fetch the selection has moved on
  // while the previous scene and its res:// namespace are still live.
  const resourceRoot = useMemo(
    () => corpusRootFor(renderedFixtureFile, fixtures),
    [renderedFixtureFile]
  );

  /**
   * Cross a corpus boundary with the viewport empty (`useCorpusRoot` says why). Every
   * scene replacement that may change corpus goes through here.
   */
  const tearDownIfCrossingCorpus = (nextRoot: string) => {
    if (nextRoot === resourceRoot) return;
    // Commits the unmount before the root moves: a scene mounted when the caches clear
    // leaks. Both callers are event handlers, where flushSync is legal.
    flushSync(() => clearRender());
    // Not the root too: r3f's own reconciler schedules its unmount outside this flushSync,
    // and still-subscribed consumers answer a cache clear by refetching under the new
    // root. The root moves at the swap, a network round trip later.
  };

  // Edits are ephemeral (ADR-0020), but one misclick on a switch (fixture palette, ⤢
  // open-sub-scene, a scene-replacing drop) loses them all. Confirm before any scene
  // replacement that would discard pane keystrokes.
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
    // The matcher keys on basename, and the basename of a resource inside a `.tres` carries
    // its `::id`, which no dropped file matches. Map it to the owning file the user can drop.
    missingPathsRef.current = new Set([...paths].map(resourceFilePath));
  }, []);

  const { diagnosticsByLine, fileDiagnostics, problemBadge, lineCount } =
    useSourceDiagnostics(buffer);
  const [gutterScrollTop, setGutterScrollTop] = useState(0);

  const options = useMemo(() => fixtureOptions(uploadedTscnName), [uploadedTscnName]);

  function handleFixtureChange(newFixture: string) {
    // Re-selecting the active fixture is a state no-op, so return before a discard prompt
    // that discards nothing. After a failed load, picking it again is the only retry. An
    // edit since the failure clears `loadError`, so a retry never overwrites the buffer.
    if (newFixture === fixtureFile && !uploadedTscnName) {
      if (loadError) reload();
      return;
    }
    // Guards the fixture palette and the tree's ⤢ open-sub-scene, which routes through here.
    if (!confirmDiscardEdits()) return;
    // A fixture replaces any uploaded scene and any upload error still on screen.
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
    // An upload lives in the base ('') corpus, and this is its scene swap. The root moves
    // before the content, so companion files added after this call resolve under the
    // upload's corpus. `handleFilesUpload` has already torn down a scene from another corpus.
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
    // provideFile() re-requests, so dependents flip back to `missing` and the panel row
    // reappears. Without it `useResource` keeps its cached `loaded` value.
    provider.removeUploadedFile(path);
    loader.provideFile(path);
  }

  function handleDownloadTscn() {
    downloadTscn(buffer, downloadFilename(uploadedTscnName, fixtureFile));
  }

  // Nothing has rendered (hold-last-valid never reverts forwardedContent to '') and the
  // buffer is not blank, so the input does not parse. The shell's "Loading scene…" state
  // looks the same. `!effectiveLoadError` excludes the toolbar's alert banner by construction.
  const showUnrenderableNotice =
    !effectiveLoadError &&
    forwardedContent.trim().length === 0 &&
    buffer.trim().length > 0 &&
    // Only the user's own input: a corpus-boundary teardown also empties the render while
    // the pane holds the outgoing source, and that is a load in progress.
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
                {fileDiagnostics && <FileProblems group={fileDiagnostics} />}
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
              // Relative to `resourceRoot`, so it names the rendered fixture. An upload is
              // named by its file name.
              renderedFixtureFile
                ? fixtureFileToRes(renderedFixtureFile, resourceRoot)
                : `res://${uploadedTscnName || 'empty.tscn'}`
            }
            onResourceUpload={handleResourceUpload}
            onResourceRemove={handleResourceRemove}
            onMissingPathsChange={handleMissingPathsChange}
            // Opening a sub-scene loads it from the mirror, so without one the ⤢ button goes.
            onOpenSubScene={HAS_FIXTURES_MIRROR ? handleOpenSubScene : undefined}
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
