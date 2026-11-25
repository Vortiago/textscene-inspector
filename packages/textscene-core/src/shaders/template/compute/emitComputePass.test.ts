import { describe, expect, it } from 'vitest';
import type { Node } from 'three/webgpu';
import { generatedFragmentShader } from '../../generatedShader.testkit.js';
import { computePasses } from './computePasses.js';
import { computeStage } from './computeStage.js';
import { emitComputePass } from './emitComputePass.js';

/** The draw of the downsampler's one pass, with its fragment shader built. */
function downsampler() {
  const [pass] = computePasses(computeStage('effects/octmap_downsampler.glsl', ''));
  const draw = emitComputePass(pass!);
  const shader = generatedFragmentShader(
    (draw.mesh.material as unknown as { fragmentNode: Node }).fragmentNode
  );
  return { draw, shader };
}

describe('emitComputePass', () => {
  it("binds the downsampler's combined sampler and push constants by their template names", () => {
    const { draw } = downsampler();
    expect([...draw.textures.keys()]).toEqual(['source_octmap']);
    expect([...draw.uniforms.keys()]).toEqual(expect.arrayContaining(['params.border_size', 'params.size']));
  });

  it('discards a fragment whose invocation stores nothing', () => {
    expect(downsampler().shader).toContain('discard');
  });

  it("reads a render target's rows in the order a pass stores them, without three's WebGL flip", () => {
    const { draw } = downsampler();
    const source = draw.textures.get('source_octmap') as unknown as {
      _flipYUniform: { value: boolean; updateType: string };
    };

    expect([source._flipYUniform.value, source._flipYUniform.updateType]).toEqual([false, 'none']);
  });
});
