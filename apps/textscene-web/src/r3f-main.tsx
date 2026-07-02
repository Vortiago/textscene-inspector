/**
 * R3F entry point for the web app.
 *
 * Mounts `<TscnPreviewShell>` inside `<ResourceLoaderProvider>` so node
 * components can call `useResource()` to load textures and other
 * external resources. Missing-resource uploads are driven by the
 * shell's `<MissingResourcesPanel>` (one row per missing path,
 * per-row file input) instead of a global filename-guessing input
 * (see `docs/archive/UX-REGRESSIONS.md` §3 — WI-UX-3). The toolbar carries
 * three top-level app-shell entry points: scene-fixture dropdown,
 * "Upload TSCN File" for user-supplied .tscn content, and
 * "Reset Camera" to frame the orbit controls back to default
 * (WI-UX-7).
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createRoot } from 'react-dom/client';
import {
  createResourcePipeline,
  ResourceLoaderProvider,
  TscnPreviewShell,
  type ViewportSelectorOption,
} from '@textscene/core';
import { fixtures } from './fixturesAll';
import { FixtureTreeView } from './FixtureTree';
import { corpusRootFor, fixtureUrlForRes } from './corpusRoot';
import { WebResourceProvider } from './providers/WebResourceProvider';
import styles from './r3f-main.module.css';

/** Sentinel value used by `<ViewportSelector>` when no fixture is active (user is on an uploaded .tscn). */
const NO_FIXTURE = '';

const STORAGE_KEY = 'tscn-web-r3f-fixture';
const SOURCE_PANE_STORAGE_KEY = 'tscn-web-source-pane';

function getInitialSourcePaneState(): { visible: boolean; width: number } {
  try {
    const raw = window.localStorage.getItem(SOURCE_PANE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Tolerate partial/corrupt blobs: only accept a real boolean and a
      // positive finite width, otherwise fall back to the shown-at-320 default.
      const visible = typeof parsed.visible === 'boolean' ? parsed.visible : true;
      const width =
        typeof parsed.width === 'number' && Number.isFinite(parsed.width) && parsed.width > 0
          ? parsed.width
          : 320;
      return { visible, width };
    }
  } catch {
    /* ignore */
  }
  return { visible: true, width: 320 };
}

