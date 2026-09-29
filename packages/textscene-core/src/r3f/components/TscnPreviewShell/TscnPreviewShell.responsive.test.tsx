/**
 * The narrow layout (ADR-0042), pinned at the CSS source, since happy-dom computes no
 * `@media` style and `matchMedia` answers `false`. A narrow, tall panel stacks the viewport
 * over a bottom sheet that shows the tree or the details, and a compact panel scrolls its
 * top bar.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: () => <div data-testid="canvas-stub" />,
  TscnSceneContents: () => null,
}));

import { TscnPreviewShell } from './TscnPreviewShell';
import { COMPACT_LAYOUT_QUERY, NARROW_LAYOUT_QUERY } from './narrowLayout';

const MINIMAL_TSCN = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

const CSS_SOURCE = readFileSync(path.join(import.meta.dirname, 'TscnPreviewShell.module.css'), 'utf8');
const SPLITTER_CSS_SOURCE = readFileSync(
  path.join(import.meta.dirname, '../Splitter/Splitter.module.css'),
  'utf8'
);
const LANDSCAPE_PHONE_QUERY = '(max-height: 500px) and (pointer: coarse)';

function narrowBlock(): string {
  const block = extractMediaBlock(CSS_SOURCE, NARROW_LAYOUT_QUERY);
  expect(block).not.toBeNull();
  return block!;
}

function compactBlock(): string {
  const block = extractMediaBlock(CSS_SOURCE, COMPACT_LAYOUT_QUERY);
  expect(block).not.toBeNull();
  return block!;
}

function dockElement(container: HTMLElement): HTMLElement {
  const dock = container.querySelector<HTMLElement>('section[aria-label="Scene and Inspector"]');
  expect(dock).toBeTruthy();
  return dock!;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('<TscnPreviewShell> narrow layout: the stylesheet', () => {
  it('keys every width-bounded @media block on the queries narrowLayout.ts exports', () => {
    const widthQueries = mediaQueries(CSS_SOURCE).filter((q) => q.includes('width'));
    expect(widthQueries.sort()).toEqual([COMPACT_LAYOUT_QUERY, NARROW_LAYOUT_QUERY].sort());
    expect(mediaQueries(SPLITTER_CSS_SOURCE).filter((q) => q.includes('width'))).toEqual([
      NARROW_LAYOUT_QUERY,
    ]);
  });

  it('switches .columns to a vertical stack inside the narrow block', () => {
    expect(narrowBlock()).toMatch(/\.columns\s*\{[^}]*flex-direction:\s*column/);
  });

  it('hides the column splitter inside the same narrow block', () => {
    const block = extractMediaBlock(SPLITTER_CSS_SOURCE, NARROW_LAYOUT_QUERY);
    expect(block).toMatch(/\.splitter\s*\{[^}]*display:\s*none/);
  });

  it('gives the sheet a definite, draggable share of the stack', () => {
    const block = narrowBlock();
    expect(block).not.toMatch(/\.dock\s*\{[^}]*display:\s*none/);
    expect(block).toMatch(/\.dock\s*\{[^}]*width:\s*100%/);
    // Definite, not content-measured: `auto` resolves to 8px here.
    expect(block).toMatch(/\.dock\s*\{[^}]*flex-basis:\s*var\(--tsi-sheet-basis,\s*\d+(\.\d+)?%\)/);
    expect(block).not.toMatch(/\.dock\s*\{[^}]*flex-basis:\s*auto/);
  });

  it('shows one half of the dock at a time, chosen by data-narrow-pane', () => {
    const block = narrowBlock();
    const hidden = /([^{}]*)\{\s*display:\s*none;?\s*\}/.exec(block);
    expect(hidden).not.toBeNull();
    const selectors = hidden![1];
    expect(selectors).toContain(".dock[data-narrow-pane='tree'] .detailPane");
    expect(selectors).toContain(".dock[data-narrow-pane='details'] .masterPane");
    expect(selectors).toContain('.masterDetailHandle');
    // The shown pane takes the whole sheet, not its desktop share of it.
    expect(block).toMatch(/\.masterPane,\s*\.detailPane\s*\{[^}]*flex-grow:\s*1;/);
  });

  it('shows the narrow-only parts inside the narrow block and nowhere else', () => {
    expect(stripMediaBlocks(CSS_SOURCE)).toMatch(/\.narrowOnly\s*\{\s*display:\s*none;?\s*\}/);
    const block = narrowBlock();
    expect(block).toMatch(/\.sheetHandle\s*\{[^}]*display:\s*block/);
    expect(block).toMatch(/\.narrowSwitcher\s*\{[^}]*display:\s*flex/);
    // Outside a media block the parts own no `display`, so `.narrowOnly` hides them.
    const desktop = stripMediaBlocks(CSS_SOURCE);
    expect(desktop).not.toMatch(/\.sheetHandle\s*\{/);
    expect(desktop).not.toMatch(/\.narrowSwitcher\s*\{/);
  });

  it('lays the collapsed sheet out as a horizontal bar inside the narrow block', () => {
    const block = narrowBlock();
    expect(block).toMatch(/\.collapsedDock\s*\{[^}]*flex-direction:\s*row/);
    expect(block).toMatch(/\.collapsedTitle\s*\{[^}]*writing-mode:\s*horizontal-tb/);
  });

  it('keeps the sheet out of a short panel, which keeps the side dock', () => {
    expect(NARROW_LAYOUT_QUERY).toContain('(min-height: 501px)');
    const landscape = extractMediaBlock(CSS_SOURCE, LANDSCAPE_PHONE_QUERY);
    expect(landscape).toMatch(/\.dock\s*\{[^}]*max-width:\s*\d+%/);
  });

  it('scrolls the host toolbar instead of clipping it in the compact block', () => {
    const block = compactBlock();
    expect(block).toMatch(/\.topToolbar\s*\{[^}]*overflow-x:\s*auto/);
    expect(block).toMatch(/\.brand,\s*\.statChips,\s*\.topSpacer\s*\{[^}]*display:\s*none/);
  });

  it('preserves the side-by-side desktop layout outside the media queries', () => {
    const desktop = stripMediaBlocks(CSS_SOURCE);
    expect(desktop).toMatch(/\.columns\s*\{[^}]*display:\s*flex/);
    expect(desktop).toMatch(/\.dock\s*\{[^}]*flex-direction:\s*column/);
    expect(desktop).toMatch(/\.topBar\s*\{[^}]*height:\s*var\(--tsi-top-bar-height\)/);
    expect(CSS_SOURCE).toMatch(/--tsi-top-bar-height:\s*2\.75rem/);
  });

  it('owns the dock basis in the stylesheet, reading the resizer as a custom property', () => {
    // An inline `flex-basis` from the resizer would outrank every selector, so
    // the narrow block could only ever win it back with `!important`.
    expect(stripMediaBlocks(CSS_SOURCE)).toMatch(/\.dock\s*\{[^}]*flex-basis:\s*var\(--tsi-dock-basis/);
    expect(CSS_SOURCE).not.toMatch(/!important/);
  });

  it('reads the tree share as a custom property, so the narrow block can override it', () => {
    expect(stripMediaBlocks(CSS_SOURCE)).toMatch(
      /\.masterPane,\s*\.detailPane\s*\{[^}]*flex-grow:\s*var\(--tsi-pane-grow/
    );
  });
});

describe('<TscnPreviewShell> narrow layout: the markup', () => {
  it('hands the resizer width and the sheet share to the stylesheet as custom properties', () => {
    const { container } = render(<TscnPreviewShell panelId="p-basis" content={MINIMAL_TSCN} />);
    const dock = dockElement(container);
    expect(dock.style.getPropertyValue('--tsi-dock-basis')).toBe('320px');
    expect(dock.style.getPropertyValue('--tsi-sheet-basis')).toBe('45%');
    expect(dock.style.flexBasis).toBe('');
  });

  it('sets the panes’ share as a custom property, never as an inline flex-grow', () => {
    const { container } = render(<TscnPreviewShell panelId="p-grow" content={MINIMAL_TSCN} />);
    const dock = dockElement(container);
    const panes = Array.from(dock.children).filter((el) =>
      (el as HTMLElement).style.getPropertyValue('--tsi-pane-grow')
    ) as HTMLElement[];
    expect(panes.map((el) => el.style.getPropertyValue('--tsi-pane-grow'))).toEqual(['0.46', '0.54']);
    for (const pane of panes) expect(pane.style.flexGrow).toBe('');
  });

  it('shows the tree half first', () => {
    const { container } = render(<TscnPreviewShell panelId="p-first" content={MINIMAL_TSCN} />);
    expect(dockElement(container).dataset.narrowPane).toBe('tree');
    expect(screen.getByRole('tab', { name: 'Scene' }).getAttribute('aria-selected')).toBe('true');
  });

  it('switches to the details half on a tap of Details', () => {
    const { container } = render(<TscnPreviewShell panelId="p-switch" content={MINIMAL_TSCN} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Details' }));
    expect(dockElement(container).dataset.narrowPane).toBe('details');
    expect(screen.getByRole('tab', { name: 'Details' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Scene' }).getAttribute('aria-selected')).toBe('false');
  });

  it('remembers the chosen half across a remount', () => {
    vi.useFakeTimers();
    const first = render(<TscnPreviewShell panelId="p-remember" content={MINIMAL_TSCN} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Details' }));
    act(() => {
      vi.runAllTimers();
    });
    first.unmount();
    const { container } = render(<TscnPreviewShell panelId="p-remember" content={MINIMAL_TSCN} />);
    expect(dockElement(container).dataset.narrowPane).toBe('details');
  });

  it('falls back to the default sheet share for a stored one out of range', () => {
    localStorage.setItem('tsi.sheetShare', JSON.stringify(5));
    const { container } = render(<TscnPreviewShell panelId="p-share" content={MINIMAL_TSCN} />);
    expect(dockElement(container).style.getPropertyValue('--tsi-sheet-basis')).toBe('45%');
  });

  it('falls back to the tree half for a corrupt stored value', () => {
    localStorage.setItem('tsi.narrowPane', JSON.stringify('inspector'));
    const { container } = render(<TscnPreviewShell panelId="p-corrupt" content={MINIMAL_TSCN} />);
    expect(dockElement(container).dataset.narrowPane).toBe('tree');
  });

  it('collapses the sheet from the switcher', () => {
    render(<TscnPreviewShell panelId="p-collapse" content={MINIMAL_TSCN} />);
    fireEvent.click(screen.getByLabelText('Collapse the scene panel'));
    expect(screen.getByLabelText('Show the side panel')).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Scene' })).toBeNull();
  });
});

/** The query text of every `@media` rule in `source`, in order. */
function mediaQueries(source: string): string[] {
  return Array.from(source.matchAll(/@media\s*([^{]+?)\s*\{/g), (m) => m[1]!);
}

/** The body of the `@media <query>` block, or null when there is none. */
function extractMediaBlock(source: string, query: string): string | null {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`@media\\s*${escaped}\\s*\\{`).exec(source);
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
    const start = /@media[^{]*\{/.exec(out);
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
