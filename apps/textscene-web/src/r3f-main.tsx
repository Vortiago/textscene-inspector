/**
 * R3F entry point for the web app.
 *
 * Mounts `<TscnPreviewShell>` inside `<ResourceLoaderProvider>` so node
 * components can call `useResource()` to load textures and other
 * external resources. Missing-resource uploads are driven by the
 * shell's `<MissingResourcesPanel>` (one row per missing path,
 * per-row file input) instead of a global filename-guessing input
 * (see `docs/UX-REGRESSIONS.md` §3 — WI-UX-3).
 */
import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  FileEventBus,
  ResourceLoader,
  ResourceLoaderProvider,
  TscnPreviewShell,
  ViewportSelector,
  type ViewportSelectorOption,
} from '@textscene/core';
import { fixtures } from './fixtures';
import { WebResourceProvider } from './providers/WebResourceProvider';
import styles from './r3f-main.module.css';

const STORAGE_KEY = 'tscn-web-r3f-fixture';
const DEFAULT_FIXTURE =
  fixtures.find((f) => f.file === 'integration-all-primitives.tscn')?.file ??
  fixtures[0]?.file ??
  '';

function R3FApp() {
  const [fixtureFile, setFixtureFile] = useState<string>(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_FIXTURE;
    } catch {
      return DEFAULT_FIXTURE;
    }
  });
  const [content, setContent] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const options = useMemo<ViewportSelectorOption[]>(
    () =>
      fixtures.map((f) => ({
        value: f.file,
        label: f.name,
        category: f.category,
      })),
    []
  );

  useEffect(() => {
    if (!fixtureFile) {
      setContent('');
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
  }, [fixtureFile]);

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
          panelId={`web-${fixtureFile || 'empty'}`}
          content={content}
          rootScenePath={`res://${fixtureFile || 'empty.tscn'}`}
          onResourceUpload={handleResourceUpload}
          onResourceRemove={handleResourceRemove}
          toolbar={
            <div className={styles.toolbar}>
              <strong className={styles.title}>TextScene Inspector</strong>
              <ViewportSelector
                options={options}
                value={fixtureFile}
                onChange={setFixtureFile}
                label="Scene:"
              />
              {loadError && (
                <span role="alert" className={styles.errorMessage}>
                  {loadError}
                </span>
              )}
            </div>
          }
        />
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
