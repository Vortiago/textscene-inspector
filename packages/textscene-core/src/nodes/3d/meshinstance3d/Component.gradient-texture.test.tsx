/**
 * Wiring test: a MeshInstance3D whose StandardMaterial3D albedo_texture is an
 * inline `SubResource(GradientTexture2D)` (the 3D-platformer coin's glow
 * sprite) must resolve the gradient SYNCHRONOUSLY and hand the rasterised
 * DataTexture to the rendered material's `map`. No file pipeline, no
 * `useResource` round trip — the gradient is fully described in the scene.
 *
 * The coin material is `shading_mode = 0` (unshaded) + `blend_mode = 1` (ADD),
 * so it renders as an additive-blended MeshBasicMaterial.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider, ResourceLoader, FileEventBus } from '../../../index';
import type { ResourceProvider } from '../../../resources/ResourceProvider';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';

class NoopProvider implements ResourceProvider {
  async loadResource(): Promise<string | ArrayBuffer | null> {
    return null;
  }
}

function makeLoader(): ResourceLoader {
  const provider = new NoopProvider();
  const loader = new ResourceLoader(new FileEventBus(provider));
  loader.setProvider(provider);
  return loader;
}

// Mirrors scenes/demos/3d/platformer/coin/coin.tscn's GlowSprite chain.
const coinResources: TscnInternalResource[] = [
  { id: 'QuadMesh_kqa4x', type: 'QuadMesh', data: { id: 'QuadMesh_kqa4x' } },
  {
    id: 'Gradient_cd1ha',
    type: 'Gradient',
    data: {
      id: 'Gradient_cd1ha',
      interpolation_mode: '2',
      offsets: 'PackedFloat32Array(0, 0.642276, 1)',
      colors: 'PackedColorArray(1, 1, 1, 1, 1, 1, 1, 0.180392, 1, 1, 1, 0)',
    } as Record<string, string>,
  },
  {
    id: 'GradientTexture2D_qhu5r',
    type: 'GradientTexture2D',
    data: {
      id: 'GradientTexture2D_qhu5r',
      gradient: 'SubResource("Gradient_cd1ha")',
      fill: '1',
      fill_from: 'Vector2(0.5, 0.5)',
      fill_to: 'Vector2(0.5, 0.01)',
    } as Record<string, string>,
  },
  {
    id: 'StandardMaterial3D_7q0mq',
    type: 'StandardMaterial3D',
    data: {
      id: 'StandardMaterial3D_7q0mq',
      transparency: '1',
      blend_mode: '1',
      shading_mode: '0',
      albedo_color: 'Color(1, 0.858824, 0.572549, 0.25098)',
      albedo_texture: 'SubResource("GradientTexture2D_qhu5r")',
    } as Record<string, string>,
  },
];

function coinNode(): TscnNode {
  return {
    name: 'GlowSprite',
    type: 'MeshInstance3D',
    children: [],
    properties: {
      name: 'GlowSprite',
      mesh: 'SubResource("QuadMesh_kqa4x")',
      materialOverride: 'SubResource("StandardMaterial3D_7q0mq")',
      surfaceMaterialOverrides: new Map(),
    } as MeshInstance3DProperties,
  };
}

describe('<MeshInstance3D> GradientTexture2D albedo (coin glow)', () => {
  it('rasterises the inline gradient synchronously onto the unshaded material map', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={makeLoader()}>
        <SceneResourcesProvider internalResources={coinResources} externalResources={[]}>
          <MeshInstance3D node={coinNode()} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );

    const basic = renderer.scene.findAllByType('MeshBasicMaterial')[0]?.instance as
      | THREE.MeshBasicMaterial
      | undefined;
    expect(basic).toBeDefined();
    // The gradient DataTexture is on the map, resolved without any async load.
    expect(basic!.map).toBeInstanceOf(THREE.DataTexture);
    expect(basic!.map!.image.width).toBe(64);
    // ADD blend + transparency carried from the material.
    expect(basic!.blending).toBe(THREE.AdditiveBlending);
    expect(basic!.transparent).toBe(true);
  });
});
