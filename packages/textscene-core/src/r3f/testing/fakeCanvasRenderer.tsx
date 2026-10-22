/**
 * A fake `<Canvas>` store whose renderer records the GPU parameter writes of `useNearestAnisotropy`,
 * for a test that draws a texture without a WebGL context.
 */
import { createElement, type ReactNode } from 'react';
import { vi } from 'vitest';
import { context } from '@react-three/fiber';

export const FAKE_GL = { TEXTURE_2D: 0x0de1, TEXTURE0: 0x84c0 };
export const MAX_ANISOTROPY_PARAMETER = 0x84fe;

/** `isAllocated`: three has already made GPU storage for every texture. */
export function fakeCanvasRenderer({ isAllocated }: { isAllocated: boolean }) {
  const storage = { name: 'storage' };
  const gl = { ...FAKE_GL, texParameterf: vi.fn() };
  const properties = isAllocated ? { __webglTexture: storage } : {};
  const renderer = {
    getContext: () => gl,
    state: { bindTexture: vi.fn() },
    properties: { get: () => properties },
    extensions: { get: () => ({ TEXTURE_MAX_ANISOTROPY_EXT: MAX_ANISOTROPY_PARAMETER }) },
    capabilities: { getMaxAnisotropy: () => 8 },
    initTexture: vi.fn(() => {
      (properties as { __webglTexture?: unknown }).__webglTexture = storage;
    }),
  };
  const store = { getState: () => ({ gl: renderer }) };
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(context.Provider, { value: store as never }, children);
  return { gl, renderer, storage, wrapper };
}