function persistSourcePaneState(visible: boolean, width: number) {
  try {
    window.localStorage.setItem(SOURCE_PANE_STORAGE_KEY, JSON.stringify({ visible, width }));
  } catch {
    /* ignore */
  }
}
/**
 * First-visit default. WI-UX-15: pick a fixture with zero `ext_resource`
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
  // Read (and JSON.parse) the persisted blob once on mount, then seed both
  // pane-state slices from it instead of re-reading localStorage twice.
  const [initialPane] = useState(getInitialSourcePaneState);
  const [paneVisible, setPaneVisible] = useState(initialPane.visible);
  const [paneWidth, setPaneWidth] = useState(initialPane.width);
  useEffect(() => {
    persistSourcePaneState(paneVisible, paneWidth);
  }, [paneVisible, paneWidth]);

  const splitterStartRef = useRef<number>(0);

  const onSplitterMove = useCallback((e: MouseEvent) => {
    const dx = e.clientX - splitterStartRef.current;
    setPaneWidth((prev) => Math.max(180, Math.min(800, prev + dx)));
    splitterStartRef.current = e.clientX;
  }, []);

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

  const [fixtureFile, setFixtureFile] = useState<string>(() => {
    try {
      // Deep-link: `?fixture=<file>` opens directly on a specific scene
      // (used by the showcase recorder to skip the default-fixture detour,
      // and handy for sharing a link to a particular scene). Unlisted
      // demo subscenes are accepted too — the selector only lists each
      // demo's main scene, but every mirrored scene stays linkable. Games
      // (on-demand corpus) get the same allowance for their unlisted subscenes.
      const param = new URLSearchParams(window.location.search).get('fixture');
      if (
        param &&
        (fixtures.some((f) => f.file === param) ||
          param.startsWith('demos/') ||
          param.startsWith('games/'))
      ) {
        return param;
      }
      return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_FIXTURE;
    } catch {
      return DEFAULT_FIXTURE;
    }
  });
  const [content, setContent] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);
  // When non-null, the user has loaded a TSCN file from their disk via
  // the toolbar's Upload button. We track the display name so the
  // toolbar can show what's active when the fixture dropdown is
  // deselected.
  const [uploadedTscnName, setUploadedTscnName] = useState<string | null>(null);

  // Wire the WI-79 resource pipeline. One provider + bus + loader for
  // the lifetime of the app; React component identity preserves them
  // across fixture switches so an already-uploaded texture survives a
  // fixture reload.
  const { provider, loader } = useMemo(
    () => createResourcePipeline(new WebResourceProvider()),
    []
  );

  // Each vendored demo project keeps its own res:// namespace; the active
  // fixture's `root` scopes the provider's lookups to that subtree. Declared
  // BEFORE the content-fetch effect so the root is in place by the time the
  // newly-mounted scene starts requesting resources.
  const resourceRoot = useMemo(() => corpusRootFor(fixtureFile, fixtures), [fixtureFile]);
  const lastRootRef = useRef(resourceRoot);
  useEffect(() => {
    provider.setResourceRoot(resourceRoot);
    // Text .gltf files load their external buffers/images through THREE's
    // LoadingManager with res://-relative URLs — map those onto the public
    // fixtures mirror (same scheme as the provider's own fetches).
    loader.eventBus.getThreeManager().setURLModifier((url) => fixtureUrlForRes(url, resourceRoot));
    if (lastRootRef.current !== resourceRoot) {
      lastRootRef.current = resourceRoot;
      // Two corpora can reference the same res:// path (e.g. art/player.png)
      // — drop the previous corpus's cached resources, keep subscribers.
      loader.clearCaches();
    }
  }, [resourceRoot, provider, loader]);

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

  useEffect(() => {
    if (!fixtureFile) {
      // The user is on an uploaded TSCN (`fixtureFile === ''`) — do not
      // overwrite `content` set by `handleTscnFileChange`. Also skip
      // when fixture is genuinely cleared with no upload.
      if (!uploadedTscnName) {
        setContent('');
      }
      return;
    }
    let cancelled = false;
    setLoadError(null);
    fetch(`/fixtures/${fixtureFile}`)
      .then((r) => {
        if (!r.ok) {
          throw new Error(`Failed to load fixture: ${r.statusText}`);
        }
        return r.text();
      })
      .then((text) => {
        if (cancelled) return;
        setContent(text);
        try {
          window.localStorage.setItem(STORAGE_KEY, fixtureFile);
        } catch {
          // Best-effort.
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setLoadError(message);
        setContent('');
      });
    return () => {
      cancelled = true;
    };
  }, [fixtureFile, uploadedTscnName]);

  function handleFixtureChange(newFixture: string) {
    // Switching to a fixture replaces any user-loaded TSCN content.
    setUploadedTscnName(null);
    setFixtureFile(newFixture);
  }

  // "Open sub-scene standalone": map an instance's res:// path onto the active
  // corpus root → fixture file, and load it as its own scene (≈ Open in Editor).
  function handleOpenSubScene(scenePath: string) {
    const rest = scenePath.startsWith('res://') ? scenePath.slice('res://'.length) : scenePath;
    handleFixtureChange(resourceRoot ? `${resourceRoot}/${rest}` : rest);
  }

  function handleTscnUpload(file: File, text: string) {
    setLoadError(null);
    setFixtureFile(NO_FIXTURE);
    setUploadedTscnName(file.name);
    setContent(text);
  }

  function handleTscnUploadError(message: string) {
    setLoadError(message);
  }

  function handleResourceUpload(path: string, file: File) {
    provider.addUploadedFile(path, file);
    loader.provideFile(path);
  }

  function handleResourceRemove(path: string) {
    // WI-UX-6: drop the uploaded file AND re-request through the loader
    // so dependents flip back to `missing`. Without provideFile() the
    // dispatcher's `useResource` would keep its `loaded` value (cached
    // texture) and the panel row would never reappear in the missing
    // list — defeating the "Remove → row reappears" round-trip.
    provider.removeUploadedFile(path);
    loader.provideFile(path);
  }

  return (
    <ResourceLoaderProvider loader={loader}>
      <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
        {paneVisible && (
          <>
            {/* flex-shrink:0 (in .sourcePane) keeps the pane at its set/dragged
                width; the shell wrapper below takes flex:1 to fill the rest. */}
            <div
              data-testid="source-pane"
              className={styles.sourcePane}
              style={{ width: paneWidth, minWidth: 0 }}
            >
              <textarea
                className={styles.sourceTextarea}
                value={content}
                readOnly
                style={{ fontFamily: 'monospace' }}
              />
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
        <div style={{ flex: 1, minWidth: 0, height: '100%' }}>
          <TscnPreviewShell
            panelId={`web-${fixtureFile || uploadedTscnName || 'empty'}`}
            content={content}
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
            onOpenSubScene={handleOpenSubScene}
            toolbar={
              <Toolbar
                options={options}
                fixtureFile={fixtureFile}
                uploadedTscnName={uploadedTscnName}
                loadError={loadError}
                onFixtureChange={handleFixtureChange}
                onTscnUpload={handleTscnUpload}
                onTscnUploadError={handleTscnUploadError}
                paneVisible={paneVisible}
                onTogglePane={() => setPaneVisible((v) => !v)}
              />
            }
          />
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
  onTscnUpload: (file: File, text: string) => void;
  onTscnUploadError: (message: string) => void;
  paneVisible: boolean;
  onTogglePane: () => void;
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
 * distinct from "open a scene" so a picked file always maps to a known target.
 */
function Toolbar({
  options,
  fixtureFile,
  uploadedTscnName,
  loadError,
  onFixtureChange,
  onTscnUpload,
  onTscnUploadError,
  paneVisible,
  onTogglePane,
}: ToolbarProps) {
  // Reset Camera lives in the shared <ViewportToolbar> in the shell top bar.
  const tscnInputRef = useRef<HTMLInputElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

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
    const file = e.target.files?.[0];
    if (!file) return;
    file
      .text()
      .then((text) => onTscnUpload(file, text))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        onTscnUploadError(`Failed to read TSCN file: ${message}`);
      });
    // Reset so the same filename can be re-opened.
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
        title="Toggle the source pane"
      >
        {paneVisible ? 'Hide' : 'Show'} Source
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
        accept=".tscn"
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
