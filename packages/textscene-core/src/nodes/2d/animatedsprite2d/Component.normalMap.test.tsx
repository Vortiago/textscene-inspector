/**
 * An AnimatedSprite2D whose frame is a CanvasTexture: it declares itself normal-mapped while the
 * drawn frame's CanvasTexture names a normal map (`canvas.glsl:652-665`), and samples with the
 * CanvasTexture's own filter where it names one (`texture_storage.cpp:737`).
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import './index';
import { AnimatedSprite2D } from './Component';
import { parsedNode } from '../../../parser/testing/parserKit';
import { subResource } from '../../../testing/subResource';
import {
  CANVAS_TEXTURE_REF,
  FLAT_GREY_REF,
  canvasTexture,
  renderLitItem,
} from '../../../r3f/testing/canvasTextureLighting';
import type { TscnInternalResource } from '../../../parser/types';

const SPRITE_FRAMES = subResource('SpriteFrames', 'sf', {
  animations: `[{"frames": [{"duration": 1.0, "texture": ${CANVAS_TEXTURE_REF}}], "loop": true, "name": &"default", "speed": 5.0}]`,
});

function render(wrapper: TscnInternalResource) {
  const sprite = parsedNode({ type: 'AnimatedSprite2D', name: 'A' }, { sprite_frames: 'SubResource("sf")' });
  return renderLitItem(<AnimatedSprite2D node={sprite} />, [SPRITE_FRAMES, wrapper]);
}

describe('AnimatedSprite2D with a CanvasTexture frame', () => {
  it("declares itself normal-mapped while the frame's CanvasTexture names a normal map", async () => {
    const { registerItem } = await render(canvasTexture({ normal_texture: FLAT_GREY_REF }));
    expect(registerItem).toHaveBeenLastCalledWith(expect.anything(), 'apart');
  });

  it("declares no normal map while the frame's CanvasTexture names none", async () => {
    const { registerItem } = await render(canvasTexture({}));
    expect(registerItem).toHaveBeenLastCalledWith(expect.anything(), 'plain');
  });

  it("samples the frame with the CanvasTexture's own filter", async () => {
    const { map } = await render(canvasTexture({ texture_filter: '1' }));
    expect([map.magFilter, map.minFilter]).toEqual([THREE.NearestFilter, THREE.NearestFilter]);
  });
});
