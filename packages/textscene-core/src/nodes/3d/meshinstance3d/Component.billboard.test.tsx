/**
 * A StandardMaterial3D `billboard_mode` replaces the model basis of the surfaces
 * that material draws, in the vertex shader (`scene/resources/material.cpp:1260-1307`).
 * So only those surfaces turn: the node, its other surfaces and its children
 * keep the authored pose. Each node authors a quarter-turn yaw a billboard must replace.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { parseTresFile } from '../../../parser/parsedResource';
import { standardMaterialTres } from '../../../resources/materials/standardmaterial3d/testing/standardMaterial';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { findMesh, instanceAs } from '../testing/reactThreeTestInstance';
import { inlineTwoSurfaceMesh } from './testing/twoSurfaceMesh';
import { YAWED } from './testing/yawedTransform';
import { drawColourGroup, rotationAngle, TEST_CAMERA } from '../../../r3f/testing/threePasses';

const BILLBOARD_TRES = 'res://billboard.tres';
const EXTERNALS: readonly TscnExternalResource[] = [
  { id: '1_ext', path: BILLBOARD_TRES, type: 'StandardMaterial3D' },
];

const camera = TEST_CAMERA;

function sub(type: string, id: string, data: Record<string, string> = {}): TscnInternalResource {
  return { id, type, data };
}

function meshNode(properties: Partial<MeshInstance3DProperties>): TscnNode {
  const props: MeshInstance3DProperties = {
    name: 'GlowSprite',
    transform: YAWED,
    mesh: 'SubResource("Quad")',
    surfaceMaterialOverrides: new Map([[0, 'SubResource("Mat")']]),
    ...properties,
  };
  return { name: props.name, type: 'MeshInstance3D', children: [], properties: props };
}

async function renderMesh(
  node: TscnNode,
  internals: TscnInternalResource[]
): Promise<{ mesh: THREE.Mesh; child: THREE.Object3D }> {
  const fake = createFakeResourceLoader();
  fake.resources.seed(BILLBOARD_TRES, parseTresFile(standardMaterialTres({ billboard_mode: '1' })));
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider
        internalResources={[sub('QuadMesh', 'Quad'), ...internals]}
        externalResources={EXTERNALS}
      >
        <MeshInstance3D node={node}>
          <group name="__child__" />
        </MeshInstance3D>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  // Frames run, so a per-frame rotation of the whole node would show.
  await renderer.advanceFrames(2, 16);
  const mesh = findMesh(renderer.scene);
  mesh.updateMatrixWorld(true);
  const child = renderer.scene
    .findAllByType('Group')
    .map((g) => instanceAs<THREE.Object3D>(g))
    .find((g) => g.name === '__child__')!;
  return { mesh, child };
}

function facesCamera(drawn: THREE.Matrix4): boolean {
  return rotationAngle(drawn, camera.matrixWorld) < 1e-5;
}

const withSceneMaterial = (data: Record<string, string>) => [
  sub('StandardMaterial3D', 'Mat', { shading_mode: '0', ...data }),
];

describe('<MeshInstance3D> material billboard_mode', () => {
  it('draws the authored pose when the material sets no billboard_mode', async () => {
    const { mesh } = await renderMesh(meshNode({}), withSceneMaterial({}));
    const drawn = drawColourGroup(mesh, camera, 0, (s) => s.matrixWorld);
    expect(drawn.equals(mesh.matrixWorld)).toBe(true);
  });

  it('draws facing the camera when the material sets billboard_mode = 1 (ENABLED)', async () => {
    const { mesh } = await renderMesh(meshNode({}), withSceneMaterial({ billboard_mode: '1' }));
    expect(facesCamera(drawColourGroup(mesh, camera, 0, (s) => s.matrixWorld))).toBe(true);
  });

  it('draws with world up kept when the material sets billboard_mode = 2 (FIXED_Y)', async () => {
    const { mesh } = await renderMesh(meshNode({}), withSceneMaterial({ billboard_mode: '2' }));
    const drawn = drawColourGroup(mesh, camera, 0, (s) => s.matrixWorld);
    const drawnUp = new THREE.Vector3().setFromMatrixColumn(drawn, 1);
    expect(drawnUp.x).toBeCloseTo(0, 6);
    expect(drawnUp.z).toBeCloseTo(0, 6);
    expect(facesCamera(drawn)).toBe(false);
    expect(drawn.equals(mesh.matrixWorld)).toBe(false);
  });

  it('draws facing the camera when the billboarding material is an ExtResource .tres', async () => {
    const { mesh } = await renderMesh(meshNode({ materialOverride: 'ExtResource("1_ext")' }), []);
    expect(facesCamera(drawColourGroup(mesh, camera, 0, (s) => s.matrixWorld))).toBe(true);
  });

  it('keeps the node and its children in the authored pose', async () => {
    // Godot's billboard is a surface-shader term, so no transform above or below it moves.
    const { mesh, child } = await renderMesh(meshNode({}), withSceneMaterial({ billboard_mode: '1' }));
    expect(Math.abs(mesh.quaternion.y)).toBeGreaterThan(0.5);
    expect(facesCamera(child.matrixWorld)).toBe(false);
  });
});

describe('<MeshInstance3D> billboard_mode per ArrayMesh surface', () => {
  async function twoSurfaces(): Promise<THREE.Mesh> {
    const { mesh } = await renderMesh(
      meshNode({ mesh: 'SubResource("Mesh_2")', surfaceMaterialOverrides: new Map() }),
      [
        inlineTwoSurfaceMesh('Mesh_2', ['Plain', 'Facing']),
        sub('StandardMaterial3D', 'Plain'),
        sub('StandardMaterial3D', 'Facing', { billboard_mode: '1' }),
      ]
    );
    return mesh;
  }

  it('turns the surface whose material billboards', async () => {
    const mesh = await twoSurfaces();
    expect(facesCamera(drawColourGroup(mesh, camera, 1, (s) => s.matrixWorld))).toBe(true);
  });

  it('leaves the other surface in the authored pose', async () => {
    const mesh = await twoSurfaces();
    expect(drawColourGroup(mesh, camera, 0, (s) => s.matrixWorld).equals(mesh.matrixWorld)).toBe(true);
  });

  it('follows a .tres surface override onto the surface it names', async () => {
    const { mesh } = await renderMesh(
      meshNode({
        mesh: 'SubResource("Mesh_2")',
        surfaceMaterialOverrides: new Map([[0, 'ExtResource("1_ext")']]),
      }),
      [inlineTwoSurfaceMesh('Mesh_2', ['Plain', 'Plain']), sub('StandardMaterial3D', 'Plain')]
    );
    expect(facesCamera(drawColourGroup(mesh, camera, 0, (s) => s.matrixWorld))).toBe(true);
    expect(drawColourGroup(mesh, camera, 1, (s) => s.matrixWorld).equals(mesh.matrixWorld)).toBe(true);
  });
});

describe('<MeshInstance3D> billboard_keep_scale', () => {
  /** The yawed pose, scaled ×2 on every axis. */
  const SCALED: typeof YAWED = {
    basis_x: { x: 0, y: 0, z: 2 },
    basis_y: { x: 0, y: 2, z: 0 },
    basis_z: { x: -2, y: 0, z: 0 },
    origin: { x: 3, y: 0, z: 0 },
  };

  async function drawnScale(materialData: Record<string, string>): Promise<THREE.Vector3> {
    const { mesh } = await renderMesh(
      meshNode({ transform: SCALED }),
      withSceneMaterial({ billboard_mode: '1', ...materialData })
    );
    const drawn = drawColourGroup(mesh, camera, 0, (s) => s.matrixWorld);
    return new THREE.Vector3().setFromMatrixScale(drawn);
  }

  it('draws at unit scale by default, as Godot drops the model scale', async () => {
    const scale = await drawnScale({});
    expect(scale.x).toBeCloseTo(1, 5);
    expect(scale.y).toBeCloseTo(1, 5);
    expect(scale.z).toBeCloseTo(1, 5);
  });

  it('keeps the node scale when the material sets billboard_keep_scale', async () => {
    const scale = await drawnScale({ billboard_keep_scale: 'true' });
    expect(scale.x).toBeCloseTo(2, 5);
    expect(scale.y).toBeCloseTo(2, 5);
    expect(scale.z).toBeCloseTo(2, 5);
  });
});
