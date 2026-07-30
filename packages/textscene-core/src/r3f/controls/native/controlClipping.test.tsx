/**
 * `controlClipping` carries an accumulated `THREE.Plane[]` down the native
 * Control tree — a verified spike (see the packet's own findings) established
 * that clip PLANES, not stencil, are correct here: the on-screen 2D canvas
 * requests no stencil buffer at all, so a stencil-based clip would be a
 * silent no-op. This packet contributes no planes of its own (ScrollContainer
 * fills them in later); these tests pin the seam — default-empty, inherits
 * through the provider, and the pure accumulator a future contributor calls.
 */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { ControlClipProvider, useControlClipPlanes, withAdditionalClipPlanes } from './controlClipping';

describe('useControlClipPlanes', () => {
  it('defaults to an empty plane list outside any provider', () => {
    const { result } = renderHook(() => useControlClipPlanes());
    expect(result.current).toEqual([]);
  });

  it('reads whatever the nearest provider carries', () => {
    const plane = new THREE.Plane();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ControlClipProvider value={[plane]}>{children}</ControlClipProvider>
    );
    const { result } = renderHook(() => useControlClipPlanes(), { wrapper });
    expect(result.current).toEqual([plane]);
  });
});

describe('withAdditionalClipPlanes', () => {
  it('returns the SAME inherited array when nothing new is added (edge: no re-render churn)', () => {
    const inherited: readonly THREE.Plane[] = [new THREE.Plane()];
    expect(withAdditionalClipPlanes(inherited, [])).toBe(inherited);
  });

  it('concatenates inherited + own planes, inherited first', () => {
    const parentPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    const ownPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    expect(withAdditionalClipPlanes([parentPlane], [ownPlane])).toEqual([parentPlane, ownPlane]);
  });
});
