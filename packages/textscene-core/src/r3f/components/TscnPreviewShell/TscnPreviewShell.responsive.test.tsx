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

import { extractMediaBlock, mediaQueries, stripMediaBlocks } from '../../testing/cssSource';
import { TscnPreviewShell } from './TscnPreviewShell';
import { COMPACT_LAYOUT_QUERY, NARROW_LAYOUT_QUERY } from './narrowLayout';
import styles from './TscnPreviewShell.module.css';

const MINIMAL_TSCN = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

const CSS_SOURCE = readFileSync(path.join(import.meta.dirname, 'TscnPreviewShell.module.css'), 'utf8');
const SPLITTER_CSS_SOURCE = readFileSync(
  path.join(import.meta.dirname, '../Splitter/Splitter.module.css'),
  'utf8'
);
const LANDSCAPE_PHONE_QUERY = '(max-height: 500px) and (pointer: coarse)';

/** The shell stylesheet's `@media <query>` block, which must exist. */
function block(query: string): string {
  const body = extractMediaBlock(CSS_SOURCE, query);
  expect(body, `an @media ${query} block`).not.toBeNull();
  return body!;
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
  });

  it('switches .columns to a vertical stack inside the narrow block', () => {
    expect(block(NARROW_LAYOUT_QUERY)).toMatch(/\.columns\s*\{[^}]*flex-direction:\s*column/);
  });

  it('leaves the splitter free of any layout query, since the shell hides it', () => {
    expect(mediaQueries(SPLITTER_CSS_SOURCE).filter((q) => q.includes('width'))).toEqual([]);
  });

  it('gives the sheet a definite, draggable share of the stack', () => {
    const narrow = block(NARROW_LAYOUT_QUERY);
    expect(narrow).not.toMatch(/\.dock\s*\{[^}]*display:\s*none/);
    expect(narrow).toMatch(/\.dock\s*\{[^}]*width:\s*100%/);
    // Definite, not content-measured: `auto` resolves to 8px here.
    expect(narrow).toMatch(/\.dock\s*\{[^}]*flex-basis:\s*var\(--tsi-sheet-basis,\s*\d+(\.\d+)?%\)/);
    expect(narrow).not.toMatch(/\.dock\s*\{[^}]*flex-basis:\s*auto/);
  });

  it('shows one half of the dock at a time, chosen by data-narrow-pane', () => {
    const narrow = block(NARROW_LAYOUT_QUERY);
    const hidden = /([^{}]*)\{\s*display:\s*none;?\s*\}/.exec(narrow);
    expect(hidden).not.toBeNull();
    const selectors = hidden![1];
    expect(selectors).toContain(".dock[data-narrow-pane='tree'] .detailPane");
    expect(selectors).toContain(".dock[data-narrow-pane='details'] .masterPane");
    expect(selectors).toContain('.masterDetailHandle');
    expect(selectors).toContain('.wideOnly');
    // The shown pane takes the whole sheet, not its desktop share of it.
    expect(narrow).toMatch(/\.masterPane,\s*\.detailPane\s*\{[^}]*flex-grow:\s*1;/);
  });

  it('shows the narrow-only parts inside the narrow block and nowhere else', () => {
    expect(stripMediaBlocks(CSS_SOURCE)).toMatch(/\.narrowOnly\s*\{\s*display:\s*none;?\s*\}/);
    const narrow = block(NARROW_LAYOUT_QUERY);
    expect(narrow).toMatch(/\.sheetHandle\s*\{[^}]*display:\s*block/);
    expect(narrow).toMatch(/\.narrowSwitcher\s*\{[^}]*display:\s*flex/);
    // Outside a media block no rule gives the parts a `display`, so `.narrowOnly` hides them.
    const desktop = stripMediaBlocks(CSS_SOURCE);
    expect(desktop).not.toMatch(/\.sheetHandle[^{]*\{[^}]*display:/);
    expect(desktop).not.toMatch(/\.narrowSwitcher[^{]*\{[^}]*display:/);
  });

  it('lays the collapsed sheet out as a horizontal bar inside the narrow block', () => {
    const narrow = block(NARROW_LAYOUT_QUERY);
    expect(narrow).toMatch(/\.collapsedDock\s*\{[^}]*flex-direction:\s*row/);
    expect(narrow).toMatch(/\.collapsedTitle\s*\{[^}]*writing-mode:\s*horizontal-tb/);
  });

  it('keeps the sheet out of a short panel, which keeps the side dock', () => {
    expect(NARROW_LAYOUT_QUERY).toContain('(min-height: 501px)');
    const landscape = extractMediaBlock(CSS_SOURCE, LANDSCAPE_PHONE_QUERY);
    expect(landscape).toMatch(/\.dock\s*\{[^}]*max-width:\s*\d+%/);
  });

  it('scrolls the host toolbar instead of clipping it in the compact block', () => {
    const compact = block(COMPACT_LAYOUT_QUERY);
    expect(compact).toMatch(/\.topToolbar\s*\{[^}]*overflow-x:\s*auto/);
    expect(compact).toMatch(/\.brand,\s*\.statChips,\s*\.topSpacer\s*\{[^}]*display:\s*none/);
  });

  it('keeps the help link right-aligned in the compact block, toolbar or none', () => {
    expect(block(COMPACT_LAYOUT_QUERY)).toMatch(/\.helpLink\s*\{[^}]*margin-left:\s*auto/);
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

  it('marks the desktop-only controls wide-only, so the narrow block hides them', () => {
    render(<TscnPreviewShell panelId="p-wide" content={MINIMAL_TSCN} />);
    const splitter = screen.getByRole('separator', { name: 'Resize the side panel' });
    expect(splitter.className.split(' ')).toContain(styles.wideOnly);
    const treeCollapse = screen.getByLabelText('Collapse the side panel');
    expect(treeCollapse.className.split(' ')).toContain(styles.wideOnly);
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
