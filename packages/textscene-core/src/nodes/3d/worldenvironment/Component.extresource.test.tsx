/**
 * An Environment, a Sky or a sky material can each live in a standalone `.tres`, and Godot treats
 * that form as it treats the inline one. The seam under test is the resolver hook, not the rendered
 * sky, because the question is whether the reference is followed. A resolved `SkyProperties` is
 * `SkyLayer`'s business.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useResolvedEnvironment } from './useResolvedEnvironment';
import type { ResolvedEnvironment } from './useResolvedEnvironment';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type { ParsedResource } from '../../../parser/parsedResource';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';

function tres(resourceType: string, properties: Record<string, string>): ParsedResource {
  return { resourceType, properties, extResources: [], subResources: [] };
}

const SKY_MATERIAL_TRES = tres('ProceduralSkyMaterial', {
  sky_top_color: 'Color(0, 0.69, 0.89, 1)',
  sky_horizon_color: 'Color(0.72, 0.91, 1, 1)',
});

/** Render the hook and hand back what it resolved. */
async function resolve(
  environmentRef: string | undefined,
  internals: TscnInternalResource[],
  externals: TscnExternalResource[],
  files: Record<string, ParsedResource> = {}
): Promise<ResolvedEnvironment | null> {
  const fake = createFakeResourceLoader();
  for (const [path, parsed] of Object.entries(files)) fake.resources.seed(path, parsed);

  let seen: ResolvedEnvironment | null = null;
  function Probe() {
    seen = useResolvedEnvironment(environmentRef);
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
  return seen;
}

const ENVIRONMENT_WITH_SKY: TscnInternalResource = {
  id: 'Environment_1',
  type: 'Environment',
  data: { background_mode: '2', sky: 'SubResource("Sky_1")' },
};

describe('useResolvedEnvironment — references held in an external .tres', () => {
  it('follows a sky_material held in an ExtResource (the truck town witness)', async () => {
    const resolved = await resolve(
      'SubResource("Environment_1")',
      [
        ENVIRONMENT_WITH_SKY,
        { id: 'Sky_1', type: 'Sky', data: { sky_material: 'ExtResource("1_sky")' } },
      ],
      [{ id: '1_sky', path: 'res://town/sky_day.tres', type: 'Material' }],
      { 'res://town/sky_day.tres': SKY_MATERIAL_TRES }
    );
    expect(resolved?.sky).not.toBeNull();
    expect(resolved?.sky?.kind).toBe('procedural');
  });

  it('follows a Sky held in an ExtResource', async () => {
    const resolved = await resolve(
      'SubResource("Environment_1")',
      [
        {
          id: 'Environment_1',
          type: 'Environment',
          data: { background_mode: '2', sky: 'ExtResource("1_skyres")' },
        },
        { id: 'Mat_1', type: 'ProceduralSkyMaterial', data: { sky_top_color: 'Color(0, 1, 1, 1)' } },
      ],
      [{ id: '1_skyres', path: 'res://sky.tres', type: 'Sky' }],
      { 'res://sky.tres': tres('Sky', { sky_material: 'SubResource("Mat_1")' }) }
    );
    expect(resolved?.sky?.kind).toBe('procedural');
  });

  it('follows the whole Environment held in an ExtResource', async () => {
    // No vendored witness at this level, but sharing one environment .tres across scenes
    // is a normal Godot idiom, and losing it costs fog and tonemapping too, not just sky.
    const resolved = await resolve(
      'ExtResource("1_env")',
      [],
      [{ id: '1_env', path: 'res://default_env.tres', type: 'Environment' }],
      {
        'res://default_env.tres': tres('Environment', {
          background_mode: '1',
          background_color: 'Color(0.6, 0.6, 0.6, 1)',
        }),
      }
    );
    expect(resolved).not.toBeNull();
    expect(resolved!.settings).toBeTruthy();
  });

  it('still resolves the inline SubResource chain every other corpus scene uses', async () => {
    const resolved = await resolve(
      'SubResource("Environment_1")',
      [
        ENVIRONMENT_WITH_SKY,
        { id: 'Sky_1', type: 'Sky', data: { sky_material: 'SubResource("Mat_1")' } },
        { id: 'Mat_1', type: 'ProceduralSkyMaterial', data: { sky_top_color: 'Color(0, 1, 1, 1)' } },
      ],
      [],
      {}
    );
    expect(resolved?.sky?.kind).toBe('procedural');
  });

  it('resolves the environment even while its sky .tres is still loading', async () => {
    // Progressive fill-in: fog and tonemapping must not wait on the sky.
    const resolved = await resolve(
      'SubResource("Environment_1")',
      [
        ENVIRONMENT_WITH_SKY,
        { id: 'Sky_1', type: 'Sky', data: { sky_material: 'ExtResource("1_sky")' } },
      ],
      [{ id: '1_sky', path: 'res://never.tres', type: 'Material' }],
      {}
    );
    expect(resolved).not.toBeNull();
    expect(resolved!.sky).toBeNull();
  });

  it('is null when there is no environment reference at all', async () => {
    expect(await resolve(undefined, [], [], {})).toBeNull();
  });

  it('is null when the reference resolves to something that is not an Environment', async () => {
    const resolved = await resolve(
      'SubResource("Nope_1")',
      [{ id: 'Nope_1', type: 'BoxMesh', data: {} }],
      [],
      {}
    );
    expect(resolved).toBeNull();
  });
});
