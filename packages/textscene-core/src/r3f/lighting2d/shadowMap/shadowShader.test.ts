import { describe, expect, it } from 'vitest';
import { DIRECTIONAL_LOOKUP, POLAR_LOOKUP, SHADOWED_LIGHT_GLSL, shadowSampleGlsl } from './shadowShader';

/** GLSL compares equal whatever its layout. */
function collapsed(glsl: string): string {
  return glsl.replace(/\s+/g, ' ').trim();
}

/** The bins and taps both sample blocks shared before one join owned them. */
const BINS = `
uniform float uShadowBins;
float shadowBins() { return uShadowBins; }
`;

const TAPS = `
uniform float uShadowSmooth;
float textureShadow(float u, float depth) {
  float scaled = u * shadowBins();
  float texel = floor(scaled);
  return mix(step(shadowTexel(texel - 1.0), depth), step(shadowTexel(texel), depth), scaled - texel);
}
float shadowTaps(float u, float depth) {
#if SHADOW_FILTER == 0
  return step(shadowTexel(floor(u * shadowBins())), depth);
#else
#if SHADOW_FILTER == 2
  const int reach = 6;
#else
  const int reach = 2;
#endif
  float tapStep = (1.0 + uShadowSmooth) / shadowBins();
  float shadow = 0.0;
  for (int tap = -reach; tap <= reach; tap++) shadow += textureShadow(u + tapStep * float(tap), depth);
  return shadow / float(2 * reach + 1);
#endif
}
`;

/** The PointLight2D's sample block as `lightQuadShaders.ts` wrote it out by hand. */
const POLAR_SAMPLE = `
uniform sampler2D uShadowMap;
uniform mat3 uWorldToLight;
uniform float uShadowZFarInv;
varying vec2 vWorld;
${BINS}
// Godot also quantises the row by 1/shadow_pixel_size (canvas.glsl:394,508), so below size 512
// with two shadowed lights a light reads another's row. Not modelled: each light has its own map.
float shadowTexel(float texel) {
  return texture2D(uShadowMap, vec2((texel + 0.5) / shadowBins(), 0.5)).r;
}
${TAPS}
float shadowFraction() {
  // Godot states the quadrant rule in its own Y-DOWN canvas space. The previewer renders the 2D
  // subtree conjugated by diag(1, -1), so the light-local point flips back before the mapping.
  vec2 local = (uWorldToLight * vec3(vWorld, 1.0)).xy;
  vec2 shadow_pos = vec2(local.x, -local.y);
  vec2 pos_norm = normalize(shadow_pos);
  vec2 pos_abs = abs(pos_norm);
  vec2 pos_box = pos_norm / max(pos_abs.x, pos_abs.y);
  vec2 pos_rot = pos_norm * mat2(vec2(0.7071067811865476, -0.7071067811865476), vec2(0.7071067811865476, 0.7071067811865476));
  float tex_ofs;
  float dist;
  if (pos_rot.y > 0.0) {
    if (pos_rot.x > 0.0) {
      tex_ofs = pos_box.y * 0.125 + 0.125;
      dist = shadow_pos.x;
    } else {
      tex_ofs = pos_box.x * -0.125 + (0.25 + 0.125);
      dist = shadow_pos.y;
    }
  } else {
    if (pos_rot.x < 0.0) {
      tex_ofs = pos_box.y * -0.125 + (0.5 + 0.125);
      dist = -shadow_pos.x;
    } else {
      tex_ofs = pos_box.x * 0.125 + (0.75 + 0.125);
      dist = -shadow_pos.y;
    }
  }
  return shadowTaps(tex_ofs, dist * uShadowZFarInv);
}
`;

/** The DirectionalLight2D's sample block as `directionalLightQuad.ts` wrote it out by hand. */
const DIRECTIONAL_SAMPLE = `
uniform sampler2D uShadowMap;
varying vec2 vShadow;
${BINS}
// An empty bin never shadows. The camera can show past the viewport's far edge, where depth
// exceeds SHADOW_MAP_FAR, and a bin left at SHADOW_MAP_FAR would shadow all of it.
float shadowTexel(float texel) {
  float binDepth = texture2D(uShadowMap, vec2((clamp(texel, 0.0, shadowBins() - 1.0) + 0.5) / shadowBins(), 0.5)).r;
  return binDepth >= float(1) ? 1e30 : binDepth;
}
${TAPS}
float shadowFraction() {
  return shadowTaps(vShadow.x, vShadow.y);
}
`;

