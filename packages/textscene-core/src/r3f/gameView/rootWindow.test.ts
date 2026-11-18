import { describe, expect, it } from 'vitest';
import type { ProjectSettings } from '../../parser/projectSettingsParser';
import { rootWindow, shrinkRootWindow } from './rootWindow';

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

describe('shrinkRootWindow', () => {
  const stretched = rootWindow(project([800, 800], { mode: 'canvas_items' }));

  it('keeps a window the pane shows at full size or larger', () => {
    expect(shrinkRootWindow(stretched, 1)).toBe(stretched);
    expect(shrinkRootWindow(stretched, 2.5)).toBe(stretched);
  });

  it('renders a smaller target in a smaller pane, laid out in the same 2D override', () => {
    const shrunk = shrinkRootWindow(stretched, 0.5);
    expect([shrunk.targetSize, shrunk.size2dOverride, shrunk.drawRect]).toEqual([
      { x: 400, y: 225 },
      { x: 1152, y: 648 },
      stretched.drawRect,
    ]);
  });

  it('lays a viewport-mode target out at its full size, which had no 2D override', () => {
    const shrunk = shrinkRootWindow(rootWindow(project([800, 800], { mode: 'viewport' })), 0.5);
    expect([shrunk.targetSize, shrunk.size2dOverride]).toEqual([
      { x: 576, y: 324 },
      { x: 1152, y: 648 },
    ]);
  });
});
