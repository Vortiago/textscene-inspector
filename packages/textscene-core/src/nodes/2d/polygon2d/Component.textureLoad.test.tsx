/**
 * A Polygon2D whose texture is set draws untextured when the texture fails, as Godot does: the text
 * loader leaves a node property that names a missing file null (`resource_format_text.cpp:146-154`,
 * `:288-289`). It draws nothing while the texture arrives.
 */
import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { Polygon2D } from './Component';
import { parsePolygon2D } from './parser';
import { heading } from '../../../parser/testing/parserKit';
import type { TscnNode } from '../../../parser/types';
import {
  placeholderMeshes,
  renderWithTexture,
  TEXTURE_REFERENCE,
} from '../../../r3f/canvasMesh/textureLoadStates.testkit';

const TEXTURED: TscnNode = {
  rawProperties: {},
  name: 'Poly',
  type: 'Polygon2D',
  children: [],
  properties: parsePolygon2D(heading('Polygon2D', { name: 'Poly' }), {
    polygon: 'PackedVector2Array(0, 0, 64, 0, 64, 64, 0, 64)',
    texture: TEXTURE_REFERENCE,
  }),
};

describe('Polygon2D with a texture that does not load', () => {
  it('draws the untextured fill for a texture that fails, as for no texture', async () => {
    const { renderer } = await renderWithTexture(<Polygon2D node={TEXTURED} />, 'failed');

    expect(placeholderMeshes(renderer)).toHaveLength(0);
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes).toHaveLength(1);
    expect(
      (meshes[0]!.instance as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.map
    ).toBeNull();
  });

  it('draws nothing while the texture arrives', async () => {
    const { renderer } = await renderWithTexture(<Polygon2D node={TEXTURED} />, 'arriving');

    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });
});