describe('shadowSampleGlsl', () => {
  it.each([
    ['polar', POLAR_LOOKUP],
    ['directional', DIRECTIONAL_LOOKUP],
  ])('declares the %s bins before the texel rule, and the texel rule before the taps', (_kind, lookup) => {
    const glsl = shadowSampleGlsl(lookup);
    const bins = glsl.indexOf('float shadowBins()');
    const texel = glsl.indexOf('float shadowTexel(');
    const taps = glsl.indexOf('float shadowTaps(');
    expect(bins).toBeGreaterThanOrEqual(0);
    expect(texel).toBeGreaterThan(bins);
    expect(taps).toBeGreaterThan(texel);
  });

  it('joins the polar lookup into the block the PointLight2D sampled with', () => {
    expect(collapsed(shadowSampleGlsl(POLAR_LOOKUP))).toBe(collapsed(POLAR_SAMPLE));
  });

  it('joins the directional lookup into the block the DirectionalLight2D sampled with', () => {
    expect(collapsed(shadowSampleGlsl(DIRECTIONAL_LOOKUP))).toBe(collapsed(DIRECTIONAL_SAMPLE));
  });
});

describe('SHADOWED_LIGHT_GLSL', () => {
  it('scales the light by the lit fraction last, so the float result keeps its rounding', () => {
    expect(SHADOWED_LIGHT_GLSL).toContain('vec4(rgb * lit, alpha)');
  });

  it("puts the shadow_color under the light's whole alpha", () => {
    expect(collapsed(SHADOWED_LIGHT_GLSL)).toContain(
      collapsed(`float alpha = a * (lit + s * uShadowColor.a);
  writeLight(vec4(rgb * lit, alpha), vec4(uShadowColor.rgb * s, alpha));`)
    );
  });
});

/** The taps against renderer_rd's `light_shadow_compute` (`canvas.glsl:507-535`). The goldens pin the pixels. */
describe('the taps of a sample block', () => {
  const glsl = shadowSampleGlsl(DIRECTIONAL_LOOKUP);

  it('takes one nearest bin under NONE, floored by the canvas-wide bin and not the smoothed one', () => {
    // `canvas.glsl:508`: `floor(shadow_uv.xy / canvas_data.shadow_pixel_size)`, so a fragment lit on
    // the exact ray reads as shadowed when its bin lies behind the occluder.
    expect(glsl).toContain('return step(shadowTexel(floor(u * shadowBins())), depth);');
  });

  it('reads the atlas size from the map it samples, never a baked number', () => {
    expect(glsl).toContain('float shadowBins() { return uShadowBins; }');
    expect(glsl).not.toContain('2048');
  });

  it('steps a PCF tap by `(1 + shadow_filter_smooth) / shadow_texture_size` (`:629`)', () => {
    expect(glsl).toContain('float tapStep = (1.0 + uShadowSmooth) / shadowBins();');
  });

  it('mixes the steps of bins i−1 and i by the fraction past bin i in each PCF tap', () => {
    // `textureGather(...).zw` at the floored texel corner is (bin i, bin i−1).
    expect(glsl).toContain(
      'mix(step(shadowTexel(texel - 1.0), depth), step(shadowTexel(texel), depth), scaled - texel)'
    );
  });

  it('spreads PCF13 over thirteen taps and PCF5 over five, each one smoothed bin apart', () => {
    expect(glsl).toContain('#if SHADOW_FILTER == 2\n  const int reach = 6;\n#else\n  const int reach = 2;');
    expect(glsl).toContain(
      'for (int tap = -reach; tap <= reach; tap++) shadow += textureShadow(u + tapStep * float(tap), depth);\n  return shadow / float(2 * reach + 1);'
    );
  });
});
