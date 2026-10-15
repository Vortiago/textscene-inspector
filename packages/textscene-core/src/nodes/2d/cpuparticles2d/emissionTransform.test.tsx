import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { renderHook } from '@testing-library/react';
import { useEmissionTransform } from './emissionTransform';
import { TRANSFORM2D_IDENTITY } from '../../../godot/transform2d.js';

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
  it('reads a global-coords emitter’s world transform in Godot pixel space (happy path)', () => {
    const { result } = renderEmission(
      emitterAt((o) => o.position.set(30, 40, 0)),
      false
    );
    // The 2D subtree renders with Y flipped, so Three's +Y is Godot's -Y.
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
