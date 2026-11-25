import { describe, expect, it } from 'vitest';
import { DataTexture } from 'three';
import { float, texture, vec2, vec4 } from 'three/tsl';
import type { Node, TextureNode } from 'three/webgpu';
import { generatedFragmentShader } from '../generatedShader.testkit.js';
import { comparedTextureOf } from './comparedTextures.js';

describe('comparedTextureOf', () => {
  it("reads the atlas's rows in the order a pass stores them, without three's WebGL flip", () => {
    const template = texture(new DataTexture(new Uint8Array(4), 1, 1)) as unknown as TextureNode;
    const twin = comparedTextureOf(template);
    generatedFragmentShader(
      vec4(twin.sample(vec2(0.25, 0.75)).compare(float(0.5) as never) as never) as unknown as Node
    );

    const flip = (twin as unknown as { _flipYUniform: { value: boolean; updateType: string } })._flipYUniform;
    expect([flip.value, flip.updateType]).toEqual([false, 'none']);
  });
});
