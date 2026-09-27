/**
 * A `surface_material_override/0` on a GLB override node fills the surface only
 * with what Godot's `Ref<Material>` slot would take: a reference that does not
 * load as a Material leaves the GLB's own material in place, and a Material the
 * previewer cannot build still occupies the slot and draws the default shader.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { initGlbModules } from '../../../resources/processing/glbProcessing';
import { GLBSceneRoot, GLB_SCENE_ROOT_TYPE } from './Component';
import { GlbOverridesProvider } from './GlbOverridesContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { SceneStack } from '../../testing/SceneStack';
import { NodePathProvider } from '../../contexts/NodePathContext';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../parser/types';

const GLB_PATH = 'res://x.glb';
const OWN_COLOR = 0x123456;

function makeFakeGlb(): THREE.Object3D {
  const root = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(),
    new THREE.MeshStandardMaterial({ color: OWN_COLOR })
  );
  body.name = 'body';
  root.add(body);
  return root;
}

const NODE: TscnNode = {
  name: 'Glb',
  type: GLB_SCENE_ROOT_TYPE,
  children: [],
  properties: { glbPath: GLB_PATH } as Record<string, unknown>,
};

const EXT: TscnExternalResource[] = [{ id: '2_tex', path: 'res://albedo.png', type: 'Texture2D' }];
const INTERNAL: TscnInternalResource[] = [
  { id: 'Shader_1', type: 'ShaderMaterial', data: {} },
  { id: 'Green_1', type: 'StandardMaterial3D', data: { albedo_color: 'Color(0, 1, 0, 1)' } },
];

function override(ref: string): TscnNode {
  return {
    name: 'body',
    type: 'Node',
    children: [],
    properties: { name: 'body' } as Record<string, unknown>,
    rawProperties: { 'surface_material_override/0': ref },
  };
}

async function bodyMaterial(ref: string): Promise<THREE.MeshStandardMaterial> {
  const fake = createFakeResourceLoader();
  fake.glbMeshes.seed(GLB_PATH, makeFakeGlb());
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack loader={fake.loader} scene={{ internalResources: INTERNAL, externalResources: EXT }}>
      <GlbOverridesProvider overrides={[override(ref)]}>
        <NodePathProvider path="Glb">
          <GLBSceneRoot node={NODE} />
        </NodePathProvider>
      </GlbOverridesProvider>
    </SceneStack>
  );
  await new Promise<void>((r) => setTimeout(r, 10));
  const body = renderer.scene
    .findAllByType('Mesh')
    .map((m) => m.instance as unknown as THREE.Mesh)
    .find((m) => m.name === 'body')!;
  return body.material as THREE.MeshStandardMaterial;
}

beforeAll(async () => {
  await initGlbModules();
});

describe('surface_material_override/0 on a GLB override node', () => {
  it('leaves the GLB material in place when the reference is not a Material', async () => {
    const material = await bodyMaterial('ExtResource("2_tex")');
    expect(material.color.getHex()).toBe(OWN_COLOR);
  });

  it('draws the default shader for a Material the previewer cannot build', async () => {
    const material = await bodyMaterial('SubResource("Shader_1")');
    const linear = material.color.getRGB({ r: 0, g: 0, b: 0 } as THREE.Color, THREE.LinearSRGBColorSpace);
    expect(linear.r).toBeCloseTo(0.6, 5);
  });

  it('draws a scene StandardMaterial3D sub-resource', async () => {
    const material = await bodyMaterial('SubResource("Green_1")');
    expect(material.color.g).toBeGreaterThan(0.9);
    expect(material.color.r).toBeLessThan(0.1);
  });
});
