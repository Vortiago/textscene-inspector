import {
  StrictMode,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { TscnPreviewShell } from '@textscene/core';
import type { ResourceProvider, Scene } from '@textscene/renderer';
import { exposeScene } from './sceneConsole';
import { fixtures } from './fixturesAll';
import { corpusRootFor, resToFixtureFile, fixtureFileToRes } from './corpusRoot';
import { WebResourceProvider } from './providers/WebResourceProvider';
import { SourceGutter } from './SourceGutter';
import { FileProblems } from './FileProblems';
import { useSceneSource } from './useSceneSource';
import { useScene } from './useScene';
import { useFixtureSelection } from './useFixtureSelection';
import { useCameraDeepLink } from './useCameraDeepLink';
import { useNodeSelection } from './useNodeSelection';
import { useDocumentVisibility } from './useDocumentVisibility';
import { DEFAULT_FIXTURE, NO_FIXTURE } from './sceneSelection';
import { useSourcePane } from './sourcePane';
import { useSourceDiagnostics } from './useSourceDiagnostics';
import { downloadFilename, downloadTscn } from './downloadTscn';
import { createFileIngest } from './fileIngest';
import { useFileDrop } from './useFileDrop';
import { useUploadError } from './useUploadError';
import { FIXTURE_LOADING_TESTID } from './fixtureLoadingTestId';
import { warn } from '@textscene/core/logger';
import { Toolbar } from './R3FToolbar';
import styles from './r3f-main.module.css';

/** The site mirrors exactly the scenes it lists, so an empty catalog means no mirror. */
const HAS_FIXTURES_MIRROR = fixtures.length > 0;

/** The paths of the scene's missing files, which a dropped file can fulfil. */
function missingFilesOf(scene: Scene | null): ReadonlySet<string> {
  const files = scene?.files() ?? [];
  return new Set(files.filter((file) => file.state === 'missing').map((file) => file.path));
}

/**
 * A browser refuses the write outside a secure context or without permission: that is logged, not
 * thrown. `navigator.clipboard` is undefined outside a secure context, so the access sits in the try.
 */
async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    warn(`Copy to the clipboard failed: ${String(error)}`);
  }
}

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
  const initialPreviewedCameraPath = useCameraDeepLink();
  const isPageVisible = useDocumentVisibility();

  // In state, not a memo React may drop, so an uploaded texture survives for the app's lifetime.
  const [provider] = useState(() => new WebResourceProvider({ hasFixturesMirror: HAS_FIXTURES_MIRROR }));

  // A scene on screen when the root moves loads the other corpus's files, so it moves at the swap.
  const applyCorpusRoot = (root: string) => provider.setResourceRoot(root);

  // `onBeforeSwap` is read from a ref, so a plain function serves, not a useCallback.
  const {
    buffer,
    forwardedContent,
    renderedFixtureFile,
    isFetching: isFetchingFixture,
    loadError,
    onBufferChange: handleSourceChange,
    replace,
    clearRender,
    reload,
    editedSinceLoad,
  } = useSceneSource({
    fixtureFile,
    uploadedTscnName,
    onBeforeSwap: (file) => applyCorpusRoot(corpusRootFor(file, fixtures)),
  });

  // The corpus root of the scene on screen. During a fetch the selection has moved on
  // while the previous scene and its res:// namespace are still live.
  const resourceRoot = useMemo(() => corpusRootFor(renderedFixtureFile, fixtures), [renderedFixtureFile]);
  // Two corpora may name one res:// path, so each gets a provider object and so a loader of its own.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- a new root is what asks for a new object
  const corpusFiles = useMemo(() => filesOf(provider), [provider, resourceRoot]);
  const scene = useScene(
    forwardedContent,
    corpusFiles,
    // Relative to `resourceRoot`, so it names the rendered fixture. An upload is named by its file.
    renderedFixtureFile
      ? fixtureFileToRes(renderedFixtureFile, resourceRoot)
      : `res://${uploadedTscnName || 'empty.tscn'}`
  );
  const [selected, select] = useNodeSelection(scene);
  useEffect(() => {
    if (scene) exposeScene(scene, select);
  }, [scene, select]);

  /** Every scene replacement that may cross a corpus goes through here, to cross with the viewport empty. */
  const tearDownIfCrossingCorpus = (nextRoot: string) => {
    if (nextRoot === resourceRoot) return;
    // Both callers are event handlers, where flushSync is legal.
    flushSync(() => clearRender());
    // Not the root too: r3f unmounts outside this flushSync, so the root moves at the swap.
  };

  // Edits are ephemeral (ADR-0020), but one misclick on a switch (fixture palette, ⤢
  // open-sub-scene, a scene-replacing drop) loses them all. Confirm before any scene
  // replacement that would discard pane keystrokes.
  const confirmDiscardEdits = () =>
    !editedSinceLoad() ||
    window.confirm(
      'Discard your Source-pane edits? They are not saved anywhere — use "Download .tscn" first to keep them.'
    );

  const {
    effectiveError: effectiveLoadError,
    reportUploadError,
    clearUploadError,
  } = useUploadError(loadError);

  // Counts uploads and removals, so the Source pane lints the unchanged buffer again: a
  // cross-file rule may read the file that changed.
  const [uploadRevision, bumpUploadRevision] = useReducer((count: number) => count + 1, 0);
  const { diagnosticsByLine, fileDiagnostics, problemBadge, lineCount } = useSourceDiagnostics(
    buffer,
    provider,
    uploadRevision
  );
  const [gutterScrollTop, setGutterScrollTop] = useState(0);

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
    bumpUploadRevision();
  }

  const handleFilesUpload = createFileIngest({
    resourceRoot,
    missingFiles: () => missingFilesOf(scene),
    confirmDiscardEdits,
    tearDownIfCrossingCorpus,
    onTscnUpload: handleTscnUpload,
    onResourceUpload: handleResourceUpload,
    reportUploadError,
    clearUploadError,
  });

  const { dragActive, handleDragEnter, handleDragOver, handleDragLeave, handleDrop } = useFileDrop(
    (files) => void handleFilesUpload(files)
  );

  function handleBufferChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const newValue = e.target.value;
    // Clear any upload-level error when the user starts editing.
    clearUploadError();
    handleSourceChange(newValue);
  }

  function handleResourceRemove(path: string) {
    // The provider's watchers hear the path, so its consumers flip back to `missing`.
    provider.removeUploadedFile(path);
    bumpUploadRevision();
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
    <div
      data-testid="app-root"
      className={styles.appRoot}
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
          {/* .sourcePane keeps its dragged width (flex-shrink 0), and the shell below takes the rest. */}
          <div
            data-testid="source-pane"
            className={styles.sourcePane}
            style={{ '--source-pane-width': `${sourcePane.width}px` } as CSSProperties}
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
              <SourceGutter lineCount={lineCount} byLine={diagnosticsByLine} scrollTop={gutterScrollTop} />
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
        {scene && (
          <TscnPreviewShell
            panelId={`web-${fixtureFile || uploadedTscnName || 'empty'}`}
            scene={scene}
            onResourceUpload={handleResourceUpload}
            onResourceRemove={handleResourceRemove}
            onCopyNodePath={copyToClipboard}
            selected={selected}
            onSelect={select}
            // Opening a sub-scene loads it from the mirror, so without one the ⤢ button goes.
            onOpenSubScene={HAS_FIXTURES_MIRROR ? handleOpenSubScene : undefined}
            initialPreviewedCameraPath={initialPreviewedCameraPath}
            isVisible={isPageVisible}
            toolbar={
              <Toolbar
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
        )}
        {isFetchingFixture ? (
          <div
            data-testid={FIXTURE_LOADING_TESTID}
            role="status"
            aria-live="polite"
            className={styles.fixtureLoading}
          >
            Loading scene…
          </div>
        ) : (
          showUnrenderableNotice && (
            <div data-testid="unrenderable-buffer-notice" role="alert" className={styles.unrenderableNotice}>
              <strong>Nothing has rendered yet.</strong> The pasted/typed content doesn't parse as a valid
              .tscn scene — fix the errors marked in the Source pane's gutter to see a preview.
            </div>
          )
        )}
      </div>
    </div>
  );
}

export function mountR3F(container: HTMLElement): void {
  container.innerHTML = '';

  createRoot(container).render(
    <StrictMode>
      <R3FApp />
    </StrictMode>
  );
}

/** A provider object for one corpus, over the app's provider, which reads the active corpus root. */
function filesOf(provider: WebResourceProvider): ResourceProvider {
  return {
    loadResource: (path, type, maxBytes) => provider.loadResource(path, type, maxBytes),
    stamp: (path) => provider.stamp(path),
    listDirectory: (folder) => provider.listDirectory(folder),
    watch: (listener) => provider.watch(listener),
  };
}
