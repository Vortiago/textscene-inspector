/**
 * WI-UX-13 regression: on big fixtures with many missing externals
 * (`example-hallway.tscn` has 9+), the panel must NOT grow unbounded
 * and push the SceneTreeViewer + NodeDetailsPanel out of the sidebar.
 *
 * happy-dom does not run layout, so we can't measure real pixel heights.
 * Two-layer assertion instead:
 *   1. Many rows still render correctly (no regression on the row-per-
 *      path contract from WI-UX-3) — this is a behavior assertion.
 *   2. The panel's CSS rule declares `max-height` + `overflow: auto` +
 *      `flex-shrink: 0` — this is the load-bearing cap that prevents
 *      the BLOCKER. Asserting the source file keeps the test honest
 *      against accidental regression.
 */
import { useEffect } from 'react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  MissingResourcesProvider,
  useMissingResources,
} from '../../contexts/MissingResourcesContext';
import { MissingResourcesPanel } from './MissingResourcesPanel';

const __dirname = dirname(fileURLToPath(import.meta.url));
const panelCss = readFileSync(
  join(__dirname, 'MissingResourcesPanel.module.css'),
  'utf-8'
);

function ReportMissingOnMount({ path }: { path: string }) {
  const { report } = useMissingResources();
  useEffect(() => {
    report(path);
  }, [report, path]);
  return null;
}

describe('<MissingResourcesPanel> scale behavior (WI-UX-13)', () => {
  it('renders all 12 reported paths without truncating any row', async () => {
    const paths = Array.from({ length: 12 }, (_, i) =>
      `res://textures/missing-${String(i).padStart(2, '0')}.png`
    );

    render(
      <MissingResourcesProvider>
        {paths.map((p) => (
          <ReportMissingOnMount key={p} path={p} />
        ))}
        <MissingResourcesPanel onUpload={vi.fn()} onRemove={vi.fn()} />
      </MissingResourcesProvider>
    );

    const panel = await screen.findByTestId('missing-resources-panel');
    const missingRows = panel.querySelectorAll('[data-state="missing"]');
    // All 12 rows exist in the DOM — the cap is visual (overflow + scroll),
    // not behavioural (no row-dropping).
    expect(missingRows).toHaveLength(12);

    const paths_rendered = Array.from(missingRows).map((r) =>
      r.getAttribute('data-path')
    );
    expect(paths_rendered).toEqual(expect.arrayContaining(paths));
  });

  it('panel CSS declares max-height, overflow-y: auto, and flex-shrink: 0', () => {
    // `.panel` is the load-bearing class. Its source declaration must
    // include all three properties so the BLOCKER (panel pushes tree
    // off-screen on `example-hallway.tscn`) cannot regress silently.
    //
    // We assert the source file rather than runtime computed style
    // because happy-dom doesn't compute layout. Reading the .module.css
    // directly gives us a CI-stable assertion that survives CSS
    // Modules hash-mangling of class names.
    const panelRule = extractRule(panelCss, '.panel');
    expect(panelRule).toMatch(/max-height\s*:/);
    expect(panelRule).toMatch(/overflow-y\s*:\s*auto/);
    expect(panelRule).toMatch(/flex-shrink\s*:\s*0/);
  });
});

/**
 * Extract the body of a top-level CSS rule (no nesting traversal —
 * `.panel` is a simple top-level selector in this file).
 */
function extractRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) {
    throw new Error(`Could not find rule for selector "${selector}" in the CSS file.`);
  }
  return match[1] ?? '';
}
