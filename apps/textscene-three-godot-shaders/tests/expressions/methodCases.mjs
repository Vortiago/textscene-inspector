import { BUILTIN_TYPES } from '../../../../packages/textscene-core/src/godot/variant/call/builtinTypes.generated.ts';

/** The types whose methods the port runs: each later part of the slice adds its types here. */
export const PORTED_METHOD_TYPES = ['Vector2', 'Vector2i', 'Vector3', 'Vector3i', 'Vector4', 'Vector4i'];

/** A typical value of each type, then its edges: zero, a negative zero, the float limits, NaN and infinity. */
export const EDGE_VALUES = {
  float: ['0.3', ['0', '-0.0', '-2.5', '1e30', '1e-30', 'NAN', 'INF']],
  int: ['3', ['0', '-1', '-7', '2147483647', '-2147483648', '4294967297']],
  bool: ['true', ['false']],
  Vector2: [
    'Vector2(0.6, -0.8)',
    [
      'Vector2(0, 0)',
      'Vector2(-0.0, 0)',
      'Vector2(3, -4)',
      'Vector2(1e30, -1e30)',
      'Vector2(1e-30, 3e-30)',
      'Vector2(NAN, 1)',
      'Vector2(INF, -INF)',
    ],
  ],
  Vector2i: [
    'Vector2i(3, -4)',
    ['Vector2i(0, 0)', 'Vector2i(-7, 2)', 'Vector2i(2147483647, -2147483648)', 'Vector2i(-1, -1)'],
  ],
  Vector3: [
    'Vector3(0.6, 0, -0.8)',
    [
      'Vector3(0, 0, 0)',
      'Vector3(-0.0, 0, -0.0)',
      'Vector3(1, 2, 3)',
      'Vector3(1e30, -1e30, 1e30)',
      'Vector3(1e-30, 3e-30, -2e-30)',
      'Vector3(NAN, 1, 2)',
      'Vector3(INF, -INF, 0)',
    ],
  ],
  Vector3i: [
    'Vector3i(3, -4, 5)',
    [
      'Vector3i(0, 0, 0)',
      'Vector3i(-7, 2, 2)',
      'Vector3i(2147483647, -2147483648, 0)',
      'Vector3i(-1, -1, -1)',
    ],
  ],
  Vector4: [
    'Vector4(0.5, -0.5, 0.5, -0.5)',
    [
      'Vector4(0, 0, 0, 0)',
      'Vector4(-0.0, 0, -0.0, 0)',
      'Vector4(1, 2, 3, 4)',
      'Vector4(1e30, -1e30, 1e30, -1e30)',
      'Vector4(1e-30, 3e-30, -2e-30, 1e-30)',
      'Vector4(NAN, 1, 2, 3)',
      'Vector4(INF, -INF, 0, 1)',
    ],
  ],
  Vector4i: [
    'Vector4i(3, -4, 5, -6)',
    [
      'Vector4i(0, 0, 0, 0)',
      'Vector4i(-7, 2, 2, -7)',
      'Vector4i(2147483647, -2147483648, 0, 1)',
      'Vector4i(-1, -1, -1, -1)',
    ],
  ],
};

// A text no method parameter takes, so the binder's check fails and the method runs on the cast value.
const WRONG_TYPE = '"x"';

const typical = (type) => EDGE_VALUES[type][0];
const edges = (type) => EDGE_VALUES[type][1];

/** The calls of one method: each base edge with typical arguments, then each argument through its edges. */
function callTexts(type, [name, , , , parameters]) {
  const argumentTypes = parameters.map(([argumentType]) => argumentType);
  const typicalArguments = argumentTypes.map(typical);
  const call = (base, args) => `${base}.${name}(${args.join(', ')})`;
  const baseCalls = [typical(type), ...edges(type)].map((base) => call(base, typicalArguments));
  const argumentCalls = argumentTypes.flatMap((argumentType, index) =>
    [...edges(argumentType), WRONG_TYPE].map((value) =>
      call(typical(type), typicalArguments.with(index, value))
    )
  );
  return [...baseCalls, ...argumentCalls];
}

/** Every generated method call of the ported types, in a fixed order. */
export function methodCases() {
  return PORTED_METHOD_TYPES.flatMap((type) =>
    BUILTIN_TYPES[type].methods.flatMap((row) =>
      callTexts(type, row).map((text, index) => ({
        id: `method ${type}.${row[0]} ${index} ${JSON.stringify(text)}`,
        text,
      }))
    )
  );
}
