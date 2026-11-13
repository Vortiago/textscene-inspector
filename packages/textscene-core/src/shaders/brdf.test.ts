/**
 * Each BRDF term of the port map, read on the GLSL three generates for it: the operations in
 * Godot's order (Godot 4.6.3 `scene_forward_lights_inc.glsl`).
 */

import { describe, expect, it } from 'vitest';
import { uv, vec3, vec4 } from 'three/tsl';
import { DiffuseMode } from '../godot/rendering/materials/diffuseMode.js';
import { generatedFragmentShader } from './generatedShader.testkit.js';
import {
  backlightLight,
  clearcoatSpecularNL,
  dGGX,
  dGGXAnisotropic,
  diffuseBrdfNL,
  f0,
  rimLight,
  schlickFresnel,
  toonSpecular,
  transmittedLight,
  vGGX,
  vGGXAnisotropic,
} from './brdf.js';
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

describe('schlickFresnel', () => {
  it('multiplies in the order of Godot’s SchlickFresnel', () => {
    const shader = shaderOfFloat(schlickFresnel(x()));

    // `m = 1.0 - u`, `m2 = m * m`, then `m2 * m2 * m` (`:49-53`).
    expect(shader).toMatch(
      /(\w+) = \( 1\.0 - \w+\.x \);\s+(\w+) = \( \1 \* \1 \);[\s\S]*\( \( \2 \* \2 \) \* \1 \)/
    );
  });
});

describe('f0', () => {
  it('blends the dielectric reflectance of the specular to the albedo by the metallic', () => {
    const shader = shaderOfColour(f0(x(), y(), vec3(uv(), 0)));

    // `0.16 * specular * specular`, then the mix (`:55-60`).
    expect(shader).toMatch(
      /mix\( vec3\( \( \( 0\.16 \* \w+\.y \) \* \w+\.y \) \), [^;]*, vec3\( \w+\.x \) \)/
    );
  });
});

