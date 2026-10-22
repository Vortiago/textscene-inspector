/** A PointMesh draws as THREE.Points, `PRIMITIVE_POINTS` (`primitive_meshes.cpp:2388`), not as triangles. */

import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { subResource } from '../../../testing/subResource';
import { loaderServing } from '../../../resources/testing/servingResourceLoader';
import { instanceAs } from '../testing/reactThreeTestInstance';
import type { MeshInstance3DProperties } from './types';
import { meshInstanceNode, renderMeshInstance } from './testing/renderMeshInstance';

async function render(overrides?: Partial<MeshInstance3DProperties>, materialData?: Record<string, string>) {
  const materials = materialData ? [subResource('StandardMaterial3D', 'Mat', materialData)] : [];
  return renderMeshInstance({
    loader: loaderServing(),
    node: meshInstanceNode({ mesh: 'SubResource("Points")' }, overrides),
    internalResources: [subResource('PointMesh', 'Points', {}), ...materials],
  });
}

/** The point size, in pixels, the one THREE.Points draws with. */
async function drawnPointSize(
  materialData?: Record<string, string>,
  overrides?: Partial<MeshInstance3DProperties>
): Promise<unknown> {
  const renderer = await render(overrides, materialData);
  const points = instanceAs<THREE.Points>(renderer.scene.findByType('Points'));
  return (points.material as THREE.Material).userData.godotPointSize;
}

const OVERRIDE_MAT = { surfaceMaterialOverrides: new Map([[0, 'SubResource("Mat")']]) };

describe('MeshInstance3D with a PointMesh', () => {
  it('draws one THREE.Points at the origin', async () => {
    const renderer = await render();
    const points = instanceAs<THREE.Points>(renderer.scene.findByType('Points'));
    expect(Array.from(points.geometry.getAttribute('position').array)).toEqual([0, 0, 0]);
  });

  // Godot rasterises a point into its shadow map, at the point size.
  it('casts a shadow, as a mesh of the default cast_shadow does', async () => {
    const renderer = await render();
    expect(instanceAs<THREE.Points>(renderer.scene.findByType('Points')).castShadow).toBe(true);
  });

  it('draws no triangle mesh and no placeholder box', async () => {
    const renderer = await render();
    expect(renderer.scene.findAllByType('Mesh')).toEqual([]);
  });
});

describe('MeshInstance3D with a PointMesh: point size', () => {
  // `scene_forward_clustered.glsl:446`: a shader that writes no POINT_SIZE draws 1 px.
  it('draws 1 px with no material', async () => {
    expect(await drawnPointSize()).toBe(1);
  });

  it("draws the material's point_size under use_point_size", async () => {
    expect(await drawnPointSize({ use_point_size: 'true', point_size: '20' }, OVERRIDE_MAT)).toBe(20);
  });

  it('draws 1 px when the material sets point_size without use_point_size', async () => {
    expect(await drawnPointSize({ point_size: '20' }, OVERRIDE_MAT)).toBe(1);
  });

  it('sizes an unshaded material too', async () => {
    const unshaded = { shading_mode: '0', use_point_size: 'true', point_size: '8' };
    expect(await drawnPointSize(unshaded, OVERRIDE_MAT)).toBe(8);
  });

  it('sizes the material_override in front of the mesh surface', async () => {
    const size = await drawnPointSize(
      { use_point_size: 'true', point_size: '5' },
      { materialOverride: 'SubResource("Mat")' }
    );
    expect(size).toBe(5);
  });
});

describe('MeshInstance3D with a PointMesh: material_overlay', () => {
  // Godot draws the overlay on every surface, so a point gets a second, overlay-sized point.
  it('draws the overlay as a second THREE.Points of its own size', async () => {
    const renderer = await render(
      { materialOverlay: 'SubResource("Mat")' },
      { use_point_size: 'true', point_size: '14' }
    );
    const sizes = renderer.scene
      .findAllByType('Points')
      .map((points) => (instanceAs<THREE.Points>(points).material as THREE.Material).userData.godotPointSize);
    expect(sizes).toEqual([1, 14]);
  });
});
