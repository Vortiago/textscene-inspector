/**
 * A sub-viewport is a canvas boundary (ADR-0030): its Control subtree belongs to
 * its own viewport surface, never to the parent overlay.
 *
 * This is a real present-day leak, not a hypothetical. `SubViewport` is
 * unregistered in the Control registry, so it lands on `GenericControlFallback`,
 * which is `display: contents` and renders its children — so the HUD of any
 * scene with an off-screen viewport gains that viewport's contents. Live
 * example: `godot-open-rts`'s `Match.tscn`, whose `MinimapViewport` and
 * fog-of-war `ColorRect`s flow into the on-screen HUD.
 *
 * Godot draws none of it: `Viewport`'s constructor always instantiates its own
 * `World2D`, so `find_world_2d` never walks up to the parent's canvas.
 */

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { TscnNode } from '../../parser/types';
import { ControlOverlay } from './index';

function node(name: string, type: string, properties: object, children: TscnNode[] = []): TscnNode {
  return { name, type, children, properties: { name, ...properties } } as TscnNode;
}

// The Match.tscn shape: a HUD container holding a visible rect and a
// SubViewport whose contents are off-screen render fodder.
const tree: TscnNode[] = [
  node('HUD', 'Control', { anchorsPreset: 15 }, [
    node('OnScreen', 'ColorRect', { color: 'Color(0, 1, 0, 1)' }),
    node('MinimapViewport', 'SubViewport', { size: { x: 100, y: 100 } }, [
      node('OffScreen', 'ColorRect', { color: 'Color(1, 0, 0, 1)' }),
      node('OffScreenLabel', 'Label', { text: 'inside the viewport' }),
    ]),
  ]),
];

describe('ControlDispatcher — sub-viewport boundary', () => {
  it('renders Controls outside the sub-viewport', () => {
    const { container } = render(<ControlOverlay nodes={tree} />);
    expect(container.querySelector('[data-node-name="OnScreen"]')).toBeTruthy();
  });

  it('does NOT render the sub-viewport’s Control subtree into the parent overlay', () => {
    const { container } = render(<ControlOverlay nodes={tree} />);
    expect(container.querySelector('[data-node-name="OffScreen"]')).toBeNull();
    expect(container.querySelector('[data-node-name="OffScreenLabel"]')).toBeNull();
    expect(container.textContent).not.toContain('inside the viewport');
  });

  it('does not leave a passthrough wrapper for the sub-viewport itself', () => {
    const { container } = render(<ControlOverlay nodes={tree} />);
    expect(container.querySelector('[data-control-type="SubViewport"]')).toBeNull();
  });
});
