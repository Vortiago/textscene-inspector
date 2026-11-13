/** Names for the TSL node types the lit surface passes between its functions. */

import type { Node, NodeBuilder } from 'three/webgpu';

export type BoolNode = Node<'bool'>;
export type FloatNode = Node<'float'>;
export type IntNode = Node<'int'>;
export type IVec2Node = Node<'ivec2'>;
export type Vec2Node = Node<'vec2'>;
export type Vec3Node = Node<'vec3'>;
export type Vec4Node = Node<'vec4'>;

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

/**
 * What a Godot light node hands the lighting model's `direct`, beside three's direction and colour:
 * the terms `light_compute` reads that three's light data lacks.
 */
export interface GodotDirectLightData {
  lightDirection: Vec3Node;
  lightColor: Vec3Node;
  /** The shadow of a directional light. Godot's rim and transmittance read the colour without it. */
  attenuation: FloatNode;
  /** The light's size offset `A`. */
  A: FloatNode;
  specularAmount: FloatNode;
}
