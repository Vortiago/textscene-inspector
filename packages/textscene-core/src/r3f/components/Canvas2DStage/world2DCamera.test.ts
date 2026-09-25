/**
 * The camera places canvas pixel p at the overlay frame's screen = pan + p·zoom.
 * Under R3F's ortho frustum, screen.x = sw/2 + (wx − camX)·zoom and
 * screen.y = sh/2 − (wy − camY)·zoom, with world = (p.x, −p.y).
 */
import { describe, it, expect } from 'vitest';
import { world2DCameraPose } from './world2DCamera';

function screenOf(
  p: { x: number; y: number },
  cam: { x: number; y: number; zoom: number },
  sw: number,
  sh: number
) {
  return {
    x: sw / 2 + (p.x - cam.x) * cam.zoom,
    y: sh / 2 - (-p.y - cam.y) * cam.zoom,
  };
}

describe('world2DCameraPose', () => {
  it('aligns the world origin with the overlay frame origin (screen = pan)', () => {
    const cam = world2DCameraPose({ x: 120, y: 80 }, 1.5, 900, 600);
    expect(cam.zoom).toBe(1.5);
    const s = screenOf({ x: 0, y: 0 }, cam, 900, 600);
    expect(s.x).toBeCloseTo(120, 6);
    expect(s.y).toBeCloseTo(80, 6);
  });

  it('aligns an arbitrary canvas pixel under zoom and pan', () => {
    const cam = world2DCameraPose({ x: -50, y: 200 }, 0.5, 1280, 720);
    const s = screenOf({ x: 1152, y: 648 }, cam, 1280, 720);
    expect(s.x).toBeCloseTo(-50 + 1152 * 0.5, 6);
    expect(s.y).toBeCloseTo(200 + 648 * 0.5, 6);
  });
});
