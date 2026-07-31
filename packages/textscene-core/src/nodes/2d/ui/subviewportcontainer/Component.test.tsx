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

import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import type { TscnNode } from '../../../../parser/types';
import { ControlOverlay } from '../../../../r3f/controls/index';
import {
  ViewportTextureProvider,
  useRegisterViewportTexture,
  type ViewportTextureEntry,
} from '../../../../r3f/contexts/ViewportTextureContext';
import {
  ViewportRectProvider,
  useViewportRect,
  type ViewportRect,
} from '../../../../r3f/contexts/ViewportRectContext';

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

  describe('forced rect publishing', () => {
    it('a ResizeObserver pass with an unchanged measurement does not re-render rect consumers', () => {
      // happy-dom has no ResizeObserver; a stub exposes the resize callback so
      // the test can drive layout passes by hand.
      const resizeCallbacks: (() => void)[] = [];
      class ResizeObserverStub {
        constructor(callback: () => void) {
          resizeCallbacks.push(callback);
        }
        observe() {}
        disconnect() {}
      }
      (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
      try {
        let probeRenders = 0;
        let seenRect: ViewportRect | null = null;
        function Probe() {
          probeRenders += 1;
          seenRect = useViewportRect('Booth/View');
          return null;
        }
        render(
          <ViewportRectProvider>
            <ControlOverlay nodes={tree({ stretch: true })} />
            <Probe />
          </ViewportRectProvider>
        );
        // happy-dom reports offsetWidth/Height 0, floored to the 1×1 minimum.
        expect(seenRect).toEqual({ x: 1, y: 1 });
        const rendersAfterMount = probeRenders;

        act(() => {
          for (const callback of resizeCallbacks) callback();
          for (const callback of resizeCallbacks) callback();
        });

        expect(seenRect).toEqual({ x: 1, y: 1 });
        expect(probeRenders).toBe(rendersAfterMount);
      } finally {
        delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
      }
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

  /**
   * The pixel arm: 2D-world and 3D content reach the surface as a target
   * snapshot rather than as DOM. happy-dom has no rasteriser, so these pin the
   * WIRING — that a target produces a canvas of the right size, in the right
   * stacking position, painted with the right bytes at the right origin.
   * Whether the result looks like Godot's render is `verify:2d`'s job.
   */
  describe('the pixel arm', () => {
    /** A checkerboard-free ramp: every row distinct, so a flip cannot hide. */
    function rows(width: number, height: number): ImageData {
      const data = new Uint8ClampedArray(width * height * 4);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          data[i] = y;
          data[i + 1] = 55;
          data[i + 2] = 19;
          data[i + 3] = 255;
        }
      }
      return new ImageData(data, width, height);
    }

    /** Publishes `entry` at `path`, then renders the overlay underneath it. */
    function Publisher({
      path,
      entry,
      children,
    }: {
      path: string;
      entry: ViewportTextureEntry;
      children: ReactNode;
    }) {
      const register = useRegisterViewportTexture();
      useEffect(() => register(path, entry), [register, path, entry]);
      return <>{children}</>;
    }

    function mount(entry: ViewportTextureEntry | null, nodes = tree({})) {
      return render(
        <ViewportTextureProvider>
          {entry ? (
            <Publisher path="Booth/View" entry={entry}>
              <ControlOverlay nodes={nodes} />
            </Publisher>
          ) : (
            <ControlOverlay nodes={nodes} />
          )}
        </ViewportTextureProvider>
      );
    }

    function fakeEntry(readPixels: () => ImageData | null): ViewportTextureEntry {
      return {
        texture: {} as ViewportTextureEntry['texture'],
        size: { x: 200, y: 150 },
        readPixels,
      };
    }

    /** Captures `putImageData` for the duration of one test. */
    function captureContext() {
      const calls: { image: ImageData; x: number; y: number }[] = [];
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function getContext() {
        return {
          putImageData: (image: ImageData, x: number, y: number) => calls.push({ image, x, y }),
        };
      } as typeof original;
      return { calls, restore: () => (HTMLCanvasElement.prototype.getContext = original) };
    }

    afterEach(() => cleanup());

    it('publishes no canvas at all when the sub-viewport published no target', () => {
      const { container } = mount(null);
      expect(surfaces(container)[0].querySelector('[data-viewport-pixels]')).toBeNull();
    });

    it('sizes the canvas to the TARGET, which is what the pixels are', () => {
      const { container } = mount(fakeEntry(() => null));
      const canvas = surfaces(container)[0].querySelector<HTMLCanvasElement>(
        '[data-viewport-pixels]'
      );
      expect(canvas).toBeTruthy();
      expect(canvas?.getAttribute('width')).toBe('200');
      expect(canvas?.getAttribute('height')).toBe('150');
    });

    /**
     * Godot composites a viewport's Controls into the same target as its
     * CanvasItems, Controls last (tree order). The previewer splits them across
     * two technologies, so the stacking has to be reproduced by DOM order.
     */
    it('stacks the canvas UNDER the Control arm', () => {
      const { container } = mount(fakeEntry(() => null));
      const surface = surfaces(container)[0];
      const canvas = surface.querySelector('[data-viewport-pixels]');
      const inner = surface.querySelector('[data-node-name="Inner"]');
      expect(canvas && inner && canvas.compareDocumentPosition(inner)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      );
    });

    it('paints nothing while the target has not rendered — null is not empty', async () => {
      const capture = captureContext();
      try {
        mount(fakeEntry(() => null));
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 60));
        });
        expect(capture.calls).toHaveLength(0);
      } finally {
        capture.restore();
      }
    });

    /**
     * The orientation contract, stated where it is consumed: the row flip
     * belongs to `targetPixelsToImageData` (GL's framebuffer origin is
     * bottom-left, `ImageData` is top-down), so the blit must NOT flip again —
     * it draws the snapshot at the origin, row 0 to row 0. Two flips are the
     * identity, which is exactly why nothing else would catch a second one.
     */
    it('draws the snapshot at the origin, row for row, with no second flip', async () => {
      const capture = captureContext();
      try {
        const snapshot = rows(4, 3);
        mount(fakeEntry(() => snapshot));
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 60));
        });
        expect(capture.calls.length).toBeGreaterThan(0);
        const { image, x, y } = capture.calls[0];
        expect([x, y]).toEqual([0, 0]);
        // Row r of the snapshot is still row r — the red channel carried the
        // row index in, and the encode is monotonic so the order survives it.
        const red = (row: number) => image.data[row * 4 * 4];
        expect(red(0)).toBeLessThan(red(1));
        expect(red(1)).toBeLessThan(red(2));
        // …and the encode did run: 55 → 128, 19 → 77 on every pixel.
        expect(image.data[1]).toBe(128);
        expect(image.data[2]).toBe(77);
      } finally {
        capture.restore();
      }
    });
  });
});
