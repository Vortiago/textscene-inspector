/**
 * The billboard a surface's programs compile: a plain draw faces the camera about its node and each
 * instance about its own origin, as Godot's MODEL_MATRIX holds each instance's
 * (`scene_forward_clustered.glsl:338-342`).
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { aimBillboards, billboardInjections } from './surfaceBillboard';
import { withPointDraw } from './materials/godotPoint';
import type { ProgramInjection, ProgramShader } from './materialProgramInputs';
import {
  MATERIAL_OF_PROGRAM,
  patchedVertex,
  programShader,
  type ProgramName,
} from './testing/patchedFragment';
import { standardMaterial } from '../resources/materials/standardmaterial3d/testing/standardMaterial';
import { BillboardMode } from '../godot/rendering/materials/billboardMode';
import type { SurfaceBillboard } from '../resources/materials/standardmaterial3d/materialBag';

const PARTICLES: SurfaceBillboard = { mode: BillboardMode.BILLBOARD_PARTICLES, keepScale: false };

/** `injection` compiled into `program`'s shaders, as a material of that program compiles it. */
function compiled(injection: ProgramInjection, program: ProgramName = 'standard'): ProgramShader {
  const shader = programShader(program);
  injection.onBeforeCompile.call(MATERIAL_OF_PROGRAM[program](), shader);
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

describe('a BILLBOARD_PARTICLES billboard', () => {
  const vertexShader = colourOf(PARTICLES);

  // `material.cpp:1309-1324`: the pass camera's normalised axes, at the model's origin.
  it('faces the pass camera about its own origin', () => {
    expect(vertexShader).toContain('uniform mat4 godotPassCameraWorld;');
    expect(vertexShader).toContain('normalize( godotPassCameraWorld[ 0 ] )');
    expect(vertexShader).toContain('godotModel[ 3 ]');
  });

  it('turns by the angle in the instance custom data', () => {
    expect(vertexShader).toContain('attribute vec4 instanceCustom;');
    expect(vertexShader).toContain(
      'vec4( cos( godotInstanceCustom.x ), - sin( godotInstanceCustom.x ), 0.0, 0.0 )'
    );
  });

  // A declared attribute with no buffer reads the constant the last program left at its location.
  it('declares the custom data only for a geometry that holds it (edge case)', () => {
    expect(vertexShader).toMatch(
      /#ifdef GODOT_READS_INSTANCE_CUSTOM\s+attribute vec4 instanceCustom;[^#]*#define godotInstanceCustom instanceCustom\s+#else\s+#define godotInstanceCustom vec4\( 0\.0 \)/
    );
  });

  // The billboard holds the instance's origin, so three's instance matrix is the identity after it.
  it('folds the instance into the billboard, before the first chunk that reads it', () => {
    const define = vertexShader.indexOf('#define instanceMatrix godotUnitInstance');
    expect(define).toBeGreaterThan(-1);
    expect(define).toBeLessThan(vertexShader.indexOf('#include <uv_vertex>'));
    expect(vertexShader).not.toContain('inverse(');
  });

  // Godot's billboard replaces MODELVIEW_MATRIX alone (`material.cpp:1263-1266`).
  it("keeps the node's matrices for a reader of MODEL_MATRIX", () => {
    const keep = vertexShader.indexOf('#define GODOT_NODE_MODEL godotNodeModel');
    expect(keep).toBeGreaterThan(vertexShader.indexOf('mat4 godotNodeModel = modelMatrix;'));
    expect(keep).toBeLessThan(vertexShader.indexOf('#define modelMatrix godotBillboardWorld'));
    expect(vertexShader).toContain('#define GODOT_NODE_INSTANCE godotNodeInstance');
  });

  it('poses every chunk of a plain draw that reads the model, before the first of them', () => {
    const define = vertexShader.indexOf('#define modelMatrix godotBillboardWorld');
    expect(define).toBeGreaterThan(-1);
    expect(define).toBeLessThan(vertexShader.indexOf('#include <uv_vertex>'));
    expect(vertexShader).toContain('#define modelViewMatrix godotBillboardModelView');
  });

  // `material.cpp:1338`: MODELVIEW_NORMAL_MATRIX is `mat3(MODELVIEW_MATRIX)`.
  it('turns the normal by the billboard model-view', () => {
    expect(vertexShader).toContain('transformedNormal = mat3( godotBillboardModelView ) * objectNormal;');
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
    expect(shader.indexOf('mat4 godotBillboard()')).toBeGreaterThan(
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
    aimBillboards(camera, new THREE.PerspectiveCamera());
    const aimed = shader.uniforms.godotMainCameraWorld!.value as THREE.Matrix4;
    expect(aimed.equals(camera.matrixWorld)).toBe(true);
  });

  it('copies the camera basis unnormalised, unlike PARTICLES', () => {
    expect(colourOf(billboard)).not.toContain('normalize( godotPassCameraWorld');
  });
});

describe('a BILLBOARD_FIXED_Y billboard', () => {
  const vertexShader = colourOf({ mode: BillboardMode.BILLBOARD_FIXED_Y, keepScale: false });

  // `material.cpp:1291-1295`.
  it('keeps world up and turns X and Z toward the camera plane', () => {
    expect(vertexShader).toContain('cross( vec3( 0.0, 1.0, 0.0 ), godotMainCameraWorld[ 2 ].xyz )');
    expect(vertexShader).toContain('vec4( 0.0, 1.0, 0.0, 0.0 )');
  });

  it('keeps the model basis while the camera looks straight down, as GLSL cannot normalise zero (edge case)', () => {
    expect(vertexShader).toContain(
      'if ( dot( godotAxisX, godotAxisX ) == 0.0 || dot( godotAxisZ, godotAxisZ ) == 0.0 ) return godotModel;'
    );
  });
});

describe.each(['depth', 'distance'] as const)('the billboard on the %s program', (program) => {
  // Godot's shadow pass runs the same vertex code, with the light's view (`material.cpp:1309`).
  it('billboards a plain draw and each instance toward the light', () => {
    const { vertexShader } = compiled(billboardInjections(PARTICLES)!.depth, program);
    expect(vertexShader).toContain('#define instanceMatrix godotUnitInstance');
    expect(vertexShader).toContain('#define modelMatrix godotBillboardWorld');
  });
});

describe('the billboard normal of a StandardMaterial3D', () => {
  const TURNS_BY_BILLBOARD = 'transformedNormal = mat3( godotBillboardModelView ) * objectNormal;';

  it('turns the normals of every billboarding mode', () => {
    for (const mode of ['1', '2', '3']) {
      expect(patchedVertex(standardMaterial({ billboard_mode: mode }))).toContain(TURNS_BY_BILLBOARD);
    }
  });

  it('turns the normals the unshaded parallax adds too, as its program includes the chunk twice', () => {
    const vertex = patchedVertex(
      standardMaterial({ shading_mode: '0', heightmap_enabled: 'true', billboard_mode: '1' })
    );
    expect(vertex.split(TURNS_BY_BILLBOARD)).toHaveLength(3);
  });

  it("keeps three's normal matrix for a surface that does not billboard (edge case)", () => {
    expect(patchedVertex(standardMaterial({ albedo_color: 'Color(1, 0, 0, 1)' }))).not.toContain(
      TURNS_BY_BILLBOARD
    );
  });
});
