/**
 * Godot's triplanar mapping in three's programs: a UV set that projects samples each of its maps at
 * the vertex position, three times, and blends the samples by the normal (`material.cpp:1386-1500`).
 * The surface's tangent frame follows the projection, as Godot writes TANGENT and BINORMAL. The
 * colour programs and the depth programs of the surface's shadow read the same record.
 */

import type { IUniform, Material } from 'three';
import type { ProgramInjection } from '../materialProgramInputs';
import { editedProgram, rewrittenShader, rewrittenThroughChunks } from '../shaderPatch/chunkPatch';
import { recordedOn } from './recordedOnMaterial';
import { NODE_POSE_PARS, nodePoseUniforms } from './nodePose';
import type { Triplanar, TriplanarProjection } from '../../resources/materials/standardmaterial3d/types';

/** three's maps that a Godot slot draws through, and so that a triplanar UV set can serve. */
export type TriplanarMap =
  'map' | 'normalMap' | 'roughnessMap' | 'metalnessMap' | 'emissiveMap' | 'aoMap' | 'anisotropyMap';

/** What a material records of its triplanar mapping: the projections, and the maps each UV set serves. */
export interface TriplanarRecord extends Triplanar {
  /**
   * The surface billboards, so its `MODELVIEW_NORMAL_MATRIX` is `mat3(MODELVIEW_MATRIX)`
   * (`material.cpp:1284,1307,1338`), which turns the frame.
   */
  isBillboard: boolean;
  /** The maps that read UV1, empty when UV1 does not project. */
  uv1Maps: readonly TriplanarMap[];
  /** The maps that read UV2, empty when UV2 does not project. */
  uv2Maps: readonly TriplanarMap[];
}

/** Where a material records its triplanar mapping. */
const TRIPLANAR_KEY = 'godotTriplanar';

/** The `userData` that gives a material its triplanar mapping, none for `null`. */
export function triplanarUserData(record: TriplanarRecord | null): Record<string, unknown> {
  return record ? { [TRIPLANAR_KEY]: record } : {};
}

/**
 * `triplanar` reads the mesh's own space: a UV set projects the local position, or the frame is
 * local. A draw that moves the vertices out of the mesh's space must not draw such a mapping.
 */
export function readsObjectSpace(triplanar: Triplanar | null): boolean {
  if (!triplanar) return false;
  const projectsLocal = [triplanar.uv1, triplanar.uv2].some(
    (projection) => projection && !projection.isWorld
  );
  return projectsLocal || !triplanar.isTangentWorld;
}

/** The UV sets of Godot's shader, by the prefix of their uniforms. */
const UV_SETS = ['uv1', 'uv2'] as const;
type UvSet = (typeof UV_SETS)[number];

