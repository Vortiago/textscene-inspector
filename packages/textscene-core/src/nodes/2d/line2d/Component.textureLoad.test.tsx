/**
 * A Line2D whose texture is set draws untextured when the texture fails, as Godot does: the text
 * loader leaves a node property that names a missing file null (`resource_format_text.cpp:146-154`,
 * `:288-289`). It draws nothing while the texture arrives.
 */
import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { Line2D } from './Component';
import { parseLine2D } from './parser';
import { heading } from '../../../parser/testing/parserKit';
import type { TscnNode } from '../../../parser/types';
import {
  placeholderMeshes,
  renderWithTexture,
  TEXTURE_REFERENCE,
} from '../../../r3f/canvasMesh/textureLoadStates.testkit';

const TEXTURED: TscnNode = {
  rawProperties: {},
  name: 'Line',
  type: 'Line2D',
  children: [],
  properties: parseLine2D(heading('Line2D', { name: 'Line' }), {
    points: 'PackedVector2Array(0, 0, 64, 0)',
    width: '16.0',
    texture: TEXTURE_REFERENCE,
  }),
};

describe('Line2D with a texture that does not load', () => {
  it('draws the untextured fill for a texture that fails, as for no texture', async () => {
    const { renderer } = await renderWithTexture(<Line2D node={TEXTURED} />, 'failed');

    expect(placeholderMeshes(renderer)).toHaveLength(0);
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes).toHaveLength(1);
    expect(
      (meshes[0]!.instance as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.map
    ).toBeNull();
  });

  it('draws nothing while the texture arrives', async () => {
    const { renderer } = await renderWithTexture(<Line2D node={TEXTURED} />, 'arriving');

    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });
});
