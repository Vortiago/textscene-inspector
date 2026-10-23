/**
 * A fake `<Canvas>` store whose renderer records the GPU parameter writes of `useNearestAnisotropy`,
 * for a test that draws a texture without a WebGL context.
 */
import { createElement, type ReactNode } from 'react';
import { vi, type Mock } from 'vitest';
import { context } from '@react-three/fiber';

export const FAKE_GL = { TEXTURE_2D: 0x0de1, TEXTURE0: 0x84c0 };
export const MAX_ANISOTROPY_PARAMETER = 0x84fe;

interface FakeCanvasRenderer {
  gl: typeof FAKE_GL & { texParameterf: Mock };
  renderer: { state: { bindTexture: Mock } };
  storage: object;
  wrapper: (props: { children: ReactNode }) => ReactNode;
}

/**
 * `isAllocated`: three has already made GPU storage for every texture. `hasAnisotropyExtension`:
 * the GPU supports `EXT_texture_filter_anisotropic`, else three's `extensions.get` returns null.
 */
export function fakeCanvasRenderer({
  isAllocated,
  hasAnisotropyExtension = true,
}: {
  isAllocated: boolean;
  hasAnisotropyExtension?: boolean;
}): FakeCanvasRenderer {
  const storage = { name: 'storage' };
  const gl = { ...FAKE_GL, texParameterf: vi.fn() };
  const properties: { __webglTexture?: object } = isAllocated ? { __webglTexture: storage } : {};
  const renderer = {
    getContext: () => gl,
    state: { bindTexture: vi.fn() },
    properties: { get: () => properties },
    extensions: {
      get: () => (hasAnisotropyExtension ? { TEXTURE_MAX_ANISOTROPY_EXT: MAX_ANISOTROPY_PARAMETER } : null),
    },
    capabilities: { getMaxAnisotropy: () => 8 },
  };
  const store = { getState: () => ({ gl: renderer }) };
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(context.Provider, { value: store as never }, children);
  return { gl, renderer, storage, wrapper };
}
