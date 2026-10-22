/**
 * Godot's POINT_SIZE and POINT_COORD in three's programs: `use_point_size` sets each point's
 * square to `point_size` pixels (`material.cpp:1229-1232`, else 1 px, `scene_forward_clustered.glsl:446`)
 * and reads the albedo map at the point coordinate, not the UV (`material.cpp:1612-1615`).
 */

import { FrontSide } from 'three';
import { composeInjections, type ProgramInjection } from '../materialProgramInputs';
import { editedShader } from '../shaderPatch/chunkPatch';
import { recordedUniform } from './recordedOnMaterial';
import type { StandardMaterialBag } from '../../resources/materials/standardmaterial3d/materialBag';
import type { StandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/types';
import { BASE_MATERIAL_3D_DEFAULTS } from '../../godot/scene/baseMaterial3D';

const POINT_SIZE_KEY = 'godotPointSize';
const POINT_PIXEL_RATIO_KEY = 'godotPointPixelRatio';
const POINT_COORD_ALBEDO_KEY = 'godotPointCoordAlbedo';
const PROJECT_CHUNK = '#include <project_vertex>';

/** How a material draws the points of a points surface. */
export interface PointDraw {
  /** The side of each point's square in Godot's pixels: `point_size` under `use_point_size`, else 1. */
  pixels: number;
  /**
   * The canvas pixel ratio. Godot's pixels are its viewport's, which a canvas of ratio 2 draws
   * twice over. A shadow map's texels are Godot's own, so only the colour pass reads it.
   */
  pixelRatio: number;
  /** `use_point_size` is on: the albedo map is read across the point's square, not at the UV. */
  samplesAlbedoAtPointCoord: boolean;
}

/** `scalars` as a points draw on a canvas of `pixelRatio`, or Godot's default surface for none. */
export function pointDrawOf(scalars: StandardMaterial3DScalars | null, pixelRatio: number): PointDraw {
  return scalars?.usesPointSize
    ? { pixels: scalars.pointSize, pixelRatio, samplesAlbedoAtPointCoord: true }
    : { pixels: BASE_MATERIAL_3D_DEFAULTS.pointSize, pixelRatio, samplesAlbedoAtPointCoord: false };
}

/** The uniforms of a points colour pass, each with the value it holds until the material's userData records one. */
const POINT_SIZE_UNIFORMS = {
  [POINT_SIZE_KEY]: BASE_MATERIAL_3D_DEFAULTS.pointSize,
  [POINT_PIXEL_RATIO_KEY]: 1,
};

/** Writes `gl_PointSize` as the product of `uniforms`, each recorded from the material's userData. */
function pointSizeInjection(cacheKey: string, uniforms: Readonly<Record<string, number>>): ProgramInjection {
  const keys = Object.keys(uniforms);
  const declarations = keys.map((key) => `uniform float ${key};`).join('\n');
  return {
    cacheKey,
    onBeforeCompile(shader) {
      for (const [key, initial] of Object.entries(uniforms)) {
        shader.uniforms[key] = recordedUniform(this, key, initial);
      }
      const sized = editedShader(
        shader.vertexShader,
        [{ three: PROJECT_CHUNK, godot: `${PROJECT_CHUNK}\n\tgl_PointSize = ${keys.join(' * ')};` }],
        'the vertex shader of the point size'
      );
      shader.vertexShader = `${declarations}\n${sized}`;
    },
  };
}

/** What a material compiles with to draw a points surface, at its size in canvas pixels. */
const GODOT_POINT_SIZE = pointSizeInjection('godot-point-size', POINT_SIZE_UNIFORMS);

/** What a depth draw compiles with to rasterise a point at its size in the shadow map's texels. */
const GODOT_POINT_SHADOW_SIZE = pointSizeInjection('godot-point-shadow-size', {
  [POINT_SIZE_KEY]: POINT_SIZE_UNIFORMS[POINT_SIZE_KEY],
});

const MAP_PARS_CHUNK = '#include <map_pars_fragment>';

/**
 * The map's UV as the point coordinate. A macro after the varying's declaration, so every read of
 * the map, whichever patch wrote it, takes the coordinate. Point coordinates run down from the top
 * as an image does, and three's V runs up, as in three's own `map_particle_fragment`.
 */
const GODOT_POINT_COORD_ALBEDO: ProgramInjection = {
  cacheKey: 'godot-point-coord-albedo',
  onBeforeCompile(shader) {
    shader.fragmentShader = editedShader(
      shader.fragmentShader,
      [
        {
          three: MAP_PARS_CHUNK,
          godot: `${MAP_PARS_CHUNK}\n#define vMapUv vec2( gl_PointCoord.x, 1.0 - gl_PointCoord.y )`,
        },
      ],
      'the fragment shader of the point coordinate albedo'
    );
  },
};

/** Written only by `withPointDraw`: a bag's points forms by draw, so a render that changes nothing hands R3F the same props. */
const pointBags = new WeakMap<StandardMaterialBag, Map<string, StandardMaterialBag>>();

/**
 * `bag` as a material for a points surface, or `bag` itself for no draw. The cull mode does not
 * reach a point, which is never a back face, so the side is the front.
 */
export function withPointDraw(bag: StandardMaterialBag, draw: PointDraw | undefined): StandardMaterialBag {
  if (!draw) return bag;
  const drawKey = `${draw.pixels}:${draw.pixelRatio}:${draw.samplesAlbedoAtPointCoord}`;
  const forms = pointBags.get(bag) ?? new Map<string, StandardMaterialBag>();
  pointBags.set(bag, forms);
  const known = forms.get(drawKey);
  if (known) return known;
  const form = pointBag(bag, draw);
  forms.set(drawKey, form);
  return form;
}

function pointBag(bag: StandardMaterialBag, draw: PointDraw): StandardMaterialBag {
  const readsMap = draw.samplesAlbedoAtPointCoord && Boolean(bag.props.map);
  const userData = {
    ...bag.props.userData,
    [POINT_SIZE_KEY]: draw.pixels,
    [POINT_PIXEL_RATIO_KEY]: draw.pixelRatio,
    [POINT_COORD_ALBEDO_KEY]: readsMap,
  };
  return {
    ...bag,
    props: { ...bag.props, side: FrontSide, userData },
    injection: composeInjections([
      bag.injection,
      GODOT_POINT_SIZE,
      readsMap ? GODOT_POINT_COORD_ALBEDO : undefined,
    ]),
  };
}

const GODOT_POINT_SHADOW_SIZE_AT_POINT_COORD = composeInjections([
  GODOT_POINT_SHADOW_SIZE,
  GODOT_POINT_COORD_ALBEDO,
])!;

/**
 * What a depth draw compiles with to cut a points surface's shadow as its colour pass draws the
 * points: at their size, and across the square where the albedo map is read. Undefined for a
 * surface that draws none.
 */
export function pointShadowSizeInjection(userData: Record<string, unknown>): ProgramInjection | undefined {
  if (!(POINT_SIZE_KEY in userData)) return undefined;
  return userData[POINT_COORD_ALBEDO_KEY] ? GODOT_POINT_SHADOW_SIZE_AT_POINT_COORD : GODOT_POINT_SHADOW_SIZE;
}
