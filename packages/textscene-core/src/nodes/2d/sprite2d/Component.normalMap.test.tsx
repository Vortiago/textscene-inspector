/**
 * A Sprite2D whose texture is a CanvasTexture: it draws the diffuse texture, declares itself
 * normal-mapped while the CanvasTexture names a normal map, and samples every map with the
 * CanvasTexture's own filter where it names one (`texture_storage.cpp:737`).
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import './index';
import { Sprite2D } from './Component';
import { parsedNode } from '../../../parser/testing/parserKit';
import {
  CANVAS_TEXTURE_REF,
  FLAT_GREY_REF,
  canvasTexture,
  renderLitItem,
} from '../../../r3f/testing/canvasTextureLighting';
import type { TscnInternalResource } from '../../../parser/types';

function render(wrapper: TscnInternalResource) {
  const sprite = parsedNode({ type: 'Sprite2D', name: 'S' }, { texture: CANVAS_TEXTURE_REF });
  return renderLitItem(<Sprite2D node={sprite} />, [wrapper]);
}

describe('Sprite2D with a CanvasTexture', () => {
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
