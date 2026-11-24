import * as THREE from 'three';
import { int, positionGeometry, screenCoordinate, screenSize, uint, uvec3, vec4 } from 'three/tsl';
import type { Node, TextureNode, UniformNode } from 'three/webgpu';
import { BoundNodeMaterial } from '../../uniforms/boundMaterial.js';
import { emitTemplateStage, programResources } from '../emitTemplate.js';
import { COMPUTE_COLOR, COMPUTE_ENTRY, type ComputePass } from './computePasses.js';

/** A compute pass as one draw: a triangle over its target, its uniforms and its textures by name. */
export interface ComputeDraw {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  /** The template's uniforms by `instance.member`: `params.size`. */
  readonly uniforms: ReadonlyMap<string, UniformNode<unknown>>;
  /** The template's textures by name: `source_octmap`, `compute_shared_samples`. */
  readonly textures: ReadonlyMap<string, TextureNode>;
}

/** The draw of `pass`, whose fragment at a texel of its target is the invocation of that texel. */
export function emitComputePass(pass: ComputePass): ComputeDraw {
  const resources = programResources();
  const stage = emitTemplateStage(
    pass.stage,
    invocationIds(pass.groupSize),
    { name: COMPUTE_COLOR, type: 'vec4' },
    resources
  );
  return { mesh: passMesh(stage.result), uniforms: resources.uniforms.byName, textures: resources.textures };
}

/** The ids of the texel's invocation, rows counted from a target's first, as Godot's image counts them. */
function invocationIds([x, y, z]: readonly [number, number, number]): Map<string, Node> {
  const column = uint(screenCoordinate.x);
  const row = uint(screenSize.y.sub(screenCoordinate.y));
  const global = uvec3(column, row, uint(0));
  const size = uvec3(uint(x), uint(y), uint(z));
  const local = global.mod(size);
  const index = local.x.add(local.y.mul(uint(x))).add(local.z.mul(uint(x * y)));
  return new Map([
    ['gl_GlobalInvocationID', global as unknown as Node],
    ['gl_LocalInvocationID', local as unknown as Node],
    ['gl_WorkGroupID', global.div(size) as unknown as Node],
    ['gl_LocalInvocationIndex', index as unknown as Node],
    ['gl_WorkGroupSize', size as unknown as Node],
    [COMPUTE_ENTRY, int(column) as unknown as Node],
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
