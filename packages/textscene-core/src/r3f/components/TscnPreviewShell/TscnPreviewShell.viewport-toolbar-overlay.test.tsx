/**
 * Regression test for #300: the viewport controls used to live in the shell's
 * top bar, sharing a fixed-height flex row with the host file toolbar. When the
 * web app opens its Source pane the shell narrows to ~956px, the row
 * over-constrains, the host toolbar collapses to width 0, and its content
 * overflows rightward — painting over and stealing pointer events from the
 * "Reset Camera" button (a `<path>` from the top-bar subtree became the topmost
 * element at the button's center, so clicks never reached it).
 *
 * The fix relocates <ViewportToolbar> out of the header and into the viewport
 * (`.center`, already `position: relative`) as an absolutely-positioned overlay,
 * so the controls never share the header row at any width and can't be buried.
 * The visual golden harness screenshots only the `<canvas>` element, so floating
 * DOM chrome over the viewport does not churn baselines.
 *
 * happy-dom has no layout engine and hashes CSS-module class names, so we assert
 * (a) the DOM structure via stable semantic selectors — the viewport toolbar is
 * inside the viewport `<main>` and NOT inside the `<header>` — and (b) the
 * load-bearing CSS declarations directly from the module source, which Vite
 * ships to the host verbatim.
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
const CSS_SOURCE = readFileSync(path.join(HERE, 'TscnPreviewShell.module.css'), 'utf8');

describe('<TscnPreviewShell> viewport controls live over the viewport, not the top bar (#300)', () => {
  it('renders the viewport toolbar inside the viewport <main>, not the <header>', () => {
    const { container } = render(
      <TscnPreviewShell panelId="p-300" content={MINIMAL_TSCN} />
    );
    const header = container.querySelector('header');
    const viewport = container.querySelector('main[aria-label="Viewport"]');
    const toolbar = container.querySelector('[role="toolbar"][aria-label="Viewport controls"]');

    expect(header).toBeTruthy();
    expect(viewport).toBeTruthy();
    expect(toolbar).toBeTruthy();
    // The bug: the toolbar shared the header row and got buried. It must now
    // sit in the viewport, out of the over-constrained top bar entirely.
    expect(header!.contains(toolbar)).toBe(false);
    expect(viewport!.contains(toolbar)).toBe(true);
  });

  it('marks the overlay with the stable hook the visual harness hides during capture', () => {
    const { container } = render(
      <TscnPreviewShell panelId="p-300-hook" content={MINIMAL_TSCN} />
    );
    // scripts/visual/run.mjs hides [data-testid="viewport-toolbar-overlay"] so
    // the floating toolbar doesn't composite into canvas.screenshot(); the
    // overlay must be that element's wrapper (which carries the panel chrome),
    // not the inner toolbar. Removing the hook silently re-churns every golden.
    const overlay = container.querySelector('[data-testid="viewport-toolbar-overlay"]');
    const toolbar = container.querySelector('[role="toolbar"][aria-label="Viewport controls"]');
    expect(overlay).toBeTruthy();
    expect(overlay!.contains(toolbar)).toBe(true);
  });

  it('anchors the viewport-toolbar overlay absolutely so it floats clear of the row', () => {
    // The rule is a flat block (no nested braces), so `[^}]*` reaches its
    // closing brace — the idiom the sibling responsive test uses. Absolute + a
    // corner anchor + a stacking context above the canvas is what keeps the
    // controls reachable regardless of viewport width.
    expect(CSS_SOURCE).toMatch(/\.viewportToolbarOverlay\s*\{[^}]*position:\s*absolute/);
    expect(CSS_SOURCE).toMatch(/\.viewportToolbarOverlay\s*\{[^}]*right:/);
    expect(CSS_SOURCE).toMatch(/\.viewportToolbarOverlay\s*\{[^}]*z-index:/);
  });
});
