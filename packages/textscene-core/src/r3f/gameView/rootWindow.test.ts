import { describe, expect, it } from 'vitest';
import type { ProjectSettings } from '../../parser/projectSettingsParser';
import { fittedTargetSize, magnifiesTarget, rootWindow, shrinkRootWindow } from './rootWindow';

/** A project at Godot's default viewport, 1152 x 648, with `stretch` keys under `display/window/stretch/`. */
function project(window: [number, number] | null, stretch: Record<string, string>): ProjectSettings {
  const settings: Record<string, string> = {};
  if (window) {
    settings['display/window/size/window_width_override'] = String(window[0]);
    settings['display/window/size/window_height_override'] = String(window[1]);
  }
  for (const [key, value] of Object.entries(stretch)) settings[`display/window/stretch/${key}`] = value;
  return settings;
}

/** `[window, mode, aspect, scale mode, target, 2D override, rect in the window]` (`window.cpp:1232-1352`). */
const VECTORS: [[number, number] | null, string, string, string, string, string, string][] = [
  [[800, 800], 'disabled', 'keep', 'fractional', '800x800', '800x800', '0,0 800x800'],
  [[800, 800], 'canvas_items', 'keep', 'fractional', '800x450', '1152x648', '0,175 800x450'],
  [[800, 800], 'canvas_items', 'expand', 'fractional', '800x800', '1152x1152', '0,0 800x800'],
  [[800, 800], 'canvas_items', 'ignore', 'fractional', '800x800', '1152x648', '0,0 800x800'],
  [[800, 800], 'viewport', 'keep_height', 'fractional', '1152x648', '0x0', '0,175 800x450'],
  [[1600, 648], 'canvas_items', 'keep_height', 'fractional', '1600x648', '1600x648', '0,0 1600x648'],
  [[1600, 648], 'canvas_items', 'keep', 'fractional', '1152x648', '1152x648', '224,0 1152x648'],
  [[2400, 1400], 'viewport', 'keep', 'integer', '1152x648', '0x0', '48,52 2304x1296'],
  [null, 'canvas_items', 'keep', 'fractional', '1152x648', '1152x648', '0,0 1152x648'],
];

const size = (v: { x: number; y: number }) => `${v.x}x${v.y}`;

describe('rootWindow', () => {
  it.each(VECTORS)(
    '%j %s %s %s: target %s, 2D override %s (0x0 for none), at %s',
    (window, mode, aspect, scaleMode, ...expected) => {
      const root = rootWindow(project(window, { mode, aspect, scale_mode: scaleMode }));
      const { x, y, w, h } = root.drawRect;
      expect([size(root.targetSize), size(root.size2dOverride), `${x},${y} ${w}x${h}`]).toEqual(expected);
    }
  );

  it('opens no smaller than the root minimum of 64 on each axis (`scene_tree.cpp:2043`)', () => {
    expect(rootWindow(project([120, 60], {})).size).toEqual({ x: 120, y: 64 });
    expect(rootWindow(project([10, 10], {})).size).toEqual({ x: 64, y: 64 });
  });

  it('opens at the window override, else at the viewport size', () => {
    expect(rootWindow(project([800, 600], {})).size).toEqual({ x: 800, y: 600 });
    expect(rootWindow(null).size).toEqual({ x: 1152, y: 648 });
  });

  it('floors an integer factor of 2.7 to 2, which halves the 2D override', () => {
    const root = rootWindow(project(null, { mode: 'canvas_items', scale_mode: 'integer', scale: '2.7' }));
    expect(root.size2dOverride).toEqual({ x: 576, y: 324 });
  });

  it('raises an integer factor of 0.6 to 1', () => {
    const root = rootWindow(project(null, { mode: 'canvas_items', scale_mode: 'integer', scale: '0.6' }));
    expect(root.size2dOverride).toEqual({ x: 1152, y: 648 });
  });

  it('lays a 1.5 factor out in two thirds of the base under canvas_items and keep', () => {
    const root = rootWindow(project([800, 800], { mode: 'canvas_items', aspect: 'keep', scale: '1.5' }));
    expect([root.targetSize, root.size2dOverride]).toEqual([
      { x: 800, y: 450 },
      { x: 768, y: 432 },
    ]);
  });
});

