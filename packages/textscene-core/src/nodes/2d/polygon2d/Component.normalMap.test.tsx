/**
 * A Polygon2D whose texture is a CanvasTexture: it declares itself normal-mapped while the
 * CanvasTexture names a normal map (`canvas.glsl:652-665`), and samples with the CanvasTexture's own
 * filter where it names one (`texture_storage.cpp:737`).
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { parsePolygon2D } from './parser';
import { Polygon2D } from './Component';
import {
  CANVAS_TEXTURE_REF,
  FLAT_GREY_REF,
  canvasTexture,
  renderLitItem,
} from '../../../r3f/testing/canvasTextureLighting';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';

function polygon(): TscnNode {
  const heading = { type: 'node', attributes: { type: 'Polygon2D', name: 'P' } };
  return {
    rawProperties: {},
    name: 'P',
    type: 'Polygon2D',
    children: [],
    properties: parsePolygon2D(heading, {
      texture: CANVAS_TEXTURE_REF,
      polygon: 'PackedVector2Array(-4, -4, 4, -4, 4, 4, -4, 4)',
    }),
  };
}

async function render(wrapper: TscnInternalResource) {
  const { renderer, registerItem } = await renderLitItem(<Polygon2D node={polygon()} />, [wrapper]);
  const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
  return { registerItem, map: (mesh.material as THREE.MeshBasicMaterial).map! };
}

describe('Polygon2D with a CanvasTexture', () => {
  it('declares itself normal-mapped while the CanvasTexture names a normal map', async () => {
    const { registerItem } = await render(canvasTexture({ normal_texture: FLAT_GREY_REF }));
    expect(registerItem).toHaveBeenLastCalledWith(expect.anything(), 'apart');
  });

  it('declares no normal map while the CanvasTexture names none', async () => {
    const { registerItem } = await render(canvasTexture({}));
    expect(registerItem).toHaveBeenLastCalledWith(expect.anything(), 'plain');
  });

  it("samples the diffuse with the CanvasTexture's own filter", async () => {
    const { map } = await render(canvasTexture({ texture_filter: '1' }));
    expect([map.magFilter, map.minFilter]).toEqual([THREE.NearestFilter, THREE.NearestFilter]);
  });
});
