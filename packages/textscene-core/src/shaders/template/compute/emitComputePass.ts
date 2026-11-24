import * as THREE from 'three';
import {
  int,
  positionGeometry,
  screenCoordinate,
  screenSize,
  uint,
  uniform,
  uvec3,
  vec4,
  vertexIndex,
} from 'three/tsl';
import type { Node, TextureNode, UniformNode } from 'three/webgpu';
import { BoundNodeMaterial } from '../../uniforms/boundMaterial.js';
import { emitTemplateStage, programResources } from '../emitTemplate.js';
import type { RowTexture } from '../rowTexture.js';
import { COMPUTE_COLOR, COMPUTE_ENTRY, type ComputePass } from './computePasses.js';
import {
  COMPUTE_ATLAS_SIZE,
  COMPUTE_PLACE,
  COMPUTE_VALUE,
  computeOriginName,
  computeSizeName,
} from './scatterPasses.js';

/** A compute pass as one draw: a triangle over its target or a point per invocation, by name its inputs. */
export interface ComputeDraw {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  /** The template's uniforms by `instance.member`, `params.size`, and a scatter's by `compute_` names. */
  readonly uniforms: ReadonlyMap<string, UniformNode<unknown>>;
  /** The template's textures by name: `source_octmap`, `compute_shared_samples`. */
  readonly textures: ReadonlyMap<string, TextureNode>;
  /** The template's buffers by instance name, each a row texture the host writes: `data`. */
  readonly buffers: ReadonlyMap<string, RowTexture>;
  /** A scatter's points for the invocations `x` by `y` by `z` of a dispatch: one point each. */
  readonly dispatch?: (extent: readonly [number, number, number]) => void;
}

/** The draw of `pass`: a fragment at each texel is its invocation, or a point is an invocation's store. */
export function emitComputePass(pass: ComputePass): ComputeDraw {
  if (pass.target.kind === 'scatter') return emitScatterPass(pass, pass.target.images.length);
  const resources = programResources();
  const stage = emitTemplateStage(
    pass.stage,
    invocationIds(pass.groupSize),
    { name: COMPUTE_COLOR, type: 'vec4' },
    resources
  );
  return {
    mesh: passMesh(stage.result),
    uniforms: resources.uniforms.byName,
    textures: resources.textures,
    buffers: resources.buffers.byName,
  };
}

/** A point for each invocation of a dispatch, at the atlas texel of the store it keeps. */
function emitScatterPass(pass: ComputePass, imageCount: number): ComputeDraw {
  const resources = programResources();
  const dispatch = uniform(new THREE.Vector3(1, 1, 1)) as unknown as UniformNode<THREE.Vector3>;
  const scatter = new Map<string, UniformNode<unknown>>([
    ['compute_dispatch', dispatch as UniformNode<unknown>],
    [COMPUTE_ATLAS_SIZE, uniform(new THREE.Vector2(1, 1)) as unknown as UniformNode<unknown>],
  ]);
  for (let index = 0; index < imageCount; index += 1) {
    scatter.set(computeOriginName(index), uniform(new THREE.Vector2()) as unknown as UniformNode<unknown>);
    scatter.set(computeSizeName(index), uniform(new THREE.Vector2()) as unknown as UniformNode<unknown>);
  }
  const value = resources.varyings.of('vec4', COMPUTE_VALUE, true);
  const inputs = new Map<string, Node>([
    ...invocationIdsOf(dispatchId(dispatch), pass.groupSize),
    ...[...scatter].map(([name, node]) => [name, node as unknown as Node] as const),
    [COMPUTE_VALUE, value],
  ]);
  const stage = emitTemplateStage(pass.stage, inputs, { name: COMPUTE_PLACE, type: 'vec4' }, resources);
  const uniforms = new Map([...resources.uniforms.byName, ...scatter]);
  const mesh = pointsOf(stage.result, value);
  const dispatchTo = ([x, y, z]: readonly [number, number, number]) => {
    (dispatch.value as THREE.Vector3).set(x, y, z);
    mesh.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(x * y * z * 3), 3));
  };
  return {
    mesh,
    uniforms,
    textures: resources.textures,
    buffers: resources.buffers.byName,
    dispatch: dispatchTo,
  };
}

/** The global id of the point's invocation, the dispatch's invocations counted x first, as Godot counts. */
function dispatchId(dispatch: UniformNode<THREE.Vector3>): Node {
  const extent = uvec3(dispatch as unknown as ReturnType<typeof uvec3>);
  const index = uint(vertexIndex);
  const across = index.mod(extent.x);
  const down = index.div(extent.x).mod(extent.y);
  return uvec3(across, down, index.div(extent.x.mul(extent.y))) as unknown as Node;
}

/** Points the dispatch sizes, each at `place` with the colour `value`. */
function pointsOf(place: Node, value: Node): THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  const geometry = new THREE.BufferGeometry();
  const material = new BoundNodeMaterial();
  material.vertexNode = place;
  material.fragmentNode = value;
  material.depthTest = false;
  material.depthWrite = false;
  const points = new THREE.Points(geometry, material as unknown as THREE.Material);
  points.frustumCulled = false;
  return points as unknown as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
}

/** The ids of the texel's invocation, rows counted from a target's first, as Godot's image counts them. */
function invocationIds(groupSize: readonly [number, number, number]): Map<string, Node> {
  const column = uint(screenCoordinate.x);
  const row = uint(screenSize.y.sub(screenCoordinate.y));
  const ids = invocationIdsOf(uvec3(column, row, uint(0)) as unknown as Node, groupSize);
  ids.set(COMPUTE_ENTRY, int(column) as unknown as Node);
  return ids;
}

/** The ids of the invocation `globalId` in groups of `x` by `y` by `z`. */
function invocationIdsOf(globalId: Node, [x, y, z]: readonly [number, number, number]): Map<string, Node> {
  const global = uvec3(globalId as unknown as ReturnType<typeof uvec3>);
  const size = uvec3(uint(x), uint(y), uint(z));
  const local = global.mod(size);
  const index = local.x.add(local.y.mul(uint(x))).add(local.z.mul(uint(x * y)));
  return new Map([
    ['gl_GlobalInvocationID', global as unknown as Node],
    ['gl_LocalInvocationID', local as unknown as Node],
    ['gl_WorkGroupID', global.div(size) as unknown as Node],
    ['gl_LocalInvocationIndex', index as unknown as Node],
    ['gl_WorkGroupSize', size as unknown as Node],
  ]);
}

/** The triangle that covers the target. */
function passMesh(colour: Node): THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(FULL_SCREEN_TRIANGLE, 3));
  const material = new BoundNodeMaterial();
  material.vertexNode = vec4(positionGeometry.xy, 0, 1) as unknown as Node;
  material.fragmentNode = colour;
  material.depthTest = false;
  material.depthWrite = false;
  const mesh = new THREE.Mesh(geometry, material as unknown as THREE.Material);
  mesh.frustumCulled = false;
  return mesh;
}

const FULL_SCREEN_TRIANGLE = new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]);
