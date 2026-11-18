import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as logger from '../../logger';
import type { TscnInternalResource } from '../../parser/types';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import type { LitSurfaceForm } from '../litSurface/litSurfaceForm';
import { inlineSource } from './surfaceMaterial.testkit';
import { useMaterial } from './useMaterial';

/** Written by each test before it renders. */
let form: LitSurfaceForm = 'patched';
vi.mock('../litSurface/litSurfaceForm', () => ({ litSurfaceForm: () => form }));

const CODE = 'shader_type spatial;\nrender_mode unshaded;\n';

const RESOURCES: TscnInternalResource[] = [
  { id: 'Code', type: 'Shader', data: { code: JSON.stringify(CODE) } },
  {
    id: 'Paint',
    type: 'ShaderMaterial',
    data: { shader: 'SubResource("Code")', 'shader_parameter/tint': '0.5' },
  },
];

function loadedPaint() {
  const fake = createFakeResourceLoader();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
  );
  const source = inlineSource(RESOURCES[1]!, RESOURCES);
  return renderHook(() => useMaterial(source), { wrapper }).result.current;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useMaterial of a spatial ShaderMaterial', () => {
  it('hands on the shader text and its parameters under the node lit surface, with no warning', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    form = 'nodes';

    expect(loadedPaint()).toMatchObject({
      status: 'spatial-shader',
      shader: { code: CODE, parameters: { tint: '0.5' } },
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("declines it with a warning under the patched lit surface: Godot's default surface", () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    form = 'patched';

    expect(loadedPaint()).toEqual({ status: 'declined', type: 'ShaderMaterial' });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
