/**
 * R3F entry point for the web app.
 *
 * Mounts `<TscnPreviewShell>` inside `<ResourceLoaderProvider>` so node
 * components can call `useResource()` to load textures and other
 * external resources. The user uploads missing files via a small file
 * input in the toolbar; the handler hands the bytes to
 * `WebResourceProvider.addUploadedFile()` and then calls
 * `loader.provideFile(path)` so any meshes still rendering the magenta
 * placeholder transition to the loaded texture (WI-R3F-7 / WEB-05).
 */
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
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

const STORAGE_KEY = 'tscn-web-r3f-fixture';
const DEFAULT_FIXTURE =
  fixtures.find((f) => f.file === 'integration-all-primitives.tscn')?.file ??
  fixtures[0]?.file ??
  '';

interface UploadEntry {
  /** Godot res:// path the file maps to. Inferred from the filename. */
  resPath: string;
  /** Original filename for display. */
  fileName: string;
}

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
  const [uploadedFiles, setUploadedFiles] = useState<UploadEntry[]>([]);

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

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      // Map any uploaded file to `res://textures/<filename>` if it looks
      // like an image, otherwise just `res://<filename>`. This matches
      // the convention used by every MVS fixture in `scenes/fixtures/`.
      const isImage = /\.(png|jpe?g|webp|svg|bmp|tga)$/i.test(file.name);
      const resPath = isImage
        ? `res://textures/${file.name}`
        : `res://${file.name}`;
      provider.addUploadedFile(resPath, file);
      loader.provideFile(resPath);
      setUploadedFiles((prev) => {
        if (prev.some((u) => u.resPath === resPath)) return prev;
        return [...prev, { resPath, fileName: file.name }];
      });
    }
    // Reset the input so the same filename can be re-uploaded.
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  return (
    <ResourceLoaderProvider loader={loader}>
      <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <TscnPreviewShell
          panelId={`web-${fixtureFile || 'empty'}`}
          content={content}
          rootScenePath={`res://${fixtureFile || 'empty.tscn'}`}
          toolbar={
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.5rem 0.75rem',
                borderBottom: '1px solid #3e3e42',
                background: '#252526',
                flexWrap: 'wrap',
              }}
            >
              <strong style={{ color: '#fff' }}>TextScene Inspector</strong>
              <ViewportSelector
                options={options}
                value={fixtureFile}
                onChange={setFixtureFile}
                label="Scene:"
              />
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  color: '#ddd',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '0.875rem' }}>Upload missing files:</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ color: '#ddd' }}
                  data-testid="missing-file-upload"
                />
              </label>
              {uploadedFiles.length > 0 && (
                <span
                  style={{ fontSize: '0.75rem', color: '#9c9' }}
                  aria-label="Uploaded files"
                >
                  Uploaded:{' '}
                  {uploadedFiles.map((u) => u.fileName).join(', ')}
                </span>
              )}
              {loadError && (
                <span role="alert" style={{ color: '#f66' }}>
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
