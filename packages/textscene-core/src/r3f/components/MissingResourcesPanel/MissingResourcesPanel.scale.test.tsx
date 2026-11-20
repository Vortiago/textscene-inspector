/**
 * With many missing files the panel must not grow and push the scene tree
 * and the details panel out of the sidebar. happy-dom runs no layout, so
 * the tests check that every row renders and that the CSS rule caps the height.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { waitFor } from '@testing-library/react';
import { filesOf, mountPanel, sceneReading } from './MissingResourcesPanel.testkit';
import { escapeRegExp } from '@textscene/dev-kit';

const __dirname = dirname(fileURLToPath(import.meta.url));
const panelCss = readFileSync(join(__dirname, 'MissingResourcesPanel.module.css'), 'utf-8');

describe('<MissingResourcesPanel> scale behavior (WI-UX-13)', () => {
  it('renders all 12 missing files without truncating any row', async () => {
    const paths = Array.from(
      { length: 12 },
      (_, i) => `res://textures/missing-${String(i).padStart(2, '0')}.png`
    );

    const { panel } = await mountPanel(sceneReading(paths), filesOf({}));
    // The cap scrolls the rows. It drops none.
    await waitFor(() => expect(panel.querySelectorAll('[data-state="missing"]')).toHaveLength(12));
    const missingRows = panel.querySelectorAll('[data-state="missing"]');

    const paths_rendered = Array.from(missingRows).map((r) => r.getAttribute('data-path'));
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
  const escaped = escapeRegExp(selector);
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) {
    throw new Error(`Could not find rule for selector "${selector}" in the CSS file.`);
  }
  return match[1] ?? '';
}