/** `text` with its first letter in upper case, as GLSL names join words. */
function capitalised(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

/** The GLSL name of UV set `uv`'s `name`, as `godotUv1TriplanarScale`. */
function glslName(uv: UvSet, name: string): string {
  return `godot${capitalised(uv)}${name}`;
}

/** The varying of UV set `uv`'s `name`, as `vGodotUv1TriplanarPos`. */
function varyingName(uv: UvSet, name: string): string {
  return `v${capitalised(glslName(uv, name))}`;
}

/** UV set `uv`'s projected position and blend weights, as each stage names the varyings. */
function projectionVaryings(uv: UvSet): { position: string; weights: string } {
  return { position: varyingName(uv, 'TriplanarPos'), weights: varyingName(uv, 'PowerNormal') };
}

/** UV set `uv`'s define, which each program state of the record turns on. */
const projects = (uv: UvSet) => `GODOT_${uv.toUpperCase()}_TRIPLANAR`;
const projectsWorld = (uv: UvSet) => `GODOT_${uv.toUpperCase()}_WORLD_TRIPLANAR`;

/** A projection's uniforms, the first value until a material records one. */
const NO_PROJECTION: TriplanarProjection = {
  scale: { x: 1, y: 1, z: 1 },
  offset: { x: 0, y: 0, z: 0 },
  sharpness: 1,
  isWorld: false,
};

/** Uniforms that read `material`'s record at each upload, so a re-parse that changes only a value needs no recompile. */
function projectionUniforms(material: Material, uv: UvSet): Record<string, IUniform> {
  const projection = () =>
    recordedOn<TriplanarRecord | null>(material, TRIPLANAR_KEY, null)?.[uv] ?? NO_PROJECTION;
  // three uploads a vec3 from any object with x, y and z, so the record's own vectors serve.
  return {
    [glslName(uv, 'TriplanarScale')]: {
      get value() {
        return projection().scale;
      },
    },
    [glslName(uv, 'TriplanarOffset')]: {
      get value() {
        return projection().offset;
      },
    },
    [glslName(uv, 'TriplanarSharpness')]: {
      get value() {
        return projection().sharpness;
      },
    },
  };
}

/** One UV set's varyings, in both stages. */
function projectionVaryingPars(uv: UvSet): string {
  const { position, weights } = projectionVaryings(uv);
  return `#ifdef ${projects(uv)}
varying vec3 ${position};
varying vec3 ${weights};
#endif
`;
}

/** One UV set's uniforms and varyings, in the vertex program. */
function projectionVertexPars(uv: UvSet): string {
  return `#ifdef ${projects(uv)}
uniform vec3 ${glslName(uv, 'TriplanarScale')};
uniform vec3 ${glslName(uv, 'TriplanarOffset')};
uniform float ${glslName(uv, 'TriplanarSharpness')};
#endif
${projectionVaryingPars(uv)}`;
}

/**
 * The frame Godot writes for a triplanar surface, in view space. Each program declares it, so the
 * fragment programs that read no frame link too.
 */
const FRAME_VARYINGS = `varying vec3 vGodotTriplanarTangent;
varying vec3 vGodotTriplanarBinormal;
`;

const VERTEX_PARS = `${NODE_POSE_PARS}${UV_SETS.map(projectionVertexPars).join('')}${FRAME_VARYINGS}`;

/**
 * Godot's VERTEX and NORMAL: the mesh's, after skinning and morphs, before an instance's
 * transform. A scope of its own, since three runs the normal chunks in only some programs.
 * Godot's MODEL_MATRIX and MODEL_NORMAL_MATRIX are the node's, through the instance
 * (`scene_forward_clustered.glsl:338-346`).
 */
const GODOT_VERTEX_INPUTS = /* glsl */ `
	vec3 godotNormal;
	{
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
		godotNormal = objectNormal;
	}
	mat4 godotNodeModel = modelMatrix * godotModelFromObject;
	#ifdef USE_INSTANCING
		mat4 godotModel = godotNodeModel * instanceMatrix;
		mat3 godotModelNormal = inverse( transpose( mat3( godotNodeModel ) ) ) * mat3( instanceMatrix );
	#else
		mat4 godotModel = godotNodeModel;
		mat3 godotModelNormal = inverse( transpose( mat3( godotNodeModel ) ) );
	#endif
`;

/**
 * Godot's TANGENT and BINORMAL for a triplanar surface (`material.cpp:1386-1414`), carried to view
 * space as Godot's `modelview_normal` carries them (`scene_forward_clustered.glsl:461-470`).
 */
const GODOT_FRAME = /* glsl */ `
	#ifdef GODOT_TRIPLANAR_TANGENT_WORLD
		vec3 godotFrameNormal = godotModelNormal * godotNormal;
	#else
		vec3 godotFrameNormal = godotNormal;
	#endif
	vec3 godotTangent = vec3( 0.0, 0.0, - 1.0 ) * abs( godotFrameNormal.x );
	godotTangent += vec3( 1.0, 0.0, 0.0 ) * abs( godotFrameNormal.y );
	godotTangent += vec3( 1.0, 0.0, 0.0 ) * abs( godotFrameNormal.z );
	vec3 godotBinormal = vec3( 0.0, 1.0, 0.0 ) * abs( godotFrameNormal.x );
	godotBinormal += vec3( 0.0, 0.0, - 1.0 ) * abs( godotFrameNormal.y );
	godotBinormal += vec3( 0.0, 1.0, 0.0 ) * abs( godotFrameNormal.z );
	#ifdef GODOT_TRIPLANAR_TANGENT_WORLD
		mat3 godotNormalModel = inverse( godotModelNormal );
		godotTangent = godotNormalModel * normalize( godotTangent );
		godotBinormal = godotNormalModel * normalize( godotBinormal );
	#else
		godotTangent = normalize( godotTangent );
		godotBinormal = normalize( godotBinormal );
	#endif
	#ifdef GODOT_TRIPLANAR_BILLBOARD
		mat3 godotModelViewNormal = mat3( modelViewMatrix );
	#else
		mat3 godotModelViewNormal = mat3( viewMatrix ) * godotModelNormal;
	#endif
	vGodotTriplanarTangent = normalize( godotModelViewNormal * godotTangent );
	vGodotTriplanarBinormal = normalize( godotModelViewNormal * godotBinormal );
`;

/**
 * UV set `uv`'s projected position and blend weights (`material.cpp:1418-1454`). UV1's world
 * weights read MODEL_NORMAL_MATRIX, UV2's read `mat3(MODEL_MATRIX)`, as Godot's do.
 */
function projectionVertex(uv: UvSet): string {
  const worldNormal = uv === 'uv1' ? 'godotModelNormal * godotNormal' : 'mat3( godotModel ) * godotNormal';
  const { position, weights } = projectionVaryings(uv);
  return /* glsl */ `
	#ifdef ${projects(uv)}
		#ifdef ${projectsWorld(uv)}
			vec3 ${glslName(uv, 'Normal')} = ${worldNormal};
			vec3 ${glslName(uv, 'Position')} = ( godotModel * vec4( transformed, 1.0 ) ).xyz;
		#else
			vec3 ${glslName(uv, 'Normal')} = godotNormal;
			vec3 ${glslName(uv, 'Position')} = transformed;
		#endif
		${weights} = pow( abs( ${glslName(uv, 'Normal')} ), vec3( ${glslName(uv, 'TriplanarSharpness')} ) );
		${weights} /= dot( ${weights}, vec3( 1.0 ) );
		${position} = ${glslName(uv, 'Position')} * ${glslName(uv, 'TriplanarScale')} + ${glslName(uv, 'TriplanarOffset')};
		${position} *= vec3( 1.0, - 1.0, 1.0 );
	#endif
`;
}

const PROJECT_VERTEX = '#include <project_vertex>';
const VERTEX = `${GODOT_VERTEX_INPUTS}${GODOT_FRAME}${UV_SETS.map(projectionVertex).join('')}${PROJECT_VERTEX}`;

/** three's coordinate of each map, `v<Map>Uv`. */
function coordinateOf(map: TriplanarMap): string {
  return `v${capitalised(map)}Uv`;
}

const NORMAL_MAP_PARS = '#include <normalmap_pars_fragment>';

/**
 * The normal map's texel `step` pixels along the screen from this one, in UV1's three projections,
 * in place of the read `godotNormalMap.ts` defines. It follows three's declaration of `normalMap`.
 * The gradients come from `main`, where every pixel of a quad runs.
 */
const TRIPLANAR_NORMAL_TEXEL = /* glsl */ `${NORMAL_MAP_PARS}
#if defined( GODOT_UV1_TRIPLANAR ) && defined( USE_NORMALMAP_TANGENTSPACE )
uniform mat3 normalMapTransform;
vec4 godotTriplanarNormalTexel( const in vec3 position, const in vec3 weights, const in vec3 positionDx, const in vec3 positionDy ) {
	mat2 window = mat2( normalMapTransform );
	vec2 zy = vec2( - 1.0, 1.0 );
	return textureGrad( normalMap, godotTriplanarUv( normalMapTransform, position.xy ), window * positionDx.xy, window * positionDy.xy ) * weights.z
		+ textureGrad( normalMap, godotTriplanarUv( normalMapTransform, position.xz ), window * positionDx.xz, window * positionDy.xz ) * weights.y
		+ textureGrad( normalMap, godotTriplanarUv( normalMapTransform, position.zy * zy ), window * ( positionDx.zy * zy ), window * ( positionDy.zy * zy ) ) * weights.x;
}
#undef GODOT_NORMAL_TEXEL
#define GODOT_NORMAL_TEXEL( step ) godotTriplanarNormalTexel( vGodotUv1TriplanarPos + ( step ).x * godotUv1PositionDx + ( step ).y * godotUv1PositionDy, vGodotUv1PowerNormal + ( step ).x * godotUv1WeightsDx + ( step ).y * godotUv1WeightsDy, godotUv1PositionDx, godotUv1PositionDy )
#endif
`;

/**
 * The varyings, and a map's coordinate in a projection: the position through the texture's window,
 * as three's vertex program carries a UV through it.
 */
const FRAGMENT_PARS = `${UV_SETS.map(projectionVaryingPars).join('')}${FRAME_VARYINGS}
vec2 godotTriplanarUv( const in mat3 window, const in vec2 position ) {
	return ( window * vec3( position, 1.0 ) ).xy;
}
`;

const MAIN = 'void main() {';

/** UV1's screen gradients, before any branch, for the normal map's neighbouring texels. */
const MAIN_GRADIENTS = /* glsl */ `${MAIN}
	#if defined( GODOT_UV1_TRIPLANAR ) && defined( USE_NORMALMAP_TANGENTSPACE )
		vec3 godotUv1PositionDx = dFdx( vGodotUv1TriplanarPos );
		vec3 godotUv1PositionDy = dFdy( vGodotUv1TriplanarPos );
		vec3 godotUv1WeightsDx = dFdx( vGodotUv1PowerNormal );
		vec3 godotUv1WeightsDy = dFdy( vGodotUv1PowerNormal );
	#endif`;

const NORMAL_BEGIN = '#include <normal_fragment_begin>';

/**
 * Godot's frame in place of three's, after three's face flip: Godot flips the normal of a back face
 * and keeps its tangent and binormal (`scene_forward_clustered.glsl:1254-1265`).
 */
const TRIPLANAR_FRAME = `${NORMAL_BEGIN}
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_ANISOTROPY )
	tbn = mat3( vGodotTriplanarTangent, vGodotTriplanarBinormal, normal );
#endif`;

/**
 * `triplanar_texture` (`material.cpp:1496-1500`) for `map` in UV set `uv`. Each projection names the
 * map's sampler, so the mipmap bias finds every sample.
 */
function triplanarSample(map: TriplanarMap, uv: UvSet): string {
  const { position, weights } = projectionVaryings(uv);
  const sample = (coordinate: string) =>
    `texture2D( ${map}, godotTriplanarUv( ${map}Transform, ${coordinate} ) )`;
  return `( ${sample(`${position}.xy`)} * ${weights}.z + ${sample(`${position}.xz`)} * ${weights}.y + ${sample(
    `${position}.zy * vec2( - 1.0, 1.0 )`
  )} * ${weights}.x )`;
}

/**
 * The UV set of each map the sample rewrite projects. The normal map reads through
 * `GODOT_NORMAL_TEXEL` instead, as the roughness limiter reads its neighbours.
 */
function projectedMaps(record: Pick<TriplanarRecord, 'uv1Maps' | 'uv2Maps'>): Map<TriplanarMap, UvSet> {
  return new Map(
    UV_SETS.flatMap((uv) =>
      record[`${uv}Maps`].filter((map) => map !== 'normalMap').map((map) => [map, uv] as const)
    )
  );
}

/** The program text with each sample of `maps` in its UV set's projections. */
function triplanarSamples(maps: Map<TriplanarMap, UvSet>): (text: string) => string {
  if (maps.size === 0) return (text) => text;
  const pattern = new RegExp(
    String.raw`texture2D\(\s*(${[...maps.keys()].join('|')})\s*,\s*(v\w+Uv)\s*\)`,
    'g'
  );
  return (text) =>
    rewrittenShader(text, pattern, (sample, name) => {
      const map = name as TriplanarMap;
      return sample.includes(coordinateOf(map)) ? triplanarSample(map, maps.get(map)!) : sample;
    });
}

/** The window uniform of each map in `maps`, which the fragment program samples. */
function windowUniforms(maps: Map<TriplanarMap, UvSet>): string {
  return [...maps.keys()].map((map) => `uniform mat3 ${map}Transform;\n`).join('');
}

/**
 * The defines of one program state, in both stages. Godot writes the frame whenever a UV set
 * projects (`material.cpp:1386`), so `GODOT_TRIPLANAR_FRAME` is always on.
 */
function definesOf(record: TriplanarRecord): string[] {
  const defines = ['GODOT_TRIPLANAR_FRAME'];
  for (const uv of UV_SETS) {
    const projection = record[uv];
    if (!projection) continue;
    defines.push(projects(uv));
    if (projection.isWorld) defines.push(projectsWorld(uv));
  }
  if (record.isTangentWorld) defines.push('GODOT_TRIPLANAR_TANGENT_WORLD');
  if (record.isBillboard) defines.push('GODOT_TRIPLANAR_BILLBOARD');
  return defines;
}

/** The injection of one program state of a record. */
function triplanarProgram(record: TriplanarRecord, cacheKey: string): ProgramInjection {
  const defines = definesOf(record)
    .map((define) => `#define ${define}\n`)
    .join('');
  const maps = projectedMaps(record);
  const samples = triplanarSamples(maps);
  const windows = windowUniforms(maps);
  return {
    cacheKey,
    onBeforeCompile(shader) {
      Object.assign(
        shader.uniforms,
        nodePoseUniforms(this),
        projectionUniforms(this, 'uv1'),
        projectionUniforms(this, 'uv2')
      );
      editedProgram(
        shader,
        {
          vertex: [{ three: PROJECT_VERTEX, godot: VERTEX }],
          fragment: [{ three: MAIN, godot: MAIN_GRADIENTS }, ...litEdits(shader.fragmentShader)],
        },
        'triplanar mapping'
      );
      shader.vertexShader = `${defines}${VERTEX_PARS}${shader.vertexShader}`;
      shader.fragmentShader = `${defines}${FRAGMENT_PARS}${windows}${rewrittenThroughChunks(shader.fragmentShader, samples)}`;
    },
  };
}

/** The edits that only a lit program takes: none for a depth program or an unshaded one. */
const LIT_EDITS = [
  { three: NORMAL_MAP_PARS, godot: TRIPLANAR_NORMAL_TEXEL },
  { three: NORMAL_BEGIN, godot: TRIPLANAR_FRAME },
];

/** The edits of `LIT_EDITS` whose anchor `fragmentShader` holds. */
function litEdits(fragmentShader: string): { three: string; godot: string }[] {
  return LIT_EDITS.filter((edit) => fragmentShader.includes(edit.three));
}

/** The program state a record compiles to: what changes the program, not the values its uniforms read. */
function programKey(record: TriplanarRecord): string {
  return [
    'godot-triplanar',
    ...definesOf(record),
    `uv1:${record.uv1Maps.join(',')}`,
    `uv2:${record.uv2Maps.join(',')}`,
  ]
    .join(' ')
    .toLowerCase();
}

/** One injection per program state, so a re-parse that changes only a value keeps the program. */
const programs = new Map<string, ProgramInjection>();

/**
 * What a material whose `userData` records a triplanar mapping compiles with, colour and depth
 * programs alike. Undefined for one that records none.
 */
export function triplanarInjection(state: { userData?: unknown }): ProgramInjection | undefined {
  const userData = state.userData as Record<string, unknown> | undefined;
  const record = userData?.[TRIPLANAR_KEY] as TriplanarRecord | undefined;
  if (!record) return undefined;
  const key = programKey(record);
  let program = programs.get(key);
  if (!program) {
    program = triplanarProgram(record, key);
    programs.set(key, program);
  }
  return program;
}
