/**
 * `WorldEnvironment.camera_attributes` follows the reference chain as `environment` does: a
 * `SubResource` or an `ExtResource` `.tres`, of either concrete class. The seam under test is the
 * resolver hook.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useResolvedCameraAttributes } from './useResolvedCameraAttributes';
import type { CameraAttributesResolution } from './worldExposure';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import type { ParsedResource } from '../../parser/parsedResource';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import { subResource } from '../../testing/subResource';

function tres(resourceType: string, properties: Record<string, string>): ParsedResource {
  return { resourceType, properties, extResources: [], subResources: [] };
}

/** Render the hook and hand back its resolution. A file seeded `null` failed to load. */
async function resolution(
  cameraAttributesRef: string | undefined,
  internals: TscnInternalResource[],
  externals: TscnExternalResource[] = [],
  files: Record<string, ParsedResource | null> = {}
): Promise<CameraAttributesResolution> {
  const fake = createFakeResourceLoader();
  for (const [path, parsed] of Object.entries(files)) fake.resources.seed(path, parsed);

  let seen: CameraAttributesResolution | null = null;
  function Probe() {
    seen = useResolvedCameraAttributes(cameraAttributesRef);
    return null;
  }
  const tree = (
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={internals} externalResources={externals}>
        <Probe />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  const renderer = await ReactThreeTestRenderer.create(tree);
  // A second pass so an external .tres served from the seeded cache is reflected.
  await renderer.update(tree);
  return seen!;
}

describe('useResolvedCameraAttributes', () => {
  it('reads a CameraAttributesPractical sub-resource', async () => {
    const seen = await resolution('SubResource("Cam")', [
      subResource('CameraAttributesPractical', 'Cam', { exposure_multiplier: '2' }),
    ]);
    expect(seen).toEqual({ status: 'resolved', attributes: { exposureMultiplier: 2, autoExposure: null } });
  });

  it('reads a CameraAttributesPhysical sub-resource, whose aperture and shutter speed change nothing', async () => {
    const seen = await resolution('SubResource("Cam")', [
      subResource('CameraAttributesPhysical', 'Cam', {
        exposure_aperture: '4',
        exposure_shutter_speed: '30',
      }),
    ]);
    expect(seen).toEqual({ status: 'resolved', attributes: { exposureMultiplier: 1, autoExposure: null } });
  });

  it('reads a CameraAttributesPhysical exposure_multiplier like the Practical one', async () => {
    const seen = await resolution('SubResource("Cam")', [
      subResource('CameraAttributesPhysical', 'Cam', { exposure_multiplier: '2' }),
    ]);
    expect(seen).toEqual({ status: 'resolved', attributes: { exposureMultiplier: 2, autoExposure: null } });
  });

  it('follows an ExtResource .tres', async () => {
    const seen = await resolution(
      'ExtResource("1_cam")',
      [],
      [{ id: '1_cam', path: 'res://cam.tres', type: 'CameraAttributesPractical' }],
      { 'res://cam.tres': tres('CameraAttributesPractical', { exposure_multiplier: '3' }) }
    );
    expect(seen).toEqual({ status: 'resolved', attributes: { exposureMultiplier: 3, autoExposure: null } });
  });

  it('holds none for no reference', async () => {
    expect(await resolution(undefined, [])).toEqual({ status: 'none' });
  });

  it('holds none for a reference to nothing', async () => {
    expect(await resolution('SubResource("Missing")', [])).toEqual({ status: 'none' });
  });

  it('holds none for a resource of another type, which the property refuses', async () => {
    const seen = await resolution('SubResource("Env")', [
      subResource('Environment', 'Env', { exposure_multiplier: '2' }),
    ]);
    expect(seen).toEqual({ status: 'none' });
  });

  it('holds none for a .tres that fails to load', async () => {
    const seen = await resolution(
      'ExtResource("1_cam")',
      [],
      [{ id: '1_cam', path: 'res://cam.tres', type: 'CameraAttributesPractical' }],
      { 'res://cam.tres': null }
    );
    expect(seen).toEqual({ status: 'none' });
  });
});
