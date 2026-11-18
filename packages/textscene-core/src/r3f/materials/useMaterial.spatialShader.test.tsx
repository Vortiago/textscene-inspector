import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as logger from '../../logger';
import type { TscnInternalResource } from '../../parser/types';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { inlineSource } from './surfaceMaterial.testkit';
import { useMaterial, useShadedMaterial } from './useMaterial';

const CODE = 'shader_type spatial;\nrender_mode unshaded;\n';

/** A new material for each test: the fallback warning is given once per shader. */
function resources(): TscnInternalResource[] {
  return [
    { id: 'Code', type: 'Shader', data: { code: JSON.stringify(CODE) } },
    {
      id: 'Paint',
      type: 'ShaderMaterial',
      data: { shader: 'SubResource("Code")', 'shader_parameter/tint': '0.5' },
    },
  ];
}

function loaded(load: (source: ReturnType<typeof inlineSource>) => unknown) {
  const fake = createFakeResourceLoader();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
  );
  const all = resources();
  const source = inlineSource(all[1]!, all);
  return renderHook(() => load(source), { wrapper }).result.current;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useShadedMaterial of a spatial ShaderMaterial', () => {
  it('hands on the shader text and its parameters, with no warning', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    expect(loaded(useShadedMaterial)).toMatchObject({
      status: 'spatial-shader',
      shader: { code: CODE, parameters: { tint: '0.5' } },
    });
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('useMaterial of a spatial ShaderMaterial', () => {
  it('declines it on a draw that builds no shader, with a warning that names the draw', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    expect(loaded((source) => useMaterial(source, 'next pass'))).toEqual({
      status: 'declined',
      type: 'ShaderMaterial',
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Godot's default 3D surface on this next pass")
    );
  });
});
