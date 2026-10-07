/**
 * Where a DirectionalLight2D's shadow is measured from: the light's own +Y axis
 * (`renderer_viewport.cpp:564`, "Y is light direction"), the game viewport it renders into, and
 * the editor camera the quad is drawn through.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { sameDirectionalShadowView, sampleDirectionalShadowView } from './directionalShadowView';
import type { Quad2 } from './directionalShadowMap';

/** A light node's CanvasItem group at the previewer origin, with the light's Godot `rotation`. */
function lightAnchor(godotRotation = 0): THREE.Object3D {
  const root = new THREE.Group();
  const item = new THREE.Group();
  // The previewer conjugates the 2D tree by diag(1, -1), which negates a rotation.
  item.rotation.z = -godotRotation;
  root.add(item);
  root.updateMatrixWorld(true);
  return item;
}

/** Godot's default project viewport. */
const VIEWPORT = { width: 1152, height: 648 };

/** A 1000 × 1000 world-unit view of x 0..1000, y -500..500. */
function camera(zoom = 1): THREE.OrthographicCamera {
  const cam = new THREE.OrthographicCamera(-500, 500, 500, -500, 0.1, 100);
  cam.position.set(500, 0, 10);
  cam.zoom = zoom;
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  return cam;
}

function rounded(quad: Quad2): number[][] {
  return quad.map(({ x, y }) => [Math.round(x), Math.round(y)]);
}

describe('sampleDirectionalShadowView', () => {
  it('sends an unrotated light down the screen, Godot +Y', () => {
    const view = sampleDirectionalShadowView(lightAnchor(), camera(), VIEWPORT, 0);
    expect(view.direction.x).toBeCloseTo(0, 12);
    expect(view.direction.y).toBeCloseTo(-1, 12);
  });

  it('turns the light with its rotation, clockwise on screen for a positive one', () => {
    // Godot 4.6.3 at rotation 0.5 shadows down and to the left of the occluder.
    const view = sampleDirectionalShadowView(lightAnchor(0.5), camera(), VIEWPORT, 0);
    expect(view.direction.x).toBeCloseTo(-Math.sin(0.5), 12);
    expect(view.direction.y).toBeCloseTo(-Math.cos(0.5), 12);
  });

  it('takes the corners of what the camera shows, in NDC order', () => {
    const { screen } = sampleDirectionalShadowView(lightAnchor(), camera(), VIEWPORT, 0);
    expect(rounded(screen)).toEqual([
      [0, -500],
      [1000, -500],
      [1000, 500],
      [0, 500],
    ]);
  });

  it('clips to the project viewport at the canvas origin, whatever the camera shows', () => {
    // Godot's Y-down rect (0, 0, 1152, 648) in the Y-up world.
    const { clip } = sampleDirectionalShadowView(lightAnchor(), camera(2), VIEWPORT, 0);
    expect(rounded(clip)).toEqual([
      [0, -648],
      [1152, -648],
      [1152, 0],
      [0, 0],
    ]);
  });

  it('keeps max_distance in canvas pixels as the editor camera zooms', () => {
    expect(sampleDirectionalShadowView(lightAnchor(), camera(2), VIEWPORT, 100).maxDistance).toBe(100);
  });
});

describe('sameDirectionalShadowView', () => {
  it('agrees on two samples of a still light', () => {
    const a = sampleDirectionalShadowView(lightAnchor(0.5), camera(), VIEWPORT, 100);
    const b = sampleDirectionalShadowView(lightAnchor(0.5), camera(), VIEWPORT, 100);
    expect(sameDirectionalShadowView(a, b)).toBe(true);
  });

  it('tells a turned light, a moved camera and a new max_distance apart', () => {
    const base = sampleDirectionalShadowView(lightAnchor(), camera(), VIEWPORT, 100);
    expect(
      sameDirectionalShadowView(base, sampleDirectionalShadowView(lightAnchor(0.1), camera(), VIEWPORT, 100))
    ).toBe(false);
    expect(
      sameDirectionalShadowView(base, sampleDirectionalShadowView(lightAnchor(), camera(2), VIEWPORT, 100))
    ).toBe(false);
    expect(
      sameDirectionalShadowView(base, sampleDirectionalShadowView(lightAnchor(), camera(), VIEWPORT, 50))
    ).toBe(false);
  });

  it('treats null as a view of its own', () => {
    const view = sampleDirectionalShadowView(lightAnchor(), camera(), VIEWPORT, 0);
    expect(sameDirectionalShadowView(null, null)).toBe(true);
    expect(sameDirectionalShadowView(view, null)).toBe(false);
  });
});
