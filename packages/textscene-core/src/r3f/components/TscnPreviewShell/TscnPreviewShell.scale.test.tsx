/**
 * WI-UX-13 regression: the sidebar's `overflow` mode must be `auto`
 * (not `hidden`) so that if any sidebar child overflows the available
 * height — beyond the per-component caps each one declares — the user
 * can still scroll the sidebar to reach the tree + details below.
 *
 * Like `MissingResourcesPanel.scale.test.tsx`, happy-dom does not run
 * layout, so we assert the source CSS rule directly: this is the
 * load-bearing defense-in-depth rule that prevents the BLOCKER
 * (`example-hallway.tscn` panel pushes tree off-screen — 286-node
 * fixture, 9+ missing externals).
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

describe('TscnPreviewShell sidebar overflow (WI-UX-13)', () => {
  it('declares overflow: auto on .sidebar (defense in depth against future unbounded children)', () => {
    const sidebarRule = extractRule(shellCss, '.sidebar');
    expect(sidebarRule).toMatch(/overflow\s*:\s*auto/);
    // Negative assertion: the previous `overflow: hidden` was what
    // caused the BLOCKER on `example-hallway.tscn` — children pushed
    // out of the sidebar's clipping region were unreachable.
    expect(sidebarRule).not.toMatch(/overflow\s*:\s*hidden/);
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
