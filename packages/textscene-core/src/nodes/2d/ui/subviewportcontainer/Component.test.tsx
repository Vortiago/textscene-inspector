/**
 * SubViewportContainer renders a **viewport surface** per the measured Godot
 * parity table (ADR-0030). Everything asserted here was verified against Godot
 * 4.6.3 with a 300x200 container at (100, 80) holding a 200x150 sub-viewport,
 * and cross-checked against `subviewport_container.cpp`.
 *
 * happy-dom has no layout, so these assert the INLINE styles and DOM structure
 * that produce the layout, never measured geometry (AGENTS.md). Whether it
 * actually looks right is `verify:2d`'s job (ADR-0024).
 */

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { TscnNode } from '../../../../parser/types';
import { ControlOverlay } from '../../../../r3f/controls/index';

function node(name: string, type: string, properties: object, children: TscnNode[] = []): TscnNode {
  return { name, type, children, properties: { name, ...properties } } as TscnNode;
}

/** A container holding one sub-viewport with a Control inside it. */
function tree(containerProps: object, viewportProps: object = {}): TscnNode[] {
  return [
    node('Booth', 'SubViewportContainer', containerProps, [
      node(
        'View',
        'SubViewport',
        { size: { x: 200, y: 150 }, transparent_bg: false, ...viewportProps },
        [node('Inner', 'ColorRect', { color: 'Color(1, 0.6, 0, 1)' })]
      ),
    ]),
  ];
}

function surfaces(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-viewport-surface]'));
}

describe('<SubViewportContainer>', () => {
  it('renders the container itself', () => {
    const { container } = render(<ControlOverlay nodes={tree({})} />);
    expect(
      container.querySelector('[data-control-type="SubViewportContainer"]')
    ).toBeTruthy();
  });

  describe('surface sizing (the measured parity table)', () => {
    it('stretch = false: the surface takes the SUB-VIEWPORT’s size, not the container’s', () => {
      const { container } = render(<ControlOverlay nodes={tree({ stretch: false })} />);
      const surface = surfaces(container)[0];
      expect(surface).toBeTruthy();
      expect(surface.style.width).toBe('200px');
      expect(surface.style.height).toBe('150px');
    });

    it('stretch = true: the surface fills the container’s own rect instead', () => {
      const { container } = render(<ControlOverlay nodes={tree({ stretch: true })} />);
      const surface = surfaces(container)[0];
      expect(surface.style.width).toBe('100%');
      expect(surface.style.height).toBe('100%');
    });

    it('stretch_shrink divides the content rect and scales it back up', () => {
      const { container } = render(
        <ControlOverlay nodes={tree({ stretch: true, stretch_shrink: 2 })} />
      );
      const surface = surfaces(container)[0];
      // Content is laid out against rect/shrink, then scaled by shrink —
      // `recalc_force_viewport_sizes` does `set_size_force(get_size() / shrink)`.
      expect(surface.style.transform).toContain('scale(2)');
      expect(surface.style.transformOrigin).toBe('top left');
    });

    it('ignores stretch_shrink when stretch is off — Godot returns early', () => {
      const { container } = render(
        <ControlOverlay nodes={tree({ stretch: false, stretch_shrink: 2 })} />
      );
      const surface = surfaces(container)[0];
      expect(surface.style.transform).not.toContain('scale');
      expect(surface.style.width).toBe('200px');
    });
  });

  describe('clipping and clear colour', () => {
    it('clips on the SURFACE, because the target is only `size` pixels', () => {
      const { container } = render(<ControlOverlay nodes={tree({})} />);
      expect(surfaces(container)[0].style.overflow).toBe('hidden');
    });

    it('does NOT clip on the container — Godot Controls clip only with clip_contents', () => {
      const { container } = render(<ControlOverlay nodes={tree({})} />);
      const el = container.querySelector(
        '[data-control-type="SubViewportContainer"]'
      ) as HTMLElement;
      expect(el.style.overflow).not.toBe('hidden');
    });

    it('paints an opaque clear colour by default', () => {
      const { container } = render(<ControlOverlay nodes={tree({})} />);
      expect(surfaces(container)[0].style.backgroundColor).toBeTruthy();
    });

    it('paints no clear colour when the sub-viewport is transparent_bg', () => {
      const { container } = render(
        <ControlOverlay nodes={tree({}, { transparent_bg: true })} />
      );
      expect(surfaces(container)[0].style.backgroundColor).toBe('');
    });
  });

  describe('children', () => {
    it('renders the sub-viewport’s Control subtree INSIDE the surface', () => {
      const { container } = render(<ControlOverlay nodes={tree({})} />);
      const inner = container.querySelector('[data-node-name="Inner"]');
      expect(inner).toBeTruthy();
      expect(surfaces(container)[0].contains(inner)).toBe(true);
    });

    it('surfaces EVERY SubViewport child, stacked in tree order', () => {
      // `NOTIFICATION_DRAW` loops all SubViewport children and draws each.
      const two: TscnNode[] = [
        node('Booth', 'SubViewportContainer', {}, [
          node('A', 'SubViewport', { size: { x: 100, y: 80 } }, []),
          node('B', 'SubViewport', { size: { x: 60, y: 40 } }, []),
        ]),
      ];
      const { container } = render(<ControlOverlay nodes={two} />);
      const found = surfaces(container);
      expect(found).toHaveLength(2);
      expect(found[0].style.width).toBe('100px');
      expect(found[1].style.width).toBe('60px');
    });

    it('still renders non-SubViewport children normally', () => {
      const mixed: TscnNode[] = [
        node('Booth', 'SubViewportContainer', {}, [
          node('View', 'SubViewport', { size: { x: 100, y: 80 } }, []),
          node('Badge', 'ColorRect', { color: 'Color(0, 1, 0, 1)' }),
        ]),
      ];
      const { container } = render(<ControlOverlay nodes={mixed} />);
      const badge = container.querySelector('[data-node-name="Badge"]');
      expect(badge).toBeTruthy();
      expect(surfaces(container)[0].contains(badge)).toBe(false);
    });

    it('renders an empty surface when the container has no SubViewport child', () => {
      const none: TscnNode[] = [node('Booth', 'SubViewportContainer', {}, [])];
      const { container } = render(<ControlOverlay nodes={none} />);
      expect(
        container.querySelector('[data-control-type="SubViewportContainer"]')
      ).toBeTruthy();
      expect(surfaces(container)).toHaveLength(0);
    });
  });
});
