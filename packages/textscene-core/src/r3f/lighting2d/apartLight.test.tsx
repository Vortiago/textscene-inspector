/**
 * Where a light kept apart sits for a normal-mapped item: in the canvas's world frame, which is
 * Godot's y-down canvas flipped to y up, so the light vector an item computes there is Godot's
 * flipped the same way, and its dot with the flipped normal is Godot's.
 */

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { degToRad } from '../../godot/math/math';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { placeDirectionalLight, placePositionalLight, useApartLightOrigin } from './apartLight';
import { CanvasFrameContext } from '../canvasFrame';
import { CanvasLighting2DContext, INERT_CANVAS_LIGHTING, type ApartPlacer } from './lightPassContext';

/** A light node at Godot's `position` and `rotation`, as the canvas's world frame holds it. */
function origin(x: number, y: number, rotationDegrees = 0): THREE.Object3D {
  const node = new THREE.Object3D();
  node.position.set(x, -y, 0);
  node.rotation.z = -degToRad(rotationDegrees);
  return node;
}

/** A frame whose world matrix scales its canvas by `scale`. */
function scaledFrame(scale: number): THREE.Object3D {
  const frame = new THREE.Object3D();
  frame.scale.set(scale, scale, 1);
  return frame;
}

describe('placePositionalLight', () => {
  it("writes the light's position and its height", () => {
    const place = new THREE.Vector3();
    placePositionalLight(place, origin(576, 324), 50, null);
    expect(place.toArray()).toEqual([576, -324, 50]);
  });

  it('reads the position through its parents', () => {
    const place = new THREE.Vector3();
    const parent = origin(100, 0);
    const node = origin(20, 10);
    parent.add(node);
    placePositionalLight(place, node, 0, null);
    expect(place.toArray()).toEqual([120, -10, 0]);
  });

  it("scales the height by the canvas's frame", () => {
    // `renderer_canvas_render_rd.cpp:612`: the height takes the canvas transform's scale.
    const place = new THREE.Vector3();
    placePositionalLight(place, origin(0, 0), 50, scaledFrame(2));
    expect(place.z).toBe(100);
  });

  it("scales the height by the mean length of the frame's two axes through its parents", () => {
    // `renderer_canvas_render_rd.cpp:612`: the mean of the canvas transform's column lengths.
    const anchor = scaledFrame(2);
    const frame = new THREE.Object3D();
    frame.scale.set(1, 2, 1);
    frame.rotation.z = 0.7;
    anchor.add(frame);
    const place = new THREE.Vector3();
    placePositionalLight(place, origin(0, 0), 1, frame);
    expect(place.z).toBeCloseTo(3);
  });

  it('keeps the height on the root canvas, whose frame is the world', () => {
    const place = new THREE.Vector3();
    placePositionalLight(place, origin(0, 0), 50, null);
    expect(place.z).toBe(50);
  });
});

describe('placeDirectionalLight', () => {
  it('points up the canvas toward an unrotated light, which shines down', () => {
    // `renderer_canvas_render_rd.cpp:542-545`: the direction is minus the light's y axis.
    const place = new THREE.Vector3();
    placeDirectionalLight(place, origin(300, 300), 0.5, null);
    expect(place.toArray()).toEqual([0, 1, 0.5]);
  });

  it('turns with the light, and ignores its scale and the frame', () => {
    // A light turned 90 degrees clockwise on Godot's canvas shines left, so it sits to the right.
    const place = new THREE.Vector3();
    const node = origin(0, 0, 90);
    node.scale.set(3, 3, 1);
    placeDirectionalLight(place, node, 1, scaledFrame(2));
    expect(place.x).toBeCloseTo(1);
    expect(place.y).toBeCloseTo(0);
    expect(place.z).toBe(1);
  });
});

describe('useApartLightOrigin', () => {
  function lighting(frame: THREE.Object3D | null = null) {
    const placers = new Map<number, ApartPlacer>();
    const registerApartPlacer = vi.fn((ordinal: number, placer: ApartPlacer) => {
      placers.set(ordinal, placer);
      return () => placers.delete(ordinal);
    });
    const value = { ...INERT_CANVAS_LIGHTING, registerApartPlacer };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CanvasLighting2DContext.Provider value={value}>
        <CanvasFrameContext.Provider value={frame}>{children}</CanvasFrameContext.Provider>
      </CanvasLighting2DContext.Provider>
    );
    return { wrapper, placers };
  }

  /** Mounts the hook for light `ordinal` and hands it `node` as its origin. */
  function mountOrigin(
    wrapper: ReturnType<typeof lighting>['wrapper'],
    ordinal: number | null,
    node: THREE.Object3D
  ) {
    const hook = renderHook(() => useApartLightOrigin(ordinal, placePositionalLight, 50), { wrapper });
    act(() => hook.result.current(node));
    return hook;
  }

  it('hands the pass a placer that reads where the origin is when it runs', () => {
    const { wrapper, placers } = lighting();
    const node = origin(10, 20);
    mountOrigin(wrapper, 0, node);
    node.position.x = 40;
    const place = new THREE.Vector3();
    placers.get(0)!(place);
    expect(place.toArray()).toEqual([40, -20, 50]);
  });

  it("places in the canvas's frame", () => {
    const { wrapper, placers } = lighting(scaledFrame(2));
    mountOrigin(wrapper, 0, origin(0, 0));
    const place = new THREE.Vector3();
    placers.get(0)!(place);
    expect(place.z).toBe(100);
  });

  it('hands no placer before the origin mounts', () => {
    const { wrapper, placers } = lighting();
    renderHook(() => useApartLightOrigin(0, placePositionalLight, 50), { wrapper });
    expect(placers.size).toBe(0);
  });

  it('hands no placer while the light is undeclared', () => {
    const { wrapper, placers } = lighting();
    mountOrigin(wrapper, null, origin(0, 0));
    expect(placers.size).toBe(0);
  });

  it('withdraws the placer on unmount', () => {
    const { wrapper, placers } = lighting();
    const { unmount } = mountOrigin(wrapper, 0, origin(0, 0));
    unmount();
    expect(placers.size).toBe(0);
  });
});
