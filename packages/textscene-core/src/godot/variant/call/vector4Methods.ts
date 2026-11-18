import { axis, floatVectorMethods } from './floatVectorMethods.js';
import type { MethodPort } from './methodPort.js';
import { firstMaximumIndex, lastMinimumIndex, vectorPorts } from './vectorPorts.js';

const { vector, unary } = vectorPorts('VECTOR4', 'float');

export const VECTOR4_METHODS: Readonly<Record<string, MethodPort>> = {
  ...floatVectorMethods('VECTOR4'),
  min_axis_index: unary((v) => axis(lastMinimumIndex(v))),
  max_axis_index: unary((v) => axis(firstMaximumIndex(v))),
  inverse: unary((v) => vector(v.map((c) => Math.fround(1 / c)))),
};