describe('dGGX', () => {
  it('divides the roughness by one minus N.H squared plus a squared', () => {
    const shader = shaderOfFloat(dGGX(x(), y()));

    // `a = NoH * roughness`, `k = roughness / (1 - NoH * NoH + a * a)`, `k * k / PI` (`:16-27`).
    expect(shader).toMatch(/(\w+) = \( \w+\.x \* \w+\.y \);/);
    expect(shader).toMatch(/\( \( 1\.0 - \( \w+\.x \* \w+\.x \) \) \+ \( (\w+) \* \1 \) \)/);
    expect(shader).toMatch(/\( \( (\w+) \* \1 \) \* 0\.318309/);
  });
});

describe('vGGX', () => {
  it('halves one over the mix of 2 N.L N.V and N.L + N.V by alpha', () => {
    const shader = shaderOfFloat(vGGX(x(), y(), x()));

    expect(shader).toContain('( 0.5 / mix( ( ( 2.0 * nodeVar');
  });
});

describe('dGGXAnisotropic', () => {
  it('weighs alpha squared by w squared twice', () => {
    const shader = shaderOfFloat(dGGXAnisotropic(x(), y(), x(), y(), x()));

    // `w2 = alpha2 / dot(v, v)`, then `alpha2 * w2 * w2 / PI` (`:34-40`).
    expect(shader).toMatch(/(\w+) = \( (\w+) \/ dot\( (\w+), \3 \) \);/);
    expect(shader).toMatch(/\( \( \( (\w+) \* (\w+) \) \* \2 \) \* 0\.318309/);
  });
});

describe('vGGXAnisotropic', () => {
  it('sums the two lambdas, each a length of the stretched dots', () => {
    const shader = shaderOfFloat(
      vGGXAnisotropic(x(), y(), { TdotV: x(), TdotL: y(), BdotV: x(), BdotL: y(), NdotV: x(), NdotL: y() })
    );

    expect(shader).toMatch(/0\.5 \/ \( \( \w+\.y \* length\( vec3\( [^;]+\) \) \) \+ \( \w+\.x \* length\(/);
  });
});

describe('diffuseBrdfNL', () => {
  const terms = () => ({ NdotL: x(), cNdotL: y(), cNdotV: x(), cLdotH: y(), roughness: x() });

  it('draws Lambert as N.L over pi', () => {
    const shader = shaderOfFloat(diffuseBrdfNL(DiffuseMode.DIFFUSE_LAMBERT, terms()));

    expect(shader).toMatch(/\( \w+\.y \* 0\.318309/);
  });

  it('draws Lambert wrap over one plus the roughness, squared', () => {
    const shader = shaderOfFloat(diffuseBrdfNL(DiffuseMode.DIFFUSE_LAMBERT_WRAP, terms()));

    // `max(0, (NdotL + roughness) / (op_roughness * op_roughness)) / PI` (`:191-195`).
    expect(shader).toMatch(/max\( 0\.0, \( \( \w+\.x \+ \w+\.x \) \/ \( (\w+) \* \1 \) \) \) \* 0\.318309/);
  });

  it('draws toon as a smoothstep across the roughness', () => {
    const shader = shaderOfFloat(diffuseBrdfNL(DiffuseMode.DIFFUSE_TOON, terms()));

    expect(shader).toMatch(/smoothstep\( \( - \w+\.x \), max\( \w+\.x, 0\.01 \), \w+\.x \) \* 0\.318309/);
  });

  it('draws Burley with its two Fresnel weights', () => {
    const shader = shaderOfFloat(diffuseBrdfNL(DiffuseMode.DIFFUSE_BURLEY, terms()));

    // `FD90_minus_1 = 2 * cLdotH * cLdotH * roughness - 0.5` (`:202`).
    expect(shader).toMatch(/\( \( \( \( 2\.0 \* \w+\.y \) \* \w+\.y \) \* \w+\.x \) - 0\.5 \)/);
    expect(shader).toMatch(/\( \( \( 0\.318309\d* \* \( 1\.0 \+ /);
  });

  it('draws Lambert for a mode past the enum', () => {
    const lambert = shaderOfFloat(diffuseBrdfNL(DiffuseMode.DIFFUSE_LAMBERT, terms()));

    expect(shaderOfFloat(diffuseBrdfNL(9, terms()))).toBe(lambert);
  });
});

describe('toonSpecular', () => {
  it('steps R.V across the squared one minus roughness', () => {
    const shader = shaderOfFloat(toonSpecular(direction(), direction(), direction(), x()));

    expect(shader).toMatch(/normalize\( \( - reflect\(/);
    expect(shader).toMatch(
      /smoothstep\( \( (\w+) - \( \w+\.x \* 0\.5 \) \), \( \1 \+ \( \w+\.x \* 0\.5 \) \), /
    );
  });
});

describe('rimLight', () => {
  it('raises one minus N.V to the smoothness times 16, floored against pow(0, 0)', () => {
    const shader = shaderOfColour(rimLight(x(), y(), x(), y(), vec3(uv(), 0)));

    expect(shader).toMatch(
      /pow\( max\( 0\.0001, \( 1\.0 - \w+\.x \) \), max\( 0\.0, \( \( 1\.0 - \w+\.y \) \* 16\.0 \) \) \)/
    );
    expect(shader).toContain('mix( vec3( 1.0, 1.0, 1.0 ), ');
  });
});

describe('backlightLight', () => {
  it('scales the backlight by one over pi minus the diffuse', () => {
    const shader = shaderOfColour(backlightLight(x(), vec3(uv(), 0)));

    expect(shader).toMatch(/vec3\( \( 0\.318309\d* - \w+\.x \) \) \* /);
  });
});

describe('transmittedLight', () => {
  const transmittance = (isSkin: boolean) => ({
    color: vec4(uv(), 1, x()),
    depth: x(),
    boost: y(),
    z: y(),
    isSkin,
  });

  it('falls off as exp(-d²) with d at 8.25 over the depth', () => {
    const shader = shaderOfColour(transmittedLight(transmittance(false), x()));

    expect(shader).toMatch(/\( 8\.25 \/ \w+\.x \)/);
    expect(shader).toMatch(/exp\( (\w+) \)/);
    expect(shader).toMatch(/clamp\( \( \w+\.y - \w+\.x \), 0\.0, 1\.0 \) \* 0\.318309/);
  });

  it('sums the six terms of the skin profile', () => {
    const shader = shaderOfColour(transmittedLight(transmittance(true), x()));

    expect(shader.match(/exp\( \( \w+ \/ /g)).toHaveLength(6);
    expect(shader).toContain('vec3( 0.233, 0.455, 0.649 )');
  });
});

describe('clearcoatSpecularNL', () => {
  it('reads the coat at roughness mix(0.001, 0.1) with Godot’s Gr and Fr', () => {
    const coat = { amount: x(), roughness: y(), vertexNormal: direction() };
    const shader = shaderOfFloat(clearcoatSpecularNL(coat, x(), direction(), y(), x()));

    expect(shader).toMatch(/mix\( 0\.001, 0\.1, \w+\.y \)/);
    expect(shader).toMatch(/\( 0\.25 \/ \( \( \w+\.y \* \w+\.y \) \+ 0\.0001 \) \)/);
    expect(shader).toMatch(/mix\( 0\.04, 1\.0, /);
  });
});
