import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { particleDrawOf, type ParticleDraw } from './godotParticles';
import { withParticleDraw } from './godotParticlesProgram';
import { drawDepthInjections } from './depthInjections';
import type { ProgramShader } from '../materialProgramInputs';
import { SRGB_VERTEX_COLOR } from './godotVertexColor';
import { programShader, type ProgramName } from '../testing/patchedFragment';
import { parseStandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/scalars';
import type { StandardMaterialBag } from '../../resources/materials/standardmaterial3d/materialBag';
import { BillboardMode } from '../../godot/rendering/materials/billboardMode';
import { PARTICLES_ANIM_DEFAULTS } from '../../resources/materials/standardmaterial3d/types';

const BAG: StandardMaterialBag = { materialClass: 'basic', props: { color: 'red', userData: {} } };
const UNBILLBOARDED: ParticleDraw = {
  billboard: { mode: BillboardMode.BILLBOARD_DISABLED, keepScale: false },
  anim: PARTICLES_ANIM_DEFAULTS,
};
const PARTICLES: ParticleDraw = {
  billboard: { mode: BillboardMode.BILLBOARD_PARTICLES, keepScale: false },
  anim: PARTICLES_ANIM_DEFAULTS,
};

/** What `draw` on `bag` leaves of `program`'s shaders, compiled on `material`. */
function compiled(
  draw: ParticleDraw,
  program: ProgramName = 'basic',
  material: THREE.Material = new THREE.MeshBasicMaterial(),
  bag: StandardMaterialBag = BAG
): ProgramShader {
  const drawn = withParticleDraw(bag, draw);
  material.userData = drawn.props.userData!;
  const shader = programShader(program);
  drawn.injection!.onBeforeCompile.call(material, shader);
  return shader;
}

describe.each(['basic', 'standard', 'physical'] as const)(
  'the particle colour on the %s program',
  (program) => {
    const { vertexShader } = compiled(UNBILLBOARDED, program);

    // `scene_forward_clustered.glsl:520-524` multiplies each instance's colour into COLOR.
    it('multiplies the instance colour into the vertex colour', () => {
      expect(vertexShader).toContain('vColor *= particleColor;');
      expect(vertexShader.indexOf('vColor *= particleColor;')).toBeGreaterThan(
        vertexShader.indexOf('#include <color_vertex>')
      );
    });

    // `material.cpp:1612-1615`: only `vertex_color_use_as_albedo` reads COLOR into the albedo.
    it('multiplies it only where three draws vertex colours', () => {
      const at = vertexShader.indexOf('vColor *= particleColor;');
      expect(vertexShader.slice(0, at)).toMatch(
        /#if defined\( USE_COLOR \) \|\| defined\( USE_COLOR_ALPHA \)\s*$/
      );
    });
  }
);

// `scene_forward_clustered.glsl:309` multiplies the instance colour before the material's vertex
// code runs, and that code decodes an sRGB COLOR (`material.cpp:1218-1227`).
it('multiplies the instance colour before the sRGB decode of the vertex colour', () => {
  const srgb = { ...BAG, injection: SRGB_VERTEX_COLOR };
  const { vertexShader } = compiled(UNBILLBOARDED, 'basic', new THREE.MeshBasicMaterial(), srgb);
  expect(vertexShader.indexOf('vColor *= particleColor;')).toBeLessThan(
    vertexShader.indexOf('vColor.rgb = mix(')
  );
});

describe('a particle draw with no billboard', () => {
  it('cuts no flipbook frame', () => {
    expect(compiled(UNBILLBOARDED).vertexShader).not.toContain('godotParticleFrame');
  });
});

describe('the BILLBOARD_PARTICLES flipbook', () => {
  const GRID: ParticleDraw = { ...PARTICLES, anim: { hFrames: 4, vFrames: 2, loop: true } };

  function mapped(channel: number): string {
    const map = new THREE.Texture();
    map.channel = channel;
    return compiled(GRID, 'basic', new THREE.MeshBasicMaterial({ map })).vertexShader;
  }

  // `material.cpp:1340-1350`.
  it('bakes the grid and the wrap into the program', () => {
    expect(mapped(0)).toContain('#define GODOT_PARTICLE_H_FRAMES 4');
    expect(mapped(0)).toContain('#define GODOT_PARTICLE_V_FRAMES 2');
    expect(mapped(0)).toContain('#define GODOT_PARTICLE_ANIM_LOOP');
  });

  it('cuts the frame from a map that reads UV1', () => {
    expect(mapped(0)).toContain('vMapUv = godotParticleFrame( vMapUv );');
  });

  it('leaves a map that reads UV2 whole (edge case)', () => {
    expect(mapped(1)).not.toContain('vMapUv = godotParticleFrame( vMapUv );');
  });

  it('cuts it after three writes the map coordinate', () => {
    const shader = mapped(0);
    expect(shader.indexOf('vMapUv = godotParticleFrame')).toBeGreaterThan(
      shader.indexOf('#include <uv_vertex>')
    );
  });

  it('reads the frame from the instance custom data', () => {
    expect(mapped(0)).toContain('floor( godotInstanceCustom.z * particle_total_frames )');
  });

  it('holds at the last cell without the loop', () => {
    const held = compiled({ ...GRID, anim: { ...GRID.anim, loop: false } }).vertexShader;
    expect(held).not.toContain('#define GODOT_PARTICLE_ANIM_LOOP');
  });
});

describe.each([
  ['BILLBOARD_ENABLED', BillboardMode.BILLBOARD_ENABLED],
  ['BILLBOARD_FIXED_Y', BillboardMode.BILLBOARD_FIXED_Y],
])('a %s particle draw', (_name, mode) => {
  const draw: ParticleDraw = { billboard: { mode, keepScale: false }, anim: PARTICLES_ANIM_DEFAULTS };

  it('cuts no flipbook frame', () => {
    expect(compiled(draw).vertexShader).not.toContain('godotParticleFrame(');
  });
});

describe('withParticleDraw', () => {
  it('hands back the same bag for the same draw, so a render that changes nothing keeps its props', () => {
    expect(withParticleDraw(BAG, PARTICLES)).toBe(withParticleDraw(BAG, { ...PARTICLES }));
  });

  it('keys each program on its draw', () => {
    const keys = [UNBILLBOARDED, PARTICLES].map((draw) => withParticleDraw(BAG, draw).injection!.cacheKey);
    expect(new Set(keys).size).toBe(2);
  });
});

describe('particleDrawOf', () => {
  it("is Godot's default surface for no material", () => {
    expect(particleDrawOf(null)).toEqual(UNBILLBOARDED);
  });

  it('reads the billboard and the flipbook of a material', () => {
    const scalars = parseStandardMaterial3DScalars({
      billboard_mode: '3',
      billboard_keep_scale: 'true',
      particles_anim_h_frames: '2',
      particles_anim_v_frames: '3',
      particles_anim_loop: 'true',
    });
    expect(particleDrawOf(scalars)).toEqual({
      billboard: { mode: BillboardMode.BILLBOARD_PARTICLES, keepScale: true },
      anim: { hFrames: 2, vFrames: 3, loop: true },
    });
  });
});

describe.each(['depth', 'distance'] as const)('the particle shadow on the %s program', (program) => {
  const userData = withParticleDraw(BAG, PARTICLES).props.userData!;

  // Godot's shadow pass runs the same vertex code (`material.cpp:1309`), colour and all.
  it('records the particle draw after the alpha cut, whose vertex colour it multiplies', () => {
    const { afterCut } = drawDepthInjections(userData);
    const shader = programShader(program);
    afterCut!.onBeforeCompile.call(new THREE.MeshDepthMaterial({ userData }), shader);
    expect(shader.vertexShader).toContain(`attribute vec4 particleColor;`);
  });

  it('records nothing for a surface that draws no particles', () => {
    expect(drawDepthInjections(BAG.props.userData!)).toEqual({});
  });
});
