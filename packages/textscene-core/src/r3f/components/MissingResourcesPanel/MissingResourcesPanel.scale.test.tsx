/**
 * With many missing files the panel must not grow and push the scene tree
 * and the details panel out of the sidebar. happy-dom runs no layout, so
 * the tests check that every row renders and that the CSS rule caps the height.
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
    // The cap scrolls the rows. It drops none.
    expect(missingRows).toHaveLength(12);

    const paths_rendered = Array.from(missingRows).map((r) =>
      r.getAttribute('data-path')
    );
    expect(paths_rendered).toEqual(expect.arrayContaining(paths));
  });

  it('panel CSS declares max-height, overflow-y: auto, and flex-shrink: 0', () => {
    // The source, not the computed style: happy-dom computes no layout, and the
    // source survives the CSS Modules hash on class names.
    const panelRule = extractRule(panelCss, '.panel');
    expect(panelRule).toMatch(/max-height\s*:/);
    expect(panelRule).toMatch(/overflow-y\s*:\s*auto/);
    expect(panelRule).toMatch(/flex-shrink\s*:\s*0/);
  });
});

/** The body of a top-level CSS rule. It does not walk nested rules. */
function extractRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) {
    throw new Error(`Could not find rule for selector "${selector}" in the CSS file.`);
  }
  return match[1] ?? '';
}
