/**
 * Regression test for narrow-viewport responsive layout.
 *
 * Before this fix, `TscnPreviewShell.module.css` had zero `@media`
 * blocks; the canvas + 320px sidebar always rendered side-by-side, so
 * at phone/tablet widths the sidebar squeezed the canvas to an unusable
 * sliver. The shell stacks them vertically at ≤768px instead.
 *
 * jsdom / happy-dom does not compute styles inside `@media` queries
 * reliably (and `matchMedia` returns a static `false` by default), so
 * asserting computed `flex-direction` would be flaky. Instead we
 * assert the CSS source itself contains the expected media block and
 * declarations — that is the load-bearing property: as long as the
 * `@media (max-width: 768px)` block exists with `flex-direction:
 * column` on `.columns` and a full-width dock holding a definite share
 * of the stack, real browsers will apply it. The CSS module file is
 * shipped to the host (Vite / esbuild) verbatim.
 *
 * Sister test: a render-time smoke check that the shell still mounts
 * its body element so the responsive container exists.
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
    // The dock stays visible (NOT display:none) — it stacks under the viewport.
    expect(mediaBlock!).not.toMatch(/\.dock[^{]*\{[^}]*display:\s*none/);
    expect(mediaBlock!).toMatch(/\.dock[^{]*\{[^}]*width:\s*100%/);
    // A DEFINITE basis, which a `max-height` cap over `flex-basis: auto` is
    // not: measured in a real browser at 700px the dock resolved to 8px,
    // because `auto` measures its `flex-basis: 0` panes while the viewport's
    // flex-grow took the whole column. The cap can only ever shrink a height
    // the dock never had. (ADR-0007: a single right Split Dock, not two
    // columns.)
    expect(mediaBlock!).toMatch(/\.dock[^{]*\{[^}]*flex-basis:\s*45%/);
    expect(mediaBlock!).not.toMatch(/\.dock[^{]*\{[^}]*flex-basis:\s*auto/);
  });

  it('preserves the side-by-side desktop layout outside the media query', () => {
    // The non-media `.columns` rule keeps `display: flex` (row by default)
    // and the dock is a flex column. We assert these exist *outside* the
    // media block so an edit that accidentally moves them inside is caught.
    const desktopBlock = stripMediaBlocks(CSS_SOURCE);
    expect(desktopBlock).toMatch(/\.columns\s*\{[^}]*display:\s*flex/);
    expect(desktopBlock).toMatch(/\.dock[^{]*\{[^}]*flex-direction:\s*column/);
  });

  it('still renders the shell body element so the responsive container exists at runtime', () => {
    const { container } = render(
      <TscnPreviewShell panelId="p-mobile" content={MINIMAL_TSCN} />
    );
    // Module-class hashing means we can't assert the literal `body`
    // class name; we assert the data-panel-id host + that a single
    // direct child carries class names — enough to know the layout
    // tree is built.
    const shellRoot = container.querySelector('[data-panel-id="p-mobile"]');
    expect(shellRoot).toBeTruthy();
    expect(shellRoot!.children.length).toBeGreaterThan(0);
  });
});

/**
 * Pulls the body of the `@media (max-width: <px>px) { ... }` block out
 * of `source`, balancing nested braces. Returns null if no such block
 * exists.
 */
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

/**
 * Removes every `@media (...) { ... }` block from `source` so callers
 * can grep only the desktop-layer rules.
 */
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
