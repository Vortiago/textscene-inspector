/**
 * R3F entry point for the web app.
 *
 * Mounts `<TscnPreviewShell>` inside `<ResourceLoaderProvider>` so node
 * components can call `useResource()` to load textures and other
 * external resources. Missing-resource uploads are driven by the
 * shell's `<MissingResourcesPanel>` (one row per missing path,
 * per-row file input) instead of a global filename-guessing input
 * (see `docs/UX-REGRESSIONS.md` §3 — WI-UX-3). The toolbar carries
 * three top-level app-shell entry points: scene-fixture dropdown,
 * "Upload TSCN File" for user-supplied .tscn content, and
 * "Reset Camera" to frame the orbit controls back to default
 * (WI-UX-7).
 */
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { createRoot } from 'react-dom/client';
import {
  FileEventBus,
  ResourceLoader,
  ResourceLoaderProvider,
  TscnPreviewShell,
  ViewportSelector,
  useCameraControl,
  useHierarchy,
  type ViewportSelectorOption,
} from '@textscene/core';
import { fixtures } from './fixtures';
import { WebResourceProvider } from './providers/WebResourceProvider';
import styles from './r3f-main.module.css';

/** Sentinel value used by `<ViewportSelector>` when no fixture is active (user is on an uploaded .tscn). */
const NO_FIXTURE = '';

const STORAGE_KEY = 'tscn-web-r3f-fixture';
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
  const [fixtureFile, setFixtureFile] = useState<string>(() => {
    try {
      // Deep-link: `?fixture=<file>` opens directly on a specific scene
      // (used by the showcase recorder to skip the default-fixture detour,
      // and handy for sharing a link to a particular scene).
      const param = new URLSearchParams(window.location.search).get('fixture');
      if (param && fixtures.some((f) => f.file === param)) return param;
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
  const { provider, loader } = useMemo(() => {
    const provider = new WebResourceProvider();
    const bus = new FileEventBus(provider);
    const loader = new ResourceLoader(bus);
    loader.setProvider(provider);
    return { provider, loader };
  }, []);

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
      <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <TscnPreviewShell
          panelId={`web-${fixtureFile || uploadedTscnName || 'empty'}`}
          content={content}
          rootScenePath={`res://${
            fixtureFile || uploadedTscnName || 'empty.tscn'
          }`}
          onResourceUpload={handleResourceUpload}
          onResourceRemove={handleResourceRemove}
          toolbar={
            <Toolbar
              options={options}
              fixtureFile={fixtureFile}
              uploadedTscnName={uploadedTscnName}
              loadError={loadError}
              onFixtureChange={handleFixtureChange}
              onTscnUpload={handleTscnUpload}
              onTscnUploadError={handleTscnUploadError}
            />
          }
        />
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
}

/**
 * Toolbar rendered inside `<TscnPreviewShell>` so it has access to the
 * shell's `CameraControlContext` (for the Reset Camera button).
 * Three top-level controls: scene-fixture dropdown, upload .tscn,
 * reset camera. Mirrors main's controls panel
 * (`git show main:apps/textscene-web/index.html:30-40`).
 */
function Toolbar({
  options,
  fixtureFile,
  uploadedTscnName,
  loadError,
  onFixtureChange,
  onTscnUpload,
  onTscnUploadError,
}: ToolbarProps) {
  const { resetCamera } = useCameraControl();
  // WI-UX-7c: gate Reset Camera on the parsed sceneGraph, not raw
  // `content.length`. On malformed fixtures (e.g. `edge-malformed-bracket.tscn`)
  // `content` is non-empty but the parser fails, leaving `sceneGraph === null`.
  // Matching the same null-check the SceneInfoCard uses keeps the UX
  // affordances consistent — both hide when there's no usable scene.
  const { sceneGraph } = useHierarchy();
  const sceneLoaded = sceneGraph !== null;
  const tscnInputRef = useRef<HTMLInputElement | null>(null);

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
    // Reset the input so the same filename can be re-uploaded.
    if (tscnInputRef.current) {
      tscnInputRef.current.value = '';
    }
  }

  return (
    <div className={styles.toolbar}>
      <strong className={styles.title}>TextScene Inspector</strong>
      <ViewportSelector
        options={options}
        value={fixtureFile}
        onChange={onFixtureChange}
        label="Scene:"
      />
      <label className={styles.tscnUploadGroup}>
        <span className={styles.tscnUploadLabel}>Upload TSCN:</span>
        <input
          ref={tscnInputRef}
          type="file"
          accept=".tscn"
          onChange={handleTscnFileChange}
          className={styles.tscnUploadInput}
          data-testid="upload-tscn-input"
        />
      </label>
      {uploadedTscnName && (
        <span
          className={styles.uploadedTscnLabel}
          data-testid="uploaded-tscn-label"
          title={uploadedTscnName}
        >
          {uploadedTscnName}
        </span>
      )}
      <button
        type="button"
        className={styles.resetCameraButton}
        onClick={resetCamera}
        disabled={!sceneLoaded}
        data-testid="reset-camera-button"
      >
        Reset Camera
      </button>
      {loadError && (
        <span role="alert" className={styles.errorMessage}>
          {loadError}
        </span>
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
