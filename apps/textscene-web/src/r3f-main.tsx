/**
 * R3F entry point for the web app. Mounted when `?r3f=1` is present in
 * the URL. Mounts `<TscnPreviewShell>` with a fixture-selector toolbar
 * so users can switch scenes the same way they could in the imperative
 * UI.
 *
 * The fixture content is fetched via `fetch('/fixtures/...tscn')` on
 * change. The shell re-parses on each new content string and the canvas
 * stays mounted, so OrbitControls camera state is preserved across the
 * fixture swap (matching the imperative path's behaviour).
 */
import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  TscnPreviewShell,
  ViewportSelector,
  type ViewportSelectorOption,
} from '@textscene/core';
import { fixtures } from './fixtures';

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
          // Ignore; storage is best-effort
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

  return (
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
            }}
          >
            <strong style={{ color: '#fff' }}>TextScene Inspector</strong>
            <ViewportSelector
              options={options}
              value={fixtureFile}
              onChange={setFixtureFile}
              label="Scene:"
            />
            {loadError && (
              <span role="alert" style={{ color: '#f66' }}>
                {loadError}
              </span>
            )}
          </div>
        }
      />
    </div>
  );
}

export function mountR3F(container: HTMLElement): void {
  // Reset the container so the imperative HTML scaffolding doesn't
  // interfere with the React-controlled tree.
  container.innerHTML = '';
  container.style.display = 'block';
  container.style.width = '100vw';
  container.style.height = '100vh';

  const root = createRoot(container);
  root.render(<R3FApp />);
}
