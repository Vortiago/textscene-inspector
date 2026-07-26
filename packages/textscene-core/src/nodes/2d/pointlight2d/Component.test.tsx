/**
 * PointLight2D render component tests.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';

import { parsePointLight2D } from './parser';
import { PointLight2D } from './Component';
import { CanvasWorkspaceProvider } from '../../../r3f/contexts/CanvasWorkspaceContext';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type { TscnNode } from '../../../parser/types';
import { godotColorToLinear } from '../../../r3f/godotColor';

const nodeHeading = { type: 'node' as const, attributes: { type: 'PointLight2D', name: 'Light' } };

const TEX = 'res://light.png';

function node(raw: Record<string, string> = {}): TscnNode {
  return {
    name: 'Light',
    type: 'PointLight2D',
    children: [],
    properties: parsePointLight2D(nodeHeading, { texture: 'ExtResource("1")', ...raw }),
  };
}

async function render(rootNode: TscnNode) {
  const fake = createFakeResourceLoader();
  const tex = new THREE.Texture();
  (tex as unknown as { image: { width: number; height: number } }).image = { width: 64, height: 64 };
  fake.textures.seed(TEX, tex);

  return ReactThreeTestRenderer.create(
    <CanvasWorkspaceProvider workspace="2d">
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={[]}
          externalResources={[{ id: '1', type: 'Texture2D', path: TEX }]}
        >
          <PointLight2D node={rootNode} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    </CanvasWorkspaceProvider>
  );
}

describe('PointLight2D Component', () => {
  it('renders a surface-modulating light mesh when enabled with texture', async () => {
    const r = await render(node());
    const meshes = r.scene.findAllByType('Mesh');
    expect(meshes.length).toBeGreaterThan(0);
    const mat = meshes[0]!.instance as THREE.Mesh;
    expect(mat.material).toBeDefined();
    // A light is applied AGAINST the surface: Godot's ADD blend leaves
    // `albedo x (1 + light)`, which is `src x DST + dst x ONE`. Plain additive
    // blending would paint `albedo + light` over it and wash the surface out.
    const lightMat = mat.material as THREE.MeshBasicMaterial;
    expect(lightMat.blending).toBe(THREE.CustomBlending);
    expect(lightMat.blendSrc).toBe(THREE.DstColorFactor);
    expect(lightMat.blendDst).toBe(THREE.OneFactor);
    expect(lightMat.blendEquation).toBe(THREE.AddEquation);
  });

  it('returns null (no mesh) when enabled=false', async () => {
    const r = await render(node({ enabled: 'false' }));
    const meshes = r.scene.findAllByType('Mesh');
    expect(meshes.length).toBe(0);
  });

  it('applies texture_scale to quad dimensions', async () => {
    const r = await render(node({ texture_scale: '2.0' }));
    const meshes = r.scene.findAllByType('Mesh');
    expect(meshes.length).toBeGreaterThan(0);
    const geom = (meshes[0]!.instance as THREE.Mesh).geometry as THREE.PlaneGeometry;
    expect(geom.parameters.width).toBeCloseTo(128, 5); // 64 * 2
    expect(geom.parameters.height).toBeCloseTo(128, 5); // 64 * 2
  });

  it('tints the light by godotColorToLinear(color) × energy', async () => {
    const r = await render(node({ color: 'Color(0.5, 0.5, 0.5, 1)', energy: '2.0' }));
    const meshes = r.scene.findAllByType('Mesh');
    const mat = (meshes[0]!.instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    const linHalf = godotColorToLinear({ r: 0.5, g: 0.5, b: 0.5 }).r * 2;
    expect(mat.color.r).toBeCloseTo(linHalf, 3);
  });

  it('shows missing resource placeholder when no texture resolves', async () => {
    // Use no texture property → texturePath is null → placeholder shown.
    const r = await render(node({ texture: 'ExtResource("missing")' }));
    const groups = r.scene.findAllByType('Group');
    expect(groups.length).toBeGreaterThan(0);
  });
});
