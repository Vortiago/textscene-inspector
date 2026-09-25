/**
 * `.dockBody` uses `overflow: auto`, not `hidden`, so a child that overflows
 * its cap cannot push the tree and details out of reach. happy-dom runs no
 * layout, so the test reads the CSS source.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const shellCss = readFileSync(
  join(__dirname, 'TscnPreviewShell.module.css'),
  'utf-8'
);

describe('TscnPreviewShell dock overflow (WI-UX-13)', () => {
  it('declares overflow: auto on .dockBody (defense in depth against future unbounded children)', () => {
    const dockBodyRule = extractRule(shellCss, '.dockBody');
    expect(dockBodyRule).toMatch(/overflow\s*:\s*auto/);
    // `overflow: hidden` clips children out of reach.
    expect(dockBodyRule).not.toMatch(/overflow\s*:\s*hidden/);
  });
});

function extractRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) {
    throw new Error(`Could not find rule for selector "${selector}" in the CSS file.`);
  }
  return match[1] ?? '';
}
