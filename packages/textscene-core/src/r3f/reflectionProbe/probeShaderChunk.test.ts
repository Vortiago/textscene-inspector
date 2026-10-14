/**
 * The probes ride three's indirect light lines. A three release that rewrites one fails here, not
 * silently in a capture.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installGodotReflectionProbes, REFLECTION_PROBE_GLSL } from './probeShaderChunk';
import { atlasSlot, instanceLayers, REFLECTION_PROBE_UNIFORMS, rowsSlot, shownProbes } from './probeSlots';
import { functionBody } from '../testing/glslSource';
import { scalarGlslFunction } from '../testing/glslScalar';
import { warningsOf } from '../testing/logWarnings';

const threeChunks = { ...THREE.ShaderChunk };

afterEach(() => {
  Object.assign(THREE.ShaderChunk, threeChunks);
});

function patchedEnd(): string {
  installGodotReflectionProbes();
  return THREE.ShaderChunk.lights_fragment_end;
}

const axisBlend = scalarGlslFunction(REFLECTION_PROBE_GLSL, 'godotProbeAxisBlend');
const boxExit = scalarGlslFunction(REFLECTION_PROBE_GLSL, 'godotBoxExit');

describe('godotProbeAxisBlend', () => {
  it('is 1 deeper than the blend distance inside the box', () => {
    expect(axisBlend(1, 5, 2)).toBe(1);
  });

  it('falls to 0 at the face over the blend distance', () => {
    expect([axisBlend(4, 5, 2), axisBlend(-5, 5, 2)]).toEqual([0.5, 0]);
  });

  it('blends over the half size where the blend distance exceeds it (edge case)', () => {
    expect(axisBlend(0.5, 1, 8)).toBe(0.5);
  });
});

describe('godotBoxExit', () => {
  it('reaches the face the direction points at', () => {
    expect([boxExit(1, 0.5, 5), boxExit(1, -0.5, 5)]).toEqual([8, 12]);
  });
});

describe('installGodotReflectionProbes', () => {
  it('gathers the probes before the indirect light reads its ambient and reflection', () => {
    const end = patchedEnd();

    expect(end.indexOf('godotGatherReflectionProbes(')).toBeLessThan(end.indexOf('RE_IndirectDiffuse('));
  });

  it("puts the probes' reflection over the sky's by what they cover, as Godot does", () => {
    expect(patchedEnd()).toContain(
      'radiance = godotProbeReflection.rgb + radiance * ( 1.0 - godotProbeReflection.a );'
    );
  });

  it("puts the probes' ambient over every other ambient, as three's irradiance", () => {
    const end = patchedEnd();

    expect(end).toContain('irradiance *= 1.0 - godotProbeAmbient.a;');
    expect(end).toContain(
      'iblIrradiance = PI * godotProbeAmbient.rgb + iblIrradiance * ( 1.0 - godotProbeAmbient.a );'
    );
  });

  it("leaves a lightmapped surface's ambient alone, as Godot does (edge case)", () => {
    const end = patchedEnd();
    const ambient = end.slice(end.indexOf('#ifndef USE_LIGHTMAP'));

    expect(ambient.indexOf('irradiance *= 1.0 - godotProbeAmbient.a;')).toBeLessThan(
      ambient.indexOf('#endif')
    );
  });

  it('takes the probes from the last, the smallest, and skips one the instance is not masked into', () => {
    const gather = functionBody(REFLECTION_PROBE_GLSL, 'void godotGatherReflectionProbes');

    expect(gather).toContain('for ( int index = probeCount - 1; index >= 0; index -- )');
    expect(gather).toContain(
      `( godotProbeMask( flags ) & ${REFLECTION_PROBE_UNIFORMS.instanceLayers}[ 0 ] ) == 0u`
    );
  });

  it('reflects about a normal bent by the roughness to the fourth, as Godot does for a probe', () => {
    expect(functionBody(REFLECTION_PROBE_GLSL, 'void godotGatherReflectionProbes')).toContain(
      'mix( normalize( reflect( - viewDir, normal ) ), normal, roughness * roughness * roughness * roughness )'
    );
  });

  it('gives every lit material the shared slots', () => {
    installGodotReflectionProbes();
    const uniforms = THREE.ShaderLib.physical.uniforms;

    expect(uniforms[REFLECTION_PROBE_UNIFORMS.atlas]!.value).toBe(atlasSlot);
    expect(uniforms[REFLECTION_PROBE_UNIFORMS.rows]!.value).toBe(rowsSlot);
    expect(uniforms[REFLECTION_PROBE_UNIFORMS.probes]!.value).toBe(shownProbes);
    expect(uniforms[REFLECTION_PROBE_UNIFORMS.instanceLayers]!.value).toBe(instanceLayers);
  });

  it('leaves the chunk alone when it lacks its line, and warns (error case)', () => {
    THREE.ShaderChunk.lights_fragment_end = 'void main() {}';

    expect(warningsOf(installGodotReflectionProbes)).toHaveLength(1);
    expect(THREE.ShaderChunk.lights_fragment_end).toBe('void main() {}');
  });

  it('changes nothing and warns nothing on a second call (edge case)', () => {
    const once = patchedEnd();

    expect(warningsOf(installGodotReflectionProbes)).toHaveLength(0);
    expect(THREE.ShaderChunk.lights_fragment_end).toBe(once);
  });
});
