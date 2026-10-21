import { describe, expect, it } from 'vitest';
import { glowOn } from './testing/glowParams';
import { firstLevelBlurGlsl, glowGatherGlsl, glowLevelUniform, laterLevelBlurGlsl } from './godotGlowPyramid';

const blurs = () => {
  const first = firstLevelBlurGlsl(glowOn());
  const later = laterLevelBlurGlsl(glowOn());
  return [first.horizontal, first.vertical, later.horizontal, later.vertical];
};

describe('the glow blur kernel', () => {
  it("is Godot's five-weight gaussian, read as nine taps, on every pass (copy.glsl:124-181)", () => {
    // `copy.glsl:116`, under `MODE_GLOW`: the centre and four either side.
    for (const glsl of blurs()) {
      expect(glsl).toContain('0.2024, 0.179, 0.124, 0.0672, 0.0285');
      expect(glsl).toContain('for (int tap = 1; tap <= 4; tap++)');
    }
  });

  it('loads each tap through the pair rule of the 2x2 cache, not a plain clamp', () => {
    // `copy.glsl:99-105`: an even pixel is clamped to `size - 2` and its odd partner reads one
    // on, so past either edge the taps alternate between the two outermost pixels.
    const glsl = laterLevelBlurGlsl(glowOn()).horizontal;
    expect(glsl).toContain('int godotGlowEdge(int pixel, int size)');
    expect(glsl).toContain('clamp(pixel - (pixel & 1), 0, max(size - 2, 0)) + (pixel & 1)');
  });

  it('maps rows through the pair rule only in the vertical pass, on rows counted from the top', () => {
    // Godot's cache holds a row's blurred colour under the row it nominally stands for, and the
    // vertical pass reads the rows the rule maps to. Mapping rows in the horizontal pass too
    // would map them twice, which the rule does not survive for a level of odd height.
    expect(laterLevelBlurGlsl(glowOn()).horizontal).toContain(
      'ivec2(godotGlowEdge(pixel.x, size.x), pixel.y)'
    );
    const glsl = laterLevelBlurGlsl(glowOn()).vertical;
    expect(glsl).toContain('clamp(rows - 1 - godotGlowEdge(rows - 1 - row, rows), 0, rows - 1)');
  });

  it('samples the source bilinearly at the pixel centre, so a 2x reduction is a 2x2 box', () => {
    expect(laterLevelBlurGlsl(glowOn()).horizontal).toContain('(vec2(edge) + 0.5) / vec2(size)');
  });

  it('runs the vertical pass over the horizontal result at the same edge rule', () => {
    const glsl = laterLevelBlurGlsl(glowOn()).vertical;
    expect(glsl).toContain('int godotGlowEdge(int pixel, int size)');
    expect(glsl).toContain('texelFetch(blurredBuffer, ivec2(pixel.x, godotGlowRowEdge(pixel.y + offset');
  });
});

describe('the first glow level', () => {
  it('weights each source sample against fireflies before the blur (copy.glsl:108-114)', () => {
    // Default luminance cap 12: `max(cap, 6)` is 12.
    expect(firstLevelBlurGlsl(glowOn()).horizontal).toContain('vec3(0.299, 0.587, 0.114) / 12.0');
    expect(laterLevelBlurGlsl(glowOn()).horizontal).not.toContain('0.299');
  });

  it('floors the firefly divisor at 6 for a small luminance cap', () => {
    const glsl = firstLevelBlurGlsl(glowOn({ glow_hdr_luminance_cap: '2' })).horizontal;
    expect(glsl).toContain('vec3(0.299, 0.587, 0.114) / 6.0');
  });

  it('undoes the firefly weight, then runs the bright pass with strength and exposure (copy.glsl:183-200)', () => {
    const glsl = firstLevelBlurGlsl(glowOn({ glow_strength: '1.5', tonemap_exposure: '2' })).vertical;
    const main = glsl.slice(glsl.indexOf('void main()'));
    expect(main.indexOf('/ (1.0 - dot(')).toBeGreaterThan(-1);
    expect(main.indexOf('godotGlowBrightPass(color)')).toBeGreaterThan(main.indexOf('/ (1.0 - dot('));
    expect(glsl).toContain('color *= 1.5;');
    expect(glsl).toContain('color *= 2.0;');
  });
});

describe('the later glow levels', () => {
  it('multiply by glow_strength after the blur and nothing else (copy.glsl:188)', () => {
    const glsl = laterLevelBlurGlsl(glowOn({ glow_strength: '1.5' })).vertical;
    expect(glsl).toContain('color *= 1.5;');
    expect(glsl).not.toContain('smoothstep(');
    expect(glsl).not.toContain('0.299');
  });
});

describe('glowGatherGlsl', () => {
  it('sums each gathered level at its own weight and no other', () => {
    const glsl = glowGatherGlsl(glowOn());
    expect(glsl).toContain(`godotGlowBicubic(${glowLevelUniform(1)}, uv) * 0.8`);
    expect(glsl).toContain(`godotGlowBicubic(${glowLevelUniform(2)}, uv) * 0.4`);
    expect(glsl).toContain(`godotGlowBicubic(${glowLevelUniform(3)}, uv) * 0.1`);
    expect(glsl).not.toContain(glowLevelUniform(0));
    expect(glsl).not.toContain(glowLevelUniform(4));
  });

  it("samples with Godot's cubic B-spline, fetching four bilinear texels (tonemap.glsl:271-338)", () => {
    const glsl = glowGatherGlsl(glowOn());
    expect(glsl).toContain('( 1.0 / 6.0 ) * ( a * a * a )');
    expect(glsl).toContain('vec2 size = vec2(textureSize(tex, 0));');
    expect(glsl).toContain('uv * size + 0.5');
    expect(glsl.match(/texture2D\(tex, p[0-3]\)/g)).toHaveLength(4);
  });
});

describe('glowGatherGlsl under the Linear upscale mode', () => {
  const linear = () => glowGatherGlsl({ ...glowOn(), usesBicubicUpscale: false });

  it('reads each level with one bilinear fetch, as tonemap.glsl:366-374 does', () => {
    const glsl = linear();
    expect(glsl).toContain(`godotGlowLinear(${glowLevelUniform(1)}, uv) * 0.8`);
    expect(glsl).toContain(`godotGlowLinear(${glowLevelUniform(3)}, uv) * 0.1`);
  });

  it('declares no cubic spline code the shader would not run', () => {
    expect(linear()).not.toContain('godotGlowBicubic');
    expect(linear()).not.toContain('godotGlowW0');
  });
});
