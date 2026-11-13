import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { useEmissionTransform } from './emissionTransform';
import { TRANSFORM2D_IDENTITY } from '../../../godot/math/transform2d.js';
import { CanvasFrameContext } from '../../../r3f/canvasFrame';

function emitterAt(place: (object: THREE.Object3D) => void): THREE.Object3D {
  const emitter = new THREE.Object3D();
  place(emitter);
  return emitter;
}

function renderEmission(container: THREE.Object3D | null, localCoords: boolean) {
  return renderHook(({ target }) => useEmissionTransform(target, localCoords), {
    initialProps: { target: container },
  });
}

describe('useEmissionTransform', () => {
  it('reads a global-coords emitter’s canvas transform in Godot pixel space (happy path)', () => {
    const { result } = renderEmission(
      emitterAt((o) => o.position.set(30, 40, 0)),
      false
    );
    // The 2D subtree renders with Y flipped, so Three's +Y is Godot's -Y.
    expect(result.current).toEqual({ ...TRANSFORM2D_IDENTITY, tx: 30, ty: -40 });
  });

  it('reads the transform in its canvas frame, without the frame’s own placement', () => {
    const frame = new THREE.Object3D();
    frame.position.set(100, 200, 0);
    frame.scale.set(2, 2, 1);
    const emitter = emitterAt((o) => o.position.set(30, 40, 0));
    frame.add(emitter);
    const { result } = renderHook(() => useEmissionTransform(emitter, false), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <CanvasFrameContext.Provider value={frame}>{children}</CanvasFrameContext.Provider>
      ),
    });
    expect(result.current).toEqual({ ...TRANSFORM2D_IDENTITY, tx: 30, ty: -40 });
  });

  it('stays the identity for a local-coords emitter', () => {
    const { result } = renderEmission(
      emitterAt((o) => o.position.set(30, 40, 0)),
      true
    );
    expect(result.current).toEqual(TRANSFORM2D_IDENTITY);
  });

  it('stays the identity while the emitter is not in the tree (edge case)', () => {
    const { result } = renderEmission(null, false);
    expect(result.current).toEqual(TRANSFORM2D_IDENTITY);
  });

  it('keeps the published transform when a new container places the emitter identically', () => {
    const { result, rerender } = renderEmission(
      emitterAt((o) => o.position.set(30, 40, 0)),
      false
    );
    const first = result.current;
    rerender({ target: emitterAt((o) => o.position.set(30, 40, 0)) });
    expect(result.current).toBe(first);
  });

  it.each<[string, (object: THREE.Object3D) => void]>([
    ['x position', (o) => o.position.set(31, 40, 0)],
    ['y position', (o) => o.position.set(30, 41, 0)],
    ['x scale', (o) => (o.position.set(30, 40, 0), o.scale.set(2, 1, 1))],
    ['y scale', (o) => (o.position.set(30, 40, 0), o.scale.set(1, 2, 1))],
    ['rotation', (o) => (o.position.set(30, 40, 0), o.rotation.set(0, 0, 0.5))],
  ])('publishes a new transform when only the %s differs', (_label, place) => {
    const { result, rerender } = renderEmission(
      emitterAt((o) => o.position.set(30, 40, 0)),
      false
    );
    const first = result.current;
    rerender({ target: emitterAt(place) });
    expect(result.current).not.toEqual(first);
  });
});
