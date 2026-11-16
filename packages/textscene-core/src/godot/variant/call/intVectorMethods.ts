import { sign, snapped } from '../../math/math.js';
import { doubleToInt32 } from '../cInteger.js';
import { variant } from '../value/variant.js';
import { axis, real } from './floatVectorMethods.js';
import type { MethodPort } from './methodPort.js';
import {
  boundMethods,
  each2,
  firstMaximumIndex,
  lastMinimumIndex,
  vectorPorts,
  type Components,
} from './vectorPorts.js';

type IntVectorType = 'VECTOR2I' | 'VECTOR3I' | 'VECTOR4I';

const f = Math.fround;

const minus = (a: Components, b: Components) => each2(a, b, (p, q) => (p - q) | 0);
const lengthSquared = (v: Components) =>
  BigInt.asIntN(
    64,
    v.reduce((sum, c) => sum + BigInt(c) * BigInt(c), 0n)
  );
const length = (v: Components) => Math.sqrt(Number(lengthSquared(v)));
const snappedInt = (value: number, step: number) => doubleToInt32(snapped(value, step));

// vector3i.cpp:35: on integers each type's ternaries and loops agree, so one loop serves them all.
function intVectorMethods(type: IntVectorType): Readonly<Record<string, MethodPort>> {
  const { vector, unary, withVector, withScalar } = vectorPorts(type, 'int32_t');
  return {
    ...boundMethods(type, 'int32_t', 'i'),
    min_axis_index: unary((v) => axis(lastMinimumIndex(v))),
    max_axis_index: unary((v) => axis(firstMaximumIndex(v))),
    length: unary((v) => real(length(v))),
    length_squared: unary((v) => variant('INT', lengthSquared(v))),
    distance_to: withVector((v, to) => real(length(minus(to, v)))),
    distance_squared_to: withVector((v, to) => variant('INT', lengthSquared(minus(to, v)))),
    sign: unary((v) => vector(v.map(sign))),
    abs: unary((v) => vector(v.map((c) => (c > 0 ? c : -c | 0)))),
    snapped: withVector((v, step) => vector(each2(v, step, snappedInt))),
    snappedi: withScalar((v, step) => vector(v.map((c) => snappedInt(c, step)))),
  };
}

export const VECTOR2I_METHODS: Readonly<Record<string, MethodPort>> = {
  ...intVectorMethods('VECTOR2I'),
  aspect: vectorPorts('VECTOR2I', 'int32_t').unary(([x, y]) => real(f(f(x!) / f(y!)))),
};
export const VECTOR3I_METHODS = intVectorMethods('VECTOR3I');
export const VECTOR4I_METHODS = intVectorMethods('VECTOR4I');
