/**
 * Where a light kept apart sits for a normal-mapped item: in the canvas's world frame, which is
 * Godot's y-down canvas flipped to y up, so the light vector an item computes there is Godot's
 * flipped the same way, and its dot with the flipped normal is Godot's.
 */

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { degToRad } from '../../godot/math/math';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  canvasFrameScale,
  placeDirectionalLight,
  placePositionalLight,
  usePlaceApartLight,
} from './apartLight';
import { CanvasFrameContext } from '../canvasFrame';
import {
  CanvasLighting2DContext,
  INERT_CANVAS_LIGHTING,
  type ApartLight,
  type LightPassStep,
} from './lightPassContext';

function apartLight(): ApartLight {
  return { place: new THREE.Vector3(), mode: new THREE.Vector2() };
}

/** A light node at Godot's `position` and `rotation`, as the canvas's world frame holds it. */
function origin(x: number, y: number, rotationDegrees = 0): THREE.Object3D {
  const node = new THREE.Object3D();
  node.position.set(x, -y, 0);
  node.rotation.z = -degToRad(rotationDegrees);
  return node;
}

describe('placePositionalLight', () => {
  it("writes the light's position and its height, and marks it positional", () => {
    const light = apartLight();
    placePositionalLight(light, origin(576, 324), 50, false);
    expect(light.place.toArray()).toEqual([576, -324, 50]);
    expect(light.mode.toArray()).toEqual([0, 0]);
  });

  it('reads the position through its parents', () => {
    const light = apartLight();
    const parent = origin(100, 0);
    const node = origin(20, 10);
    parent.add(node);
    placePositionalLight(light, node, 0, false);
    expect(light.place.toArray()).toEqual([120, -10, 0]);
  });

  it('marks a MIX light', () => {
    const light = apartLight();
    placePositionalLight(light, origin(0, 0), 0, true);
    expect(light.mode.y).toBe(1);
  });
});

describe('placeDirectionalLight', () => {
  it('points up the canvas toward an unrotated light, which shines down', () => {
    // `renderer_canvas_render_rd.cpp:542-545`: the direction is minus the light's y axis.
    const light = apartLight();
    placeDirectionalLight(light, origin(300, 300), 0.5, false);
    expect(light.place.toArray()).toEqual([0, 1, 0.5]);
    expect(light.mode.toArray()).toEqual([1, 0]);
  });

  it('turns with the light, and ignores its scale', () => {
    // A light turned 90 degrees clockwise on Godot's canvas shines left, so it sits to the right.
    const light = apartLight();
    const node = origin(0, 0, 90);
    node.scale.set(3, 3, 1);
    placeDirectionalLight(light, node, 1, true);
    expect(light.place.x).toBeCloseTo(1);
    expect(light.place.y).toBeCloseTo(0);
    expect(light.mode.toArray()).toEqual([1, 1]);
  });
});

describe('canvasFrameScale', () => {
  it('is 1 on the root canvas, whose frame is the world', () => {
    expect(canvasFrameScale(null)).toBe(1);
  });

  it("is the mean length of the frame's two axes through its parents", () => {
    // `renderer_canvas_render_rd.cpp:612`: the mean of the canvas transform's column lengths.
    const anchor = new THREE.Object3D();
    anchor.scale.set(2, 2, 1);
    const frame = new THREE.Object3D();
    frame.scale.set(1, 2, 1);
    frame.rotation.z = 0.7;
    anchor.add(frame);
    expect(canvasFrameScale(frame)).toBeCloseTo(3);
  });
});

describe('usePlaceApartLight', () => {
  function lighting(frame: THREE.Object3D | null = null) {
    const steps = new Set<LightPassStep>();
    const light = apartLight();
    const registerPassStep = vi.fn((step: LightPassStep) => {
      steps.add(step);
      return () => steps.delete(step);
    });
    const value = { ...INERT_CANVAS_LIGHTING, apartLight: () => light, registerPassStep };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CanvasLighting2DContext.Provider value={value}>
        <CanvasFrameContext.Provider value={frame}>{children}</CanvasFrameContext.Provider>
      </CanvasLighting2DContext.Provider>
    );
    const runPass = () =>
      steps.forEach((step) =>
        step(new THREE.Camera(), { rect: { x: 0, y: 0, w: 1, h: 1 }, scale: { x: 1, y: 1 } })
      );
    return { wrapper, light, steps, runPass };
  }

  it('writes the place ahead of every pass, from where the light is then', () => {
    const { wrapper, light, runPass } = lighting();
    const node = origin(10, 20);
    renderHook(() => usePlaceApartLight(0, node, placeAt50), { wrapper });
    node.position.x = 40;
    runPass();
    expect(light.place.toArray()).toEqual([40, -20, 50]);
  });

  it("hands the place the canvas's frame", () => {
    const frame = new THREE.Object3D();
    const { wrapper, runPass } = lighting(frame);
    const place = vi.fn();
    renderHook(() => usePlaceApartLight(0, origin(0, 0), place), { wrapper });
    runPass();
    expect(place.mock.calls[0]![2]).toBe(frame);
  });

  it('places nothing while the light is undeclared', () => {
    const { wrapper, steps } = lighting();
    renderHook(() => usePlaceApartLight(null, origin(0, 0), placeAt50), { wrapper });
    expect(steps.size).toBe(0);
  });

  it('stops placing on unmount', () => {
    const { wrapper, steps } = lighting();
    const { unmount } = renderHook(() => usePlaceApartLight(0, origin(0, 0), placeAt50), { wrapper });
    unmount();
    expect(steps.size).toBe(0);
  });
});

function placeAt50(light: ApartLight, node: THREE.Object3D): void {
  placePositionalLight(light, node, 50, false);
}
