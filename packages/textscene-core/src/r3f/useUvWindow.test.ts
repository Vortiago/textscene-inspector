/**
 * `useUvWindow`: a frame change moves the drawn texture's UV window in place, so the
 * texture, and the GPU copy three keys to it, stays the same.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { renderHook } from '@testing-library/react';
import type { UvWindow } from './spriteFrame';
import { useUvWindow } from './useUvWindow';

function uvWindow(offsetX: number, repeatX: number): UvWindow {
  return { offset: new THREE.Vector2(offsetX, 0), repeat: new THREE.Vector2(repeatX, 1) };
}

describe('useUvWindow', () => {
  it('sets the window on the drawn texture', () => {
    const texture = new THREE.Texture();
    renderHook(() => useUvWindow(texture, uvWindow(0.5, 0.25)));

    expect(texture.offset.toArray()).toEqual([0.5, 0]);
    expect(texture.repeat.toArray()).toEqual([0.25, 1]);
  });

  it('moves the window on the same texture when the frame changes', () => {
    const texture = new THREE.Texture();
    const { rerender } = renderHook(({ frameWindow }) => useUvWindow(texture, frameWindow), {
      initialProps: { frameWindow: uvWindow(0, 0.25) },
    });
    const versionBefore = texture.version;
    rerender({ frameWindow: uvWindow(0.75, 0.25) });

    expect(texture.offset.x).toBe(0.75);
    expect(texture.version).toBe(versionBefore);
  });

  it('does nothing while there is no texture to draw', () => {
    expect(() => renderHook(() => useUvWindow(null, uvWindow(0.5, 0.25)))).not.toThrow();
  });

  it('never writes into the window it reads', () => {
    const frameWindow = uvWindow(0.5, 0.25);
    const texture = new THREE.Texture();
    renderHook(() => useUvWindow(texture, frameWindow));
    texture.offset.set(0, 0);

    expect(frameWindow.offset.x).toBe(0.5);
  });
});
