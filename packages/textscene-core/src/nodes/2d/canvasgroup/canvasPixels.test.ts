import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { canvasPixelRect, clipPixelRect, worldBoxOfCanvasPixels } from './canvasPixels';
import type { CanvasClip } from '../../../r3f/lighting2d/lightPassHost';

/** The root canvas: 1152x648 pixels at the origin, y up in the world. */
const ROOT: CanvasClip = { rect: { x: 0, y: -648, w: 1152, h: 648 }, scale: { x: 1, y: 1 } };
/** A Camera2D at zoom 2 looking at (100, -50) in a 200x100 viewport. */
const ZOOMED: CanvasClip = { rect: { x: 50, y: -75, w: 100, h: 50 }, scale: { x: 2, y: 2 } };

const box = (minX: number, minY: number, maxX: number, maxY: number) =>
  new THREE.Box3(new THREE.Vector3(minX, minY, 0), new THREE.Vector3(maxX, maxY, 0));

describe('canvasPixelRect', () => {
  it('flips the world y into canvas pixels, top-left first', () => {
    expect(canvasPixelRect(box(0, -100, 100, 0), ROOT)).toEqual({ x: 0, y: 0, w: 100, h: 100 });
  });

  it('measures from the clip corner, at the canvas scale', () => {
    expect(canvasPixelRect(box(50, -35, 60, -25), ZOOMED)).toEqual({ x: 0, y: 0, w: 20, h: 20 });
  });
});

describe('worldBoxOfCanvasPixels', () => {
  it('maps a canvas pixel rect back to the world box it came from', () => {
    const world = box(50, -60, 60, -50);
    expect(worldBoxOfCanvasPixels(canvasPixelRect(world, ZOOMED), ZOOMED)).toEqual(world);
  });
});

describe('clipPixelRect', () => {
  it('is Rect2(0, 0, size) in canvas pixels', () => {
    expect(clipPixelRect(ZOOMED)).toEqual({ x: 0, y: 0, w: 200, h: 100 });
  });
});
