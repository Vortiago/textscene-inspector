/**
 * The narrow layout, pinned at the CSS source, since happy-dom computes no
 * `@media` style and `matchMedia` answers `false`. At ≤768px `.columns` stacks
 * and `.dock` keeps a full-width, definite share of that stack.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: () => <div data-testid="canvas-stub" />,
  TscnSceneContents: () => null,
}));

import { TscnPreviewShell } from './TscnPreviewShell';

const MINIMAL_TSCN = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CSS_FILE = path.join(HERE, 'TscnPreviewShell.module.css');
const CSS_SOURCE = readFileSync(CSS_FILE, 'utf8');

describe('<TscnPreviewShell> mobile responsive layout (WI-UX-9)', () => {
  it('declares an @media block keyed on max-width: 768px', () => {
    expect(CSS_SOURCE).toMatch(/@media\s*\(\s*max-width:\s*768px\s*\)/);
  });

  it('switches .columns to a vertical stack inside the narrow-viewport block', () => {
    const mediaBlock = extractMediaBlock(CSS_SOURCE, 768);
    expect(mediaBlock).not.toBeNull();
    // .columns must drop the row layout for a column inside the media query.
    expect(mediaBlock!).toMatch(/\.columns\s*\{[^}]*flex-direction:\s*column/);
  });

  it('gives the dock a definite share of the stack inside the narrow block', () => {
    const mediaBlock = extractMediaBlock(CSS_SOURCE, 768);
    expect(mediaBlock).not.toBeNull();
    // The dock stays visible and stacks under the viewport.
    expect(mediaBlock!).not.toMatch(/\.dock[^{]*\{[^}]*display:\s*none/);
    expect(mediaBlock!).toMatch(/\.dock[^{]*\{[^}]*width:\s*100%/);
    // Definite, not content-measured: `auto` resolves to 8px here, whatever
    // `max-height` sits beside it. The percentage itself is free to be retuned.
    expect(mediaBlock!).toMatch(/\.dock[^{]*\{[^}]*flex-basis:\s*\d+(\.\d+)?%/);
    expect(mediaBlock!).not.toMatch(/\.dock[^{]*\{[^}]*flex-basis:\s*auto/);
  });

  it('preserves the side-by-side desktop layout outside the media query', () => {
    // Outside the media block, so a move of these rules into it fails.
    const desktopBlock = stripMediaBlocks(CSS_SOURCE);
    expect(desktopBlock).toMatch(/\.columns\s*\{[^}]*display:\s*flex/);
    expect(desktopBlock).toMatch(/\.dock[^{]*\{[^}]*flex-direction:\s*column/);
  });

  it('owns the dock basis in the stylesheet, reading the resizer as a custom property', () => {
    // An inline `flex-basis` from the resizer would outrank every selector, so
    // the narrow block could only ever win it back with `!important`.
    expect(stripMediaBlocks(CSS_SOURCE)).toMatch(
      /\.dock[^{]*\{[^}]*flex-basis:\s*var\(--tsi-dock-basis/
    );
    expect(CSS_SOURCE).not.toMatch(/flex-basis:[^;]*!important/);
  });

  it('still renders the shell body element so the responsive container exists at runtime', () => {
    const { container } = render(
      <TscnPreviewShell panelId="p-mobile" content={MINIMAL_TSCN} />
    );
    // The module hashes the `body` class name, so the test checks for a direct
    // child with a class name under the data-panel-id host.
    const shellRoot = container.querySelector('[data-panel-id="p-mobile"]');
    expect(shellRoot).toBeTruthy();
    expect(shellRoot!.children.length).toBeGreaterThan(0);
  });

  it('hands the resizer width to the stylesheet as a custom property', () => {
    const { container } = render(
      <TscnPreviewShell panelId="p-basis" content={MINIMAL_TSCN} />
    );
    // The other half of the pin above: an inline `flex-basis` here would outrank
    // the narrow block's percentage whatever the stylesheet says.
    const dock = container.querySelector<HTMLElement>('section[aria-label="Scene and Inspector"]');
    expect(dock).toBeTruthy();
    expect(dock!.style.getPropertyValue('--tsi-dock-basis')).toBe('320px');
    expect(dock!.style.flexBasis).toBe('');
  });
});

/** The body of the `@media (max-width: <px>px)` block, or null when there is none. */
function extractMediaBlock(source: string, px: number): string | null {
  const re = new RegExp(`@media\\s*\\(\\s*max-width:\\s*${px}px\\s*\\)\\s*\\{`);
  const match = re.exec(source);
  if (!match) return null;

  let depth = 1;
  let i = match.index + match[0].length;
  const start = i;
  while (i < source.length && depth > 0) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    i += 1;
  }
  if (depth !== 0) return null;
  return source.slice(start, i - 1);
}

/** `source` without its `@media` blocks: the desktop-layer rules only. */
function stripMediaBlocks(source: string): string {
  let out = source;
  for (;;) {
    const start = /@media\s*\([^)]*\)\s*\{/.exec(out);
    if (!start) break;
    let depth = 1;
    let i = start.index + start[0].length;
    while (i < out.length && depth > 0) {
      const ch = out[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      i += 1;
    }
    out = out.slice(0, start.index) + out.slice(i);
  }
  return out;
}
