/**
 * `light_compute` and `quick_hash` of the port map, read on the GLSL three generates for them: the
 * operations in Godot's order (Godot 4.6.3 `scene_forward_lights_inc.glsl`).
 */

import { describe, expect, it } from 'vitest';
import { float, uv, vec3, vec4 } from 'three/tsl';
import { DiffuseMode } from '../godot/rendering/materials/diffuseMode.js';
import { SpecularMode } from '../godot/rendering/materials/specularMode.js';
import { generatedFragmentShader } from './generatedShader.testkit.js';
import { lightCompute, quickHash, type LightTerms, type LitSurfaceTerms } from './lightFunctions.js';
import type { FloatNode, Vec3Node } from './nodeTypes.js';

/** Inputs that vary per fragment, so the builder folds no constant. */
const x = (): FloatNode => uv().x;
const y = (): FloatNode => uv().y;
const direction = (): Vec3Node => vec3(uv(), 1).normalize();

function shaderOfFloat(node: FloatNode): string {
  return generatedFragmentShader(vec4(vec3(node), 1));
}

function shaderOfColour(node: Vec3Node): string {
  return generatedFragmentShader(vec4(node, 1));
}

describe('lightCompute', () => {
  function surface(overrides: Partial<LitSurfaceTerms> = {}): LitSurfaceTerms {
    return {
      N: direction(),
      V: direction(),
      f0: vec3(0.04),
      roughness: x(),
      metallic: y(),
      albedo: vec3(uv(), 0),
      energyCompensation: vec3(1),
      diffuseMode: DiffuseMode.DIFFUSE_BURLEY,
      specularMode: SpecularMode.SPECULAR_SCHLICK_GGX,
      ...overrides,
    };
  }

  const sun = (): LightTerms => ({
    L: direction(),
    A: float(0),
    color: vec3(1),
    attenuation: x(),
    specularAmount: y(),
    isDirectional: true,
  });

  const sumsShader = (terms: LitSurfaceTerms) => {
    const { diffuse, specular } = lightCompute(terms, sun());
    return shaderOfColour(diffuse.add(specular));
  };

  it('takes f90 from F0 at 50 times 0.33', () => {
    expect(sumsShader(surface())).toContain('vec3( 16.5, 16.5, 16.5 )');
  });

  it('draws no specular at roughness 0 and no diffuse on a full metal', () => {
    const shader = sumsShader(surface());

    expect(shader).toMatch(/if \( \( \w+\.x > 0\.0 \) \)/);
    expect(shader).toMatch(/if \( \( \w+\.y < 1\.0 \) \)/);
  });

  it('writes the toon specular into the diffuse', () => {
    const { specular } = lightCompute(surface({ specularMode: SpecularMode.SPECULAR_TOON }), sun());

    expect(shaderOfColour(specular)).not.toContain('smoothstep');
  });

  it('adds the rim, the backlight and the transmittance only when the surface has them', () => {
    const plain = sumsShader(surface());
    const full = sumsShader(
      surface({
        rim: { amount: x(), tint: y() },
        backlight: vec3(uv(), 0),
        transmittance: { color: vec4(1), depth: x(), boost: y(), z: x(), isSkin: false },
      })
    );

    expect(plain).not.toContain('pow( max( 0.0001');
    expect(full).toContain('pow( max( 0.0001');
    expect(full).toContain('8.25');
  });

  it('adds the clearcoat’s lobe to the specular', () => {
    const coat = { amount: x(), roughness: y(), vertexNormal: direction() };

    expect(sumsShader(surface({ clearcoat: coat }))).toContain('mix( 0.001, 0.1');
  });
});

describe('quickHash', () => {
  it('takes the fraction of 52.98 times the fraction of the dot with Godot’s magic', () => {
    const shader = shaderOfFloat(quickHash(uv()));

    expect(shader).toMatch(
      /fract\( \( fract\( dot\( \w+, vec2\( 0\.06711056, 0\.00583715 \) \) \) \* 52\.9829189 \) \)/
    );
  });
});
