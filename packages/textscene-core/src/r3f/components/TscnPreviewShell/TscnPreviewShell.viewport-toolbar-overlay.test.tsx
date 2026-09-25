/**
 * <ViewportToolbar> floats over the viewport, not in the header row, where a
 * narrow shell lets the host toolbar overflow and steal its clicks. happy-dom
 * has no layout, so the tests check that the toolbar sits in `<main>`, not
 * `<header>`, and read the CSS source.
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

describe('<TscnPreviewShell> viewport controls live over the viewport, not the top bar', () => {
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
    expect(header!.contains(toolbar)).toBe(false);
    expect(viewport!.contains(toolbar)).toBe(true);
  });

  it('marks the overlay with the stable hook the visual harness hides during capture', () => {
    const { container } = render(
      <TscnPreviewShell panelId="p-300-hook" content={MINIMAL_TSCN} />
    );
    // scripts/visual/run.mjs hides [data-testid="viewport-toolbar-overlay"] from
    // canvas.screenshot(), so it must be the wrapper with the panel chrome, not
    // the inner toolbar. Without the hook every golden changes.
    const overlay = container.querySelector('[data-testid="viewport-toolbar-overlay"]');
    const toolbar = container.querySelector('[role="toolbar"][aria-label="Viewport controls"]');
    expect(overlay).toBeTruthy();
    expect(overlay!.contains(toolbar)).toBe(true);
  });

  it('anchors the viewport-toolbar overlay absolutely so it floats clear of the row', () => {
    // The rule has no nested braces, so `[^}]*` reaches its end. Absolute position,
    // a corner anchor and a stacking context above the canvas keep the controls
    // reachable at any width.
    expect(CSS_SOURCE).toMatch(/\.viewportToolbarOverlay\s*\{[^}]*position:\s*absolute/);
    expect(CSS_SOURCE).toMatch(/\.viewportToolbarOverlay\s*\{[^}]*right:/);
    expect(CSS_SOURCE).toMatch(/\.viewportToolbarOverlay\s*\{[^}]*z-index:/);
  });
});
