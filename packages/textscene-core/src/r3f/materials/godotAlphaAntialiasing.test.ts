import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  alphaAntialiasingOf,
  alphaAntialiasingProps,
  alphaAntialiasingUserData,
  coverOneSampleTarget,
  GODOT_ALPHA_ANTIALIASING,
} from './godotAlphaAntialiasing';
import { functionBody } from '../testing/glslSource';
import type { ProgramShader } from '../materialProgramInputs';
import {
  AlphaAntiAliasing,
  hashAntialiasing,
  scissorAntialiasing,
} from '../../godot/rendering/materials/alphaAntialiasing';
import { scalarGlslFunction } from '../testing/glslScalar';

/** Every three program an antialiased Godot surface, its depth prepass or its shadow compiles. */
const ANTIALIASED_PROGRAMS: Readonly<Record<string, { vertexShader: string; fragmentShader: string }>> = {
  basic: THREE.ShaderLib.basic,
  standard: THREE.ShaderLib.standard,
  physical: THREE.ShaderLib.physical,
  depth: THREE.ShaderLib.depth,
  distance: THREE.ShaderLib.distance,
};

const SCISSOR_CUT = scissorAntialiasing(AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE, 0.5, 0.3)!;

/** A renderer drawing into `target`, or into a canvas with `antialias` where `target` is null. */
function rendererDrawingInto(target: THREE.WebGLRenderTarget | null, antialias = false): THREE.WebGLRenderer {
  return {
    getRenderTarget: () => target,
    getContext: () => ({ getContextAttributes: () => ({ antialias }) }),
  } as unknown as THREE.WebGLRenderer;
}

const SINGLE_SAMPLE_TARGET = new THREE.WebGLRenderTarget(4, 4, { samples: 0 });
const MULTISAMPLED_TARGET = new THREE.WebGLRenderTarget(4, 4, { samples: 2 });

function compiled(
  material: THREE.Material,
  program: { vertexShader: string; fragmentShader: string } = THREE.ShaderLib.basic
): ProgramShader {
  const shader: ProgramShader = { ...program, uniforms: {} };
  GODOT_ALPHA_ANTIALIASING.onBeforeCompile.call(material, shader);
  return shader;
}

function antialiased(cut = SCISSOR_CUT, map: THREE.Texture | null = null): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    map,
    userData: alphaAntialiasingUserData(cut),
    ...alphaAntialiasingProps(cut),
  });
}

