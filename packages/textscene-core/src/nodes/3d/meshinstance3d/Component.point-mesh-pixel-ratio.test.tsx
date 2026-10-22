/** A point's size is in Godot's viewport pixels, so a canvas of pixel ratio 2 draws it twice as wide. */

import { describe, expect, it, vi } from 'vitest';
import type * as THREE from 'three';
import { subResource } from '../../../testing/subResource';
import { loaderServing } from '../../../resources/testing/servingResourceLoader';
import { instanceAs } from '../testing/reactThreeTestInstance';
import { meshInstanceNode, renderMeshInstance } from './testing/renderMeshInstance';

vi.mock('@react-three/fiber', async (importOriginal) => {
  const fiber = await importOriginal<typeof import('@react-three/fiber')>();
  const useThree: typeof fiber.useThree = (selector?: unknown) =>
    fiber.useThree((state) => {
      const atRatio2 = { ...state, viewport: { ...state.viewport, dpr: 2 } };
      return typeof selector === 'function' ? selector(atRatio2) : atRatio2;
    });
  return { ...fiber, useThree };
});

describe('MeshInstance3D with a PointMesh on a canvas of pixel ratio 2', () => {
  it('records the pixel ratio beside point_size, for the colour pass to draw twice over', async () => {
    const renderer = await renderMeshInstance({
      loader: loaderServing(),
      node: meshInstanceNode({
        mesh: 'SubResource("Points")',
        surfaceOverrides: new Map([[0, 'SubResource("Mat")']]),
      }),
      internalResources: [
        subResource('PointMesh', 'Points', {}),
        subResource('StandardMaterial3D', 'Mat', { use_point_size: 'true', point_size: '20' }),
      ],
    });
    const points = instanceAs<THREE.Points>(renderer.scene.findByType('Points'));
    expect((points.material as THREE.Material).userData).toMatchObject({
      godotPointSize: 20,
      godotPointPixelRatio: 2,
    });
  });
});
