import type { float, vec2, vec3, vec4 } from 'three/tsl';

/** The TSL scalar and vector node types, which three's types give only through the builder functions. */
export type Float = ReturnType<typeof float>;
export type Vec2 = ReturnType<typeof vec2>;
export type Vec3 = ReturnType<typeof vec3>;
export type Vec4 = ReturnType<typeof vec4>;

/** A node three's types give no `toStack`, which adds it to the function being built. */
export interface Stacked {
  toStack(): void;
}
