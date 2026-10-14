/** `useTextResourceSlot`: a texture slot's reference and tables, a saved `.tres` read in its own. */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { parseTresFile } from '../parser/parsedResource';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types';
import { ResourceLoaderProvider } from './ResourceLoaderContext';
import { createFakeResourceLoader } from './testing/createFakeResourceLoader';
import { useTextResourceSlot } from './useTextResourceSlot';

const SCENE_EXTERNAL: TscnExternalResource[] = [
  { id: '1', type: 'GradientTexture2D', path: 'res://ramp.tres' },
  { id: '2', type: 'Texture2D', path: 'res://icon.png' },
];
const SCENE_INTERNAL: TscnInternalResource[] = [{ id: 'local', type: 'GradientTexture2D', data: {} }];

const RAMP_TRES = `[gd_resource type="GradientTexture2D" format=3]

[sub_resource type="Gradient" id="Gradient_a"]

[resource]
gradient = SubResource("Gradient_a")
`;

function render(ref: string | undefined, seed?: (fake: ReturnType<typeof createFakeResourceLoader>) => void) {
  const fake = createFakeResourceLoader();
  seed?.(fake);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
  );
  return renderHook(() => useTextResourceSlot(ref, SCENE_EXTERNAL, SCENE_INTERNAL), { wrapper }).result;
}

describe('useTextResourceSlot', () => {
  it("reads a saved .tres as its [resource] in the file's own tables", () => {
    const result = render('ExtResource("1")', (fake) =>
      fake.resources.seed('res://ramp.tres', parseTresFile(RAMP_TRES))
    );
    const resource = result.current.internalResources.find(
      ({ id }) => `SubResource("${id}")` === result.current.ref
    );
    expect(resource?.type).toBe('GradientTexture2D');
    expect(result.current.internalResources.map(({ id }) => id)).toContain('Gradient_a');
    expect(result.current.missing).toBe(false);
  });

  it("passes any other reference through with the scene's tables", () => {
    const result = render('ExtResource("2")');
    expect(result.current).toEqual({
      ref: 'ExtResource("2")',
      externalResources: SCENE_EXTERNAL,
      internalResources: SCENE_INTERNAL,
      missing: false,
      isLoading: false,
    });
  });

  it('names nothing, and is not missing, while the .tres loads', () => {
    const result = render('ExtResource("1")');
    expect(result.current).toMatchObject({ ref: undefined, missing: false, isLoading: true });
  });

  it('reports a .tres that fails to load as missing (error path)', () => {
    const result = render('ExtResource("1")', (fake) => fake.resources.seed('res://ramp.tres', null));
    expect(result.current).toMatchObject({ ref: undefined, missing: true, isLoading: false });
  });
});