describe('fittedTargetSize', () => {
  const stretched = rootWindow(project([800, 800], { mode: 'canvas_items' }));

  it('keeps the target of a window the pane shows at full size or larger', () => {
    expect(fittedTargetSize(stretched, 1)).toBe(stretched.targetSize);
    expect(fittedTargetSize(stretched, 2.5)).toBe(stretched.targetSize);
  });

  it('scales the target of a window the pane shows smaller, to whole pixels', () => {
    expect(fittedTargetSize(stretched, 0.5)).toEqual({ x: 400, y: 225 });
  });

  it('keeps a viewport-mode target the pane still draws larger than its pixels', () => {
    const magnified = rootWindow(project([2400, 1400], { mode: 'viewport', scale_mode: 'integer' }));
    expect(fittedTargetSize(magnified, 0.5)).toBe(magnified.targetSize);
  });

  it('scales a viewport-mode target by the size the pane draws it at', () => {
    const magnified = rootWindow(project([2400, 1400], { mode: 'viewport', scale_mode: 'integer' }));
    expect(fittedTargetSize(magnified, 0.25)).toEqual({ x: 576, y: 324 });
  });

  it('keeps the target a window minifies, as Godot renders it, in a pane that shows the whole window', () => {
    const minified = rootWindow(project(null, { mode: 'viewport', scale: '0.5' }));
    expect(fittedTargetSize(minified, 1)).toBe(minified.targetSize);
  });

  it('scales a target the window minifies by the pane alone', () => {
    const minified = rootWindow(project(null, { mode: 'viewport', scale: '0.5' }));
    expect(fittedTargetSize(minified, 0.5)).toEqual({ x: 1152, y: 648 });
  });

  it('keeps the target of a pane with no pixels', () => {
    expect(fittedTargetSize(stretched, 0)).toBe(stretched.targetSize);
  });
});

describe('shrinkRootWindow', () => {
  const stretched = rootWindow(project([800, 800], { mode: 'canvas_items' }));

  it('keeps the window for its own target size', () => {
    expect(shrinkRootWindow(stretched, { ...stretched.targetSize })).toBe(stretched);
  });

  it('renders a smaller target laid out in the same 2D override', () => {
    const shrunk = shrinkRootWindow(stretched, { x: 400, y: 225 });
    expect([shrunk.targetSize, shrunk.size2dOverride, shrunk.drawRect]).toEqual([
      { x: 400, y: 225 },
      { x: 1152, y: 648 },
      stretched.drawRect,
    ]);
  });

  it('lays a viewport-mode target out at its full size, which had no 2D override', () => {
    const shrunk = shrinkRootWindow(rootWindow(project([800, 800], { mode: 'viewport' })), {
      x: 576,
      y: 324,
    });
    expect([shrunk.targetSize, shrunk.size2dOverride]).toEqual([
      { x: 576, y: 324 },
      { x: 1152, y: 648 },
    ]);
  });
});

describe('magnifiesTarget', () => {
  const magnified = rootWindow(project([2400, 1400], { mode: 'viewport', scale_mode: 'integer' }));

  it('is true where the window draws its full target larger than its pixels', () => {
    expect(magnifiesTarget(magnified, magnified)).toBe(true);
  });

  it('is false for a target the window draws 1:1', () => {
    const canvasItems = rootWindow(project([800, 800], { mode: 'canvas_items' }));
    expect(magnifiesTarget(canvasItems, canvasItems)).toBe(false);
  });

  it('is false for a target shrunk to the size the pane draws it', () => {
    const shrunk = shrinkRootWindow(magnified, fittedTargetSize(magnified, 0.2));
    expect(magnifiesTarget(magnified, shrunk)).toBe(false);
  });
});
