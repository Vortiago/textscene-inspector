/**
 * An embedded window's content scale (`window.cpp:1232-1370`), checked against the measured
 * `unit-window-content-scale` capture: six 240x160 windows, one setting each.
 */
import { describe, expect, it } from 'vitest';
import { ContentScaleAspect, ContentScaleMode, ContentScaleStretch } from '../../../godot/scene/window';
import { windowContentScale, type ContentScale } from './contentScale';

const WINDOW = { x: 240, y: 160 };
const UNSCALED: ContentScale = {
  mode: ContentScaleMode.DISABLED,
  aspect: ContentScaleAspect.IGNORE,
  stretch: ContentScaleStretch.FRACTIONAL,
  size: { x: 0, y: 0 },
  factor: 1,
};
const DESIGN = { x: 120, y: 60 };

describe('windowContentScale', () => {
  it('leaves an unscaled window as it is', () => {
    expect(windowContentScale(WINDOW, UNSCALED)).toEqual({
      renderSize: WINDOW,
      layoutSize: WINDOW,
      canvasScale: 1,
      drawRect: { x: 0, y: 0, w: 240, h: 160 },
    });
  });

  it('lays out a factor-2 window in half its size and draws its canvas twice as large', () => {
    expect(windowContentScale(WINDOW, { ...UNSCALED, factor: 2 })).toEqual({
      renderSize: WINDOW,
      layoutSize: { x: 120, y: 80 },
      canvasScale: 2,
      drawRect: { x: 0, y: 0, w: 240, h: 160 },
    });
  });

  it('keeps the aspect in canvas-items mode with bars, and draws the canvas unscaled (`window.cpp:1330-1336,1366`)', () => {
    const scale = {
      ...UNSCALED,
      mode: ContentScaleMode.CANVAS_ITEMS,
      aspect: ContentScaleAspect.KEEP,
      size: DESIGN,
    };
    expect(windowContentScale(WINDOW, scale)).toEqual({
      renderSize: { x: 240, y: 120 },
      layoutSize: DESIGN,
      canvasScale: 1,
      drawRect: { x: 0, y: 20, w: 240, h: 120 },
    });
  });

  it('renders the design size in viewport mode and stretches the target over the screen rect (`:1337-1347`)', () => {
    const scale = {
      ...UNSCALED,
      mode: ContentScaleMode.VIEWPORT,
      aspect: ContentScaleAspect.KEEP,
      size: DESIGN,
    };
    expect(windowContentScale(WINDOW, scale)).toEqual({
      renderSize: DESIGN,
      layoutSize: DESIGN,
      canvasScale: 1,
      drawRect: { x: 0, y: 20, w: 240, h: 120 },
    });
  });

  it('expands the design size to the window aspect with no bars (`:1286-1290`)', () => {
    const scale = {
      ...UNSCALED,
      mode: ContentScaleMode.CANVAS_ITEMS,
      aspect: ContentScaleAspect.EXPAND,
      size: DESIGN,
    };
    expect(windowContentScale(WINDOW, scale)).toEqual({
      renderSize: WINDOW,
      layoutSize: { x: 120, y: 80 },
      canvasScale: 1,
      drawRect: { x: 0, y: 0, w: 240, h: 160 },
    });
  });

  it('snaps an integer stretch to a whole multiple of the design size (`:1303-1312`)', () => {
    const scale = {
      ...UNSCALED,
      mode: ContentScaleMode.CANVAS_ITEMS,
      aspect: ContentScaleAspect.KEEP,
      stretch: ContentScaleStretch.INTEGER,
      size: { x: 100, y: 60 },
    };
    expect(windowContentScale(WINDOW, scale)).toEqual({
      renderSize: { x: 200, y: 120 },
      layoutSize: { x: 100, y: 60 },
      canvasScale: 1,
      drawRect: { x: 20, y: 20, w: 200, h: 120 },
    });
  });

  it('divides a viewport-mode target by the factor and still scales its canvas by it', () => {
    const scale = {
      ...UNSCALED,
      mode: ContentScaleMode.VIEWPORT,
      aspect: ContentScaleAspect.KEEP_HEIGHT,
      size: DESIGN,
      factor: 1.5,
    };
    expect(windowContentScale(WINDOW, scale)).toEqual({
      renderSize: { x: 80, y: 40 },
      layoutSize: { x: 80, y: 40 },
      canvasScale: 1.5,
      drawRect: { x: 0, y: 20, w: 240, h: 120 },
    });
  });

  it('floors the factor of an integer stretch, and never below 1 (`:1240-1249`)', () => {
    const scale = { ...UNSCALED, stretch: ContentScaleStretch.INTEGER, factor: 0.5 };
    expect(windowContentScale(WINDOW, scale).canvasScale).toBe(1);
  });

  it('shows nothing for a mode outside the enum, so the bars fill the window', () => {
    const scale = windowContentScale(WINDOW, { ...UNSCALED, mode: 3, size: DESIGN });
    expect(scale.renderSize).toEqual({ x: 0, y: 0 });
    expect(scale.drawRect).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});
