/**
 * The billboard an instanced draw compiles: each instance faces the camera about its own origin, as
 * Godot's MODEL_MATRIX holds each instance's (`scene_forward_clustered.glsl:338-342`).
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { aimInstanceBillboards, billboardInjections } from './surfaceBillboard';
import { withPointDraw } from './materials/godotPoint';
import type { ProgramInjection, ProgramShader } from './materialProgramInputs';
import { programShader, type ProgramName } from './testing/patchedFragment';
import { BillboardMode } from '../godot/rendering/materials/billboardMode';
import type { SurfaceBillboard } from '../resources/materials/standardmaterial3d/materialBag';

const PARTICLES: SurfaceBillboard = { mode: BillboardMode.BILLBOARD_PARTICLES, keepScale: false };

/** `injection` compiled into `program`'s shaders, as a material of that program compiles it. */
function compiled(injection: ProgramInjection, program: ProgramName = 'standard'): ProgramShader {
  const shader = programShader(program);
  injection.onBeforeCompile.call(new THREE.MeshStandardMaterial(), shader);
  return shader;
}

function colourOf(billboard: SurfaceBillboard, program: ProgramName = 'standard'): string {
  return compiled(billboardInjections(billboard)!.colour, program).vertexShader;
}

describe('billboardInjections', () => {
  it('is none for a surface that does not billboard', () => {
    expect(billboardInjections({ mode: BillboardMode.BILLBOARD_DISABLED, keepScale: false })).toBeUndefined();
  });

  it('hands back the same injections for the same billboard, so each compiles one program', () => {
    expect(billboardInjections({ ...PARTICLES })).toBe(billboardInjections(PARTICLES));
  });
});

describe('a BILLBOARD_PARTICLES instance', () => {
  const vertexShader = colourOf(PARTICLES);

  // `material.cpp:1309-1324`: the pass camera's normalised axes, at the instance's origin.
  it('faces the pass camera about its own origin', () => {
    expect(vertexShader).toContain('uniform mat4 godotPassCameraWorld;');
    expect(vertexShader).toContain('normalize( godotPassCameraWorld[ 0 ] )');
    expect(vertexShader).toContain('godotModel[ 3 ]');
  });

  it('turns by the angle in the instance custom data', () => {
    expect(vertexShader).toContain('attribute vec4 instanceCustom;');
    expect(vertexShader).toContain('vec4( cos( instanceCustom.x ), - sin( instanceCustom.x ), 0.0, 0.0 )');
  });

  // three multiplies `modelMatrix` after `instanceMatrix`, so the instance carries the inverse.
  it('poses every chunk that reads the instance, before the first of them', () => {
    const define = vertexShader.indexOf('#define instanceMatrix godotInstanceLocal');
    expect(define).toBeGreaterThan(-1);
    expect(define).toBeLessThan(vertexShader.indexOf('#include <uv_vertex>'));
    expect(vertexShader).toContain('inverse( modelMatrix ) * godotInstanceWorld');
  });

  // three declares `instanceMatrix` only for an instanced draw, so any other keeps its pose.
  it('billboards only an instanced draw (edge case)', () => {
    const define = vertexShader.indexOf('#define instanceMatrix godotInstanceLocal');
    expect(vertexShader.slice(0, define)).toMatch(/#ifdef USE_INSTANCING\s+mat4 godotInstanceWorld[^#]*$/);
  });

  // `material.cpp:1338`: MODELVIEW_NORMAL_MATRIX is `mat3(MODELVIEW_MATRIX)`.
  it('turns the normal by the billboard model-view', () => {
    expect(vertexShader).toContain(
      'transformedNormal = mat3( viewMatrix * godotInstanceWorld ) * objectNormal;'
    );
  });

  it('keeps no scale unless the material asks', () => {
    expect(vertexShader).not.toContain('length( godotModel[ 0 ].xyz )');
  });

  // `material.cpp:1274-1281`.
  it('keeps the instance scale under billboard_keep_scale', () => {
    expect(colourOf({ ...PARTICLES, keepScale: true })).toContain('length( godotModel[ 0 ].xyz )');
  });

  // Instanced points declare `instanceMatrix` at the top of their text, which the billboard reads.
  it('declares the billboard after the instance matrix of instanced points', () => {
    const points = withPointDraw(
      { materialClass: 'basic', props: { userData: {} }, injection: billboardInjections(PARTICLES)!.colour },
      { pixels: 4, pixelRatio: 1, samplesAlbedoAtPointCoord: false, placement: 'instances' }
    );
    const shader = compiled(points.injection!, 'basic').vertexShader;
    expect(shader.indexOf('mat4 godotInstanceBillboard()')).toBeGreaterThan(
      shader.indexOf('attribute mat4 instanceMatrix;')
    );
  });
});

describe.each([
  ['BILLBOARD_ENABLED', BillboardMode.BILLBOARD_ENABLED],
  ['BILLBOARD_FIXED_Y', BillboardMode.BILLBOARD_FIXED_Y],
])('a %s instance', (_name, mode) => {
  const billboard: SurfaceBillboard = { mode, keepScale: false };

  // `material.cpp:1263-1264`: MAIN_CAM_INV_VIEW_MATRIX, the main camera even on a shadow pass.
  it('faces the main camera, which a shadow pass keeps', () => {
    const shader = compiled(billboardInjections(billboard)!.colour);
    expect(shader.vertexShader).toContain('uniform mat4 godotMainCameraWorld;');
    expect(shader.uniforms.godotMainCameraWorld).toBeDefined();
  });

  it('reads the main camera the draw hooks aim it at', () => {
    const shader = compiled(billboardInjections(billboard)!.colour);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(1, 2, 3);
    camera.updateMatrixWorld();
    aimInstanceBillboards(camera, new THREE.PerspectiveCamera());
    const aimed = shader.uniforms.godotMainCameraWorld!.value as THREE.Matrix4;
    expect(aimed.equals(camera.matrixWorld)).toBe(true);
  });

  it('declares no custom data, which only PARTICLES reads', () => {
    expect(colourOf(billboard)).not.toContain('attribute vec4 instanceCustom;');
  });
});

describe.each(['depth', 'distance'] as const)('the instance billboard on the %s program', (program) => {
  // Godot's shadow pass runs the same vertex code, with the light's view (`material.cpp:1309`).
  it('billboards the instances toward the light', () => {
    const shader = compiled(billboardInjections(PARTICLES)!.depth, program);
    expect(shader.vertexShader).toContain('#define instanceMatrix godotInstanceLocal');
  });
});
