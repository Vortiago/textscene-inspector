import { describe, expect, it } from 'vitest';
import { parseTemplateStage } from '../parseTemplate.js';
import { preprocess } from '../preprocess.js';
import { printTemplateStage } from '../printTemplate.js';
import { variantLines } from '../variant.js';
import { computePasses } from './computePasses.js';
import { computeStage } from './computeStage.js';

const NO_DEFINES = { general: '', variant: '', custom: [], hasUniforms: false, codeSections: [] };

/** The compute stage of `text`, which declares two images and a `main`. */
function stageOf(main: string, globals = '') {
  const text = [
    'layout(local_size_x = 8, local_size_y = 8) in;',
    'layout(rgba16f) uniform restrict writeonly image2D first;',
    'layout(rgba16f) uniform restrict writeonly image2D second;',
    globals,
    `void main() {\n${main}\n}`,
  ].join('\n');
  const lines = text.split('\n').map((line, index) => ({ text: line, file: 't.glsl', line: index + 1 }));
  return parseTemplateStage('compute', preprocess(variantLines(lines, NO_DEFINES)));
}

const mainText = (stage: ReturnType<typeof stageOf>) => printTemplateStage(stage).split('void main()')[1]!;

describe('computePasses', () => {
  it('draws one pass into each image the stage stores into', () => {
    const stage = stageOf(
      'uvec2 id = gl_GlobalInvocationID.xy;\nimageStore(first, ivec2(id), vec4(1.0));\nimageStore(second, ivec2(id), vec4(2.0));'
    );
    expect(computePasses(stage).map((pass) => pass.target)).toEqual([
      { kind: 'image', name: 'first' },
      { kind: 'image', name: 'second' },
    ]);
  });

  it("leaves a pass's stored value in compute_color and drops the stores into other images", () => {
    const stage = stageOf(
      'uvec2 id = gl_GlobalInvocationID.xy;\nimageStore(first, ivec2(id), vec4(1.0));\nimageStore(second, ivec2(id), vec4(2.0));'
    );
    const text = mainText(computePasses(stage)[0]!.stage);
    expect(text).toContain('(compute_color = vec4(1.0));');
    expect(text).not.toContain('imageStore');
    expect(text).not.toContain('vec4(2.0)');
  });

  it('discards a fragment whose invocation stores nothing', () => {
    const stage = stageOf(
      'uvec2 id = gl_GlobalInvocationID.xy;\nif (id.x < 4u) {\nimageStore(first, ivec2(id), vec4(1.0));\n}'
    );
    expect(mainText(computePasses(stage)[0]!.stage)).toMatch(/if \(!\(lowered_stored_1\)\) \{\s*discard;/);
  });

  it('refuses a store at a texel other than the invocation', () => {
    const stage = stageOf(
      'uvec2 id = gl_GlobalInvocationID.xy;\nimageStore(first, ivec2(id) + ivec2(1, 0), vec4(1.0));'
    );
    expect(() => computePasses(stage)).toThrow(
      'expected an imageStore at ivec2(gl_GlobalInvocationID.xy), at line 7'
    );
  });

  it('refuses a vertex stage', () => {
    const lines = [{ text: 'void main() {}', file: 't.glsl', line: 1 }];
    const vertex = parseTemplateStage('vertex', preprocess(variantLines(lines, NO_DEFINES)));
    expect(() => computePasses(vertex)).toThrow('expected a compute stage, got a vertex stage');
  });

  it("lowers Godot's octmap downsampler into one pass over its destination", () => {
    const passes = computePasses(computeStage('effects/octmap_downsampler.glsl', ''));
    expect(passes.map((pass) => pass.target)).toEqual([{ kind: 'image', name: 'dest_octmap' }]);
  });

  it("fills Godot's GGX samples of octmap_roughness once, then draws its destination from them", () => {
    const passes = computePasses(computeStage('effects/octmap_roughness.glsl', ''));
    expect(passes.map((pass) => pass.target)).toEqual([
      { kind: 'shared', array: { name: 'samples', elementType: 'vec4', length: 256 } },
      { kind: 'image', name: 'dest_octmap' },
    ]);
  });

  it('reads a shared array after its fill as a texel of its texture', () => {
    const passes = computePasses(computeStage('effects/octmap_roughness.glsl', ''));
    const text = mainText(passes[1]!.stage);
    expect(text).toContain('texelFetch(compute_shared_samples, ivec2(int(i), 0), 0)');
    expect(text).not.toMatch(/samples\[/);
  });

  it('runs a fill over the invocations of one group and keeps the value written at its entry', () => {
    const text = mainText(computePasses(computeStage('effects/octmap_roughness.glsl', ''))[0]!.stage);
    expect(text).toContain('uint gl_LocalInvocationIndex = lowered_invocation_1;');
    expect(text).toMatch(/if \(\(int\(sample_idx\) == compute_entry\)\)/);
    expect(text).not.toContain('imageStore');
  });

  it('refuses a shared array whose content differs by group', () => {
    const stage = stageOf(
      'uvec2 id = gl_GlobalInvocationID.xy;\ncache[gl_LocalInvocationIndex] = vec4(float(id.x));\nbarrier();\nimageStore(first, ivec2(id), cache[0]);',
      'shared vec4 cache[64];'
    );
    expect(() => computePasses(stage)).toThrow(
      'expected the shared array cache to fill the same in every group'
    );
  });
});
