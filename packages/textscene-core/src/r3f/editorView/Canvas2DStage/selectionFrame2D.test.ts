import { describe, expect, it } from 'vitest';
import { transform2DFromParts } from '../../../godot/math/transform2d';
import { centerSelection, frameSelection, selectionRect } from './selectionFrame2D';

const STAGE = { width: 800, height: 600 };
const clampZoom = (zoom: number) => Math.max(0.1, Math.min(4, zoom));

describe('selectionRect', () => {
  it('puts a node with no edit rect at its origin', () => {
    const at = transform2DFromParts(0, { x: 1, y: 1 }, 0, { x: 120, y: 40 });
    expect(selectionRect(at, null)).toEqual({ x: 120, y: 40, w: 0, h: 0 });
  });

  it('scales the edit rect by the global scale from the origin', () => {
    const at = transform2DFromParts(0, { x: 2, y: 3 }, 0, { x: 100, y: 100 });
    expect(selectionRect(at, { x: -16, y: -16, w: 32, h: 32 })).toEqual({ x: 68, y: 52, w: 64, h: 96 });
  });

  it('turns the edit rect by the global rotation before it scales it', () => {
    const at = transform2DFromParts(Math.PI / 2, { x: 1, y: 1 }, 0, { x: 0, y: 0 });
    const rect = selectionRect(at, { x: 0, y: 0, w: 40, h: 10 });
    expect(rect.x).toBeCloseTo(-10, 4);
    expect(rect.y).toBeCloseTo(0, 4);
    expect(rect.w).toBeCloseTo(10, 4);
    expect(rect.h).toBeCloseTo(40, 4);
  });
});

describe('centerSelection', () => {
  it('puts the point at the stage centre, in whole canvas pixels', () => {
    const view = centerSelection({ pan: { x: 0, y: 0 }, zoom: 2 }, { x: 100.3, y: 50, w: 0, h: 0 }, STAGE);
    expect(view.zoom).toBe(2);
    // offset (400 - 200.6, 300 - 100) / 2 rounds to (100, 100).
    expect(view.pan).toEqual({ x: 200, y: 200 });
  });

  it('keeps the view of a point already at the centre', () => {
    const view = centerSelection({ pan: { x: 300, y: 250 }, zoom: 1 }, { x: 90, y: 40, w: 20, h: 20 }, STAGE);
    expect(view.pan).toEqual({ x: 300, y: 250 });
  });
});

describe('frameSelection', () => {
  it('fits the rect at 90 % of the tighter side and centres it', () => {
    const view = frameSelection(
      { pan: { x: 0, y: 0 }, zoom: 1 },
      { x: 0, y: 0, w: 400, h: 100 },
      STAGE,
      clampZoom
    );
    expect(view.zoom).toBeCloseTo(1.8, 6);
  });

  it('only centres a rect with no area', () => {
    const view = frameSelection(
      { pan: { x: 0, y: 0 }, zoom: 1.5 },
      { x: 10, y: 20, w: 0, h: 0 },
      STAGE,
      clampZoom
    );
    expect(view.zoom).toBe(1.5);
  });

  it('holds the zoom to the stage range', () => {
    const view = frameSelection(
      { pan: { x: 0, y: 0 }, zoom: 1 },
      { x: 0, y: 0, w: 2, h: 2 },
      STAGE,
      clampZoom
    );
    expect(view.zoom).toBe(4);
  });
});
