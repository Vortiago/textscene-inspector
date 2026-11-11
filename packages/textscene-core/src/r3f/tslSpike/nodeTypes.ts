/** Names for the TSL node types the lit surface passes between its functions. */

import type { Node, NodeBuilder } from 'three/webgpu';

export type FloatNode = Node<'float'>;
export type IntNode = Node<'int'>;
export type Vec2Node = Node<'vec2'>;
export type Vec3Node = Node<'vec3'>;

/** The four sums a lighting model adds to. */
export interface ReflectedLight {
  directDiffuse: Vec3Node;
  directSpecular: Vec3Node;
  indirectDiffuse: Vec3Node;
  indirectSpecular: Vec3Node;
}

/** What three's `LightingContextNode` hands each lighting node (r187 `LightingContextNode.js:66-90`). */
export interface LightingContext {
  radiance: Vec3Node;
  irradiance: Vec3Node;
  iblIrradiance: Vec3Node;
  reflectedLight: ReflectedLight;
  lightingModel: unknown;
}

/** `builder.context` while a material's lighting builds. three's types leave it `unknown`. */
export function lightingContextOf(builder: NodeBuilder): LightingContext {
  return builder.context as LightingContext;
}
