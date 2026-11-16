import { clamp, cMax, cMin } from '../../math/math.js';
import type { CastArgument } from '../utility/utilityArguments.js';
import type { Variant } from '../value/variant.js';
import { methodPort, type MethodParameter, type MethodPort } from './methodPort.js';
import {
  componentsOf as structComponents,
  structOf,
  type StructVariant,
  type VectorTypeName,
} from '../value/mathLayout.js';

export type VectorType = VectorTypeName;
export type Components = readonly number[];

export const componentsOf = (vector: Variant): Components => structComponents(vector as StructVariant);

export const vectorOf = (type: VectorType, components: Components): Variant => structOf(type, components);

export const each2 = (a: Components, b: Components, map: (p: number, q: number) => number): Components =>
  a.map((component, index) => map(component, b[index]!));

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

/** `clamp`, `min` and `max` by vector and by scalar, the scalar forms named with `suffix`. */
export function boundMethods(
  type: VectorType,
  scalar: MethodParameter,
  suffix: 'f' | 'i'
): Readonly<Record<string, MethodPort>> {
  const { vector, withVector, withScalar, withArguments } = vectorPorts(type, scalar);
  return {
    min: withVector((v, other) => vector(each2(v, other, cMin))),
    [`min${suffix}`]: withScalar((v, value) => vector(v.map((c) => cMin(c, value)))),
    max: withVector((v, other) => vector(each2(v, other, cMax))),
    [`max${suffix}`]: withScalar((v, value) => vector(v.map((c) => cMax(c, value)))),
    clamp: withArguments(['vector', 'vector'], (v, args) => {
      const [min, max] = [args.vector(0), args.vector(1)];
      return vector(v.map((c, index) => clamp(c, min[index]!, max[index]!)));
    }),
    [`clamp${suffix}`]: withArguments(['scalar', 'scalar'], (v, args) =>
      vector(v.map((c) => clamp(c, args.scalar(0), args.scalar(1))))
    ),
  };
}
