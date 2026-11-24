/**
 * Godot's POINT_SIZE and POINT_COORD in three's programs: `use_point_size` sets each point's
 * square to `point_size` pixels (`material.cpp:1229-1232`, else 1 px, `scene_forward_clustered.glsl:446`)
 * and reads the albedo map at the point coordinate, not the UV (`material.cpp:1612-1615`).
 */

import { FrontSide } from 'three';
import { composeInjections, type ProgramInjection } from '../materialProgramInputs';
import { editedProgram } from '../shaderPatch/chunkPatch';
import { recordedUniform } from './recordedOnMaterial';
import type { StandardMaterialBag } from '../../resources/materials/standardmaterial3d/materialBag';
import type { StandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/types';
import { BASE_MATERIAL_3D_DEFAULTS } from '../../godot/scene/baseMaterial3D';
import { bagForms } from './bagForms';
import { withDepthInjection } from './depthInjections';
import { INSTANCE_MATRIX_ATTRIBUTE } from '../meshes/sharedInstances';

const POINT_SIZE_KEY = 'godotPointSize';
const POINT_COORD_ALBEDO_KEY = 'godotPointCoordAlbedo';
const POINTS_AT_INSTANCES_KEY = 'godotPointsAtInstances';
const PROJECT_CHUNK = '#include <project_vertex>';

/**
 * Where a points or lines surface's primitives sit: in the node's own mesh, or at each instance of a GridMap's
 * cells or a CPUParticles3D's particles (`sharedInstances.ts`).
 */
export type ListedPlacement = 'mesh' | 'instances';

/** A surface that draws `THREE.Points` or `THREE.LineSegments`, and where its primitives sit. */
export interface ListedSurface {
  primitive: 'points' | 'lines';
  placement: ListedPlacement;
}

/** How a material draws the points of a points surface. */
export interface PointDraw {
  /** A side in framebuffer pixels (`scene_forward_clustered.glsl:724`): `point_size` under the flag. */
  pixels: number;
  /** `use_point_size` is on: the albedo map is read across the point's square, not at the UV. */
  samplesAlbedoAtPointCoord: boolean;
  placement: ListedPlacement;
}

/** `scalars` as a points draw, or Godot's default surface for none. */
export function pointDrawOf(
  scalars: StandardMaterial3DScalars | null,
  placement: ListedPlacement
): PointDraw {
  const pointSize = scalars?.usesPointSize ? scalars.pointSize : undefined;
  return {
    pixels: pointSize ?? BASE_MATERIAL_3D_DEFAULTS.pointSize,
    samplesAlbedoAtPointCoord: pointSize !== undefined,
    placement,
  };
}

/**
 * three defines `USE_INSTANCING` and declares `instanceMatrix` only for an InstancedMesh
 * (r187 `WebGLPrograms.js:213`), so instanced points and lines declare both. Each instance branch of three's
 * chunks and of the Godot patches then places, turns and billboards the points or lines.
 */
const GODOT_INSTANCED_LISTED: ProgramInjection = {
  cacheKey: 'godot-instanced-listed',
  onBeforeCompile(shader) {
    shader.vertexShader = `#define USE_INSTANCING
attribute mat4 ${INSTANCE_MATRIX_ATTRIBUTE};
${shader.vertexShader}`;
  },
};

/** Writes `gl_PointSize` from the recorded size, 1 px by default, in the pixels of the target drawn. */
const GODOT_POINT_SIZE: ProgramInjection = {
  cacheKey: 'godot-point-size',
  onBeforeCompile(shader) {
    shader.uniforms[POINT_SIZE_KEY] = recordedUniform(
      this,
      POINT_SIZE_KEY,
      BASE_MATERIAL_3D_DEFAULTS.pointSize
    );
    const size = `${PROJECT_CHUNK}\n\tgl_PointSize = ${POINT_SIZE_KEY};`;
    editedProgram(shader, { vertex: [{ three: PROJECT_CHUNK, godot: size }] }, 'point size');
    shader.vertexShader = `uniform float ${POINT_SIZE_KEY};\n${shader.vertexShader}`;
  },
};

/**
 * A 2D canvas point as one framebuffer pixel (`canvas.glsl:268,301`), which three leaves unwritten.
 *
 * @canonical The size of a point on the 2D canvas
 */
export const CANVAS_POINT_SIZE: ProgramInjection = GODOT_POINT_SIZE;

const MAP_PARS_CHUNK = '#include <map_pars_fragment>';

/**
 * The map's UV as the point coordinate. A macro after the varying's declaration, so every read of
 * the map, whichever patch wrote it, takes the coordinate. Point coordinates run down from the top
 * as an image does, and three's V runs up, as in three's own `map_particle_fragment`.
 */
const GODOT_POINT_COORD_ALBEDO: ProgramInjection = {
  cacheKey: 'godot-point-coord-albedo',
  onBeforeCompile(shader) {
    editedProgram(
      shader,
      {
        fragment: [
          {
            three: MAP_PARS_CHUNK,
            godot: `${MAP_PARS_CHUNK}\n#define vMapUv vec2( gl_PointCoord.x, 1.0 - gl_PointCoord.y )`,
          },
        ],
      },
      'point coordinate albedo'
    );
  },
};

/** Each bag's point forms, filled only by `withPointDraw`. */
const pointForms = bagForms();

/**
 * `bag` as a material for a points surface, or `bag` itself for no draw. The cull mode does not
 * reach a point, which is never a back face, so the side is the front.
 */
export function withPointDraw(bag: StandardMaterialBag, draw: PointDraw | undefined): StandardMaterialBag {
  if (!draw) return bag;
  const drawKey = `${draw.pixels}:${draw.samplesAlbedoAtPointCoord}:${draw.placement}`;
  return pointForms(bag, drawKey, () => pointBag(bag, draw));
}

function pointBag(bag: StandardMaterialBag, draw: PointDraw): StandardMaterialBag {
  const readsMap = draw.samplesAlbedoAtPointCoord && Boolean(bag.props.map);
  const isAtInstances = draw.placement === 'instances';
  const userData = withDepthInjection(
    {
      ...bag.props.userData,
      [POINT_SIZE_KEY]: draw.pixels,
      [POINT_COORD_ALBEDO_KEY]: readsMap,
      [POINTS_AT_INSTANCES_KEY]: isAtInstances,
    },
    'beforeCut',
    pointShadowSizeInjection(readsMap, isAtInstances)
  );
  return {
    ...bag,
    props: { ...bag.props, side: FrontSide, userData },
    injection: composeInjections([
      bag.injection,
      GODOT_POINT_SIZE,
      readsMap ? GODOT_POINT_COORD_ALBEDO : undefined,
      isAtInstances ? GODOT_INSTANCED_LISTED : undefined,
    ]),
  };
}

/** Each bag's form for lines at instances, filled only by `withLineDraw`. */
const lineForms = bagForms();

/**
 * `bag` as a material for a lines surface at `placement`, or `bag` itself for lines in the mesh,
 * which draw as any surface does. Lines at instances declare the instance matrix in both passes.
 */
export function withLineDraw(
  bag: StandardMaterialBag,
  placement: ListedPlacement | undefined
): StandardMaterialBag {
  if (placement !== 'instances') return bag;
  return lineForms(bag, placement, () => ({
    ...bag,
    props: {
      ...bag.props,
      userData: withDepthInjection(bag.props.userData ?? {}, 'beforeCut', GODOT_INSTANCED_LISTED),
    },
    injection: composeInjections([bag.injection, GODOT_INSTANCED_LISTED]),
  }));
}

const GODOT_POINT_SHADOW_SIZE_AT_POINT_COORD = composeInjections([
  GODOT_POINT_SIZE,
  GODOT_POINT_COORD_ALBEDO,
])!;

/**
 * What a depth draw compiles with to cut a points surface's shadow as its colour pass draws the
 * points: at their size, across the square where the albedo map is read, and at each instance.
 */
function pointShadowSizeInjection(readsMap: boolean, isAtInstances: boolean): ProgramInjection {
  const size = readsMap ? GODOT_POINT_SHADOW_SIZE_AT_POINT_COORD : GODOT_POINT_SIZE;
  return isAtInstances ? composeInjections([size, GODOT_INSTANCED_LISTED])! : size;
}
