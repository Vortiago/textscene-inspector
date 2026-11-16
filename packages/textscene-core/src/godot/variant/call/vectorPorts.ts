import type { CastArgument } from '../utility/utilityArguments.js';
import type { Variant } from '../value/variant.js';
import { methodPort, type MethodParameter, type MethodPort } from './methodPort.js';

const XY = ['x', 'y'] as const;
const XYZ = ['x', 'y', 'z'] as const;
const XYZW = ['x', 'y', 'z', 'w'] as const;

const AXES = {
  VECTOR2: XY,
  VECTOR2I: XY,
  VECTOR3: XYZ,
  VECTOR3I: XYZ,
  VECTOR4: XYZW,
  VECTOR4I: XYZW,
} as const;

export type VectorType = keyof typeof AXES;
export type Components = readonly number[];

export function componentsOf(vector: Variant): Components {
  const value = vector.value as Readonly<Record<string, number>>;
  return AXES[vector.type as VectorType].map((axis) => value[axis]!);
}

export function vectorOf(type: VectorType, components: Components): Variant {
  const value = Object.fromEntries(AXES[type].map((axis, index) => [axis, components[index]!]));
  return { type, value } as Variant;
}

// vector4.cpp:37: a later axis wins a tie, and a NaN loses every comparison.
export function lastMinimumIndex(v: Components): number {
  let index = 0;
  for (let i = 1; i < v.length; i++) if (v[i]! <= v[index]!) index = i;
  return index;
}

export function firstMaximumIndex(v: Components): number {
  let index = 0;
  for (let i = 1; i < v.length; i++) if (v[i]! > v[index]!) index = i;
  return index;
}

/** The cast arguments of one call, read as the vectors and scalars its parameters declare. */
export interface VectorArguments {
  readonly vector: (index: number) => Components;
  readonly scalar: (index: number) => number;
}

const readArguments = (args: readonly CastArgument[]): VectorArguments => ({
  vector: (index) => componentsOf(args[index] as Variant),
  scalar: (index) => args[index] as number,
});

/** The port shapes of the methods of one vector type, whose scalar parameter is `scalar`. */
export function vectorPorts(type: VectorType, scalar: MethodParameter) {
  const run =
    (body: (self: Components, args: VectorArguments) => Variant) =>
    (base: Variant, args: readonly CastArgument[]) =>
      body(componentsOf(base), readArguments(args));
  return {
    vector: (components: Components) => vectorOf(type, components),
    unary: (body: (self: Components) => Variant): MethodPort => methodPort([], run(body)),
    withVector: (body: (self: Components, other: Components) => Variant): MethodPort =>
      methodPort(
        [type],
        run((self, args) => body(self, args.vector(0)))
      ),
    withScalar: (body: (self: Components, value: number) => Variant): MethodPort =>
      methodPort(
        [scalar],
        run((self, args) => body(self, args.scalar(0)))
      ),
    withArguments: (
      parameters: readonly ('vector' | 'scalar')[],
      body: (self: Components, args: VectorArguments) => Variant
    ): MethodPort =>
      methodPort(
        parameters.map((parameter) => (parameter === 'vector' ? type : scalar)),
        run(body)
      ),
  };
}

export type VectorPorts = ReturnType<typeof vectorPorts>;