describe.each(Object.entries(ANTIALIASED_PROGRAMS))(
  'GODOT_ALPHA_ANTIALIASING on the %s program',
  (_n, program) => {
    it('cuts at the scissor, hashes, ramps the edge, covers one sample, then runs three’s cut', () => {
      const main = functionBody(compiled(antialiased(), program).fragmentShader, 'main');
      const order = [
        'diffuseColor.a < godotAlphaScissorThreshold',
        '#include <alphahash_fragment>',
        'godotEdgeCoverage(',
        'godotSingleSampleCoverage > 0',
        '#include <alphatest_fragment>',
      ].map((statement) => main.indexOf(statement));
      expect(order.every((index) => index >= 0)).toBe(true);
      expect(order).toEqual([...order].sort((a, b) => a - b));
    });

    it('declares its uniforms and functions once, before main', () => {
      const { fragmentShader } = compiled(antialiased(), program);
      const declarations = fragmentShader.slice(0, fragmentShader.indexOf('void main()'));
      expect(declarations).toContain('uniform float godotAlphaAntialiasingEdge;');
      expect(declarations.match(/float godotEdgeCoverage\(/g)).toHaveLength(1);
    });
  }
);

describe('GODOT_ALPHA_ANTIALIASING.onBeforeCompile', () => {
  it("reads the edge and the scissor from the material's userData", () => {
    const { uniforms } = compiled(antialiased());
    expect(uniforms.godotAlphaAntialiasingEdge!.value).toBeCloseTo(0.8, 6);
    expect(uniforms.godotAlphaScissorThreshold!.value).toBe(0.5);
  });

  it("reads the edge again after the material's userData changes, with no recompile", () => {
    const material = antialiased();
    const { uniforms } = compiled(material);
    material.userData = alphaAntialiasingUserData(
      hashAntialiasing(AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE, 0.1)
    );
    expect(uniforms.godotAlphaAntialiasingEdge!.value).toBe(0.1);
  });

  it("gives the albedo texture's size, as `albedo_texture_size` does", () => {
    const map = new THREE.Texture({ width: 64, height: 32 });
    const { uniforms } = compiled(antialiased(SCISSOR_CUT, map));
    expect((uniforms.godotAlbedoTextureSize!.value as THREE.Vector2).toArray()).toEqual([64, 32]);
  });

  it("gives a size of zero with no albedo texture, the uniform's default (edge case)", () => {
    const { uniforms } = compiled(antialiased());
    expect((uniforms.godotAlbedoTextureSize!.value as THREE.Vector2).toArray()).toEqual([0, 0]);
  });

  it('leaves a fragment shader without three’s cut chunks as it is (error case)', () => {
    const program = { vertexShader: 'void main() {}', fragmentShader: 'void main() {}' };
    expect(compiled(antialiased(), program).fragmentShader).toBe('void main() {}');
  });

  it('leaves a fragment shader with three’s cut but no hash chunk as it is (error case)', () => {
    const fragmentShader = 'void main() {\n#include <alphatest_fragment>\n}';
    const program = { vertexShader: 'void main() {}', fragmentShader };
    expect(compiled(antialiased(), program).fragmentShader).toBe(fragmentShader);
  });

  it('skips the mip term while the albedo size is zero, where `log2(0)` is undefined (edge case)', () => {
    const main = functionBody(compiled(antialiased()).fragmentShader, 'main');
    expect(main.indexOf('godotAlbedoTextureSize.x > 0.0')).toBeLessThan(main.indexOf('godotAlphaMipLevel('));
    expect(main).toContain('godotAlbedoTextureSize.x > 0.0');
  });
});

describe('godotSingleSampleCoverage', () => {
  function coverageOf(material: THREE.Material, renderer: THREE.WebGLRenderer): unknown {
    const { uniforms } = compiled(material);
    coverOneSampleTarget.call(material, renderer);
    return uniforms.godotSingleSampleCoverage!.value;
  }

  it('emulates alpha to coverage on a target with one sample, which WebGL skips', () => {
    expect(coverageOf(antialiased(), rendererDrawingInto(SINGLE_SAMPLE_TARGET))).toBe(
      AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE
    );
  });

  it('forces the alpha to one under ALPHA_TO_COVERAGE_AND_TO_ONE', () => {
    const cut = scissorAntialiasing(
      AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE_AND_TO_ONE,
      0.5,
      0.3
    )!;
    expect(coverageOf(antialiased(cut), rendererDrawingInto(SINGLE_SAMPLE_TARGET))).toBe(
      AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE_AND_TO_ONE
    );
  });

  it('leaves a multisampled target to the hardware', () => {
    expect(coverageOf(antialiased(), rendererDrawingInto(MULTISAMPLED_TARGET))).toBe(0);
  });

  it("reads the canvas's own antialiasing where no target is bound", () => {
    expect(coverageOf(antialiased(), rendererDrawingInto(null, true))).toBe(0);
    expect(coverageOf(antialiased(), rendererDrawingInto(null, false))).toBe(1);
  });

  it('emulates nothing for a depth copy, which turns no alpha to coverage on (edge case)', () => {
    const depthCopy = new THREE.MeshDepthMaterial({ userData: alphaAntialiasingUserData(SCISSOR_CUT) });
    expect(coverageOf(depthCopy, rendererDrawingInto(SINGLE_SAMPLE_TARGET))).toBe(0);
  });
});

describe('godotEdgeCoverage', () => {
  const edgeCoverage = scalarGlslFunction(compiled(antialiased()).fragmentShader, 'godotEdgeCoverage');

  it('gives half coverage where the alpha sits on the edge', () => {
    expect(edgeCoverage(0.8, 0.1, 0.8)).toBeCloseTo(0.5, 6);
  });

  it('ramps across one width of the alpha either side of the edge', () => {
    // `scene_forward_aa_inc.glsl:54`: `(alpha - edge) / fwidth(alpha) + 0.5`.
    expect(edgeCoverage(0.85, 0.2, 0.8)).toBeCloseTo(0.75, 6);
  });

  it('floors the width at 0.0001, so a flat alpha steps (edge case)', () => {
    expect(edgeCoverage(0.80001, 0, 0.8)).toBeCloseTo(0.6, 4);
  });

  it('clamps the coverage to 0..1 (edge case)', () => {
    expect(edgeCoverage(0.2, 0.1, 0.8)).toBe(0);
    expect(edgeCoverage(1, 0.1, 0.2)).toBe(1);
  });
});

describe('alphaAntialiasingOf', () => {
  it('reads the cut a material records', () => {
    expect(alphaAntialiasingOf(antialiased())).toEqual(SCISSOR_CUT);
  });

  it('reads none from a material that records none', () => {
    expect(alphaAntialiasingOf(new THREE.MeshBasicMaterial())).toBeNull();
  });

  it('records nothing for no cut (edge case)', () => {
    expect(alphaAntialiasingUserData(null)).toEqual({});
  });
});

describe('alphaAntialiasingProps', () => {
  it('turns alpha to coverage on with its blend for ALPHA_TO_COVERAGE', () => {
    expect(alphaAntialiasingProps(SCISSOR_CUT)).toMatchObject({
      alphaToCoverage: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
    });
  });

  it('turns alpha to coverage on with the overwriting blend for ALPHA_TO_COVERAGE_AND_TO_ONE', () => {
    const cut = scissorAntialiasing(
      AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE_AND_TO_ONE,
      0.5,
      0.3
    );
    expect(alphaAntialiasingProps(cut)).toMatchObject({ alphaToCoverage: true, blendSrc: THREE.OneFactor });
  });

  it('adds nothing for a mode past the enum, which ramps the edge only (edge case)', () => {
    expect(alphaAntialiasingProps(scissorAntialiasing(3 as AlphaAntiAliasing, 0.5, 0.3))).toEqual({});
  });

  it('adds nothing for no cut', () => {
    expect(alphaAntialiasingProps(null)).toEqual({});
  });
});
