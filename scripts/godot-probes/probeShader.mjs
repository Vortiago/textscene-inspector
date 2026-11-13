/**
 * The Godot side of a probe: a `canvas_item` shader that runs the probe's function on each input
 * row and writes the bits of each result lane into one RGBA8 pixel. `scripts/godot-ref/` reads
 * 8-bit images only, and an 8-bit channel holds a byte exactly, so four channels hold a float's
 * 32 bits with no loss.
 */

import { laneBits, lanesOf } from '../../apps/textscene-three-godot-shaders/tests/probes/inputs.mjs';

/** The prefix of a vector type of each scalar kind, `ivec` for `int`. */
export const VECTOR_PREFIX = { bool: 'bvec', int: 'ivec', uint: 'uvec', float: 'vec' };

/** Each type a probe passes or returns: its scalar kind, its lane count and a matrix's column count. */
export const PROBE_TYPES = Object.fromEntries([
  ...Object.entries(VECTOR_PREFIX).flatMap(([scalar, prefix]) => [
    [scalar, { scalar, lanes: 1 }],
    ...[2, 3, 4].map((size) => [`${prefix}${size}`, { scalar, lanes: size }]),
  ]),
  ...[2, 3, 4].map((size) => [`mat${size}`, { scalar: 'float', lanes: size * size, columns: size }]),
]);

/** The lane count of each type a probe passes or returns, a matrix's columns one after the other. */
export const LANE_COUNT = Object.fromEntries(
  Object.entries(PROBE_TYPES).map(([type, { lanes }]) => [type, lanes])
);

/**
 * Written in the pixel after the last result. A shader that fails to compile draws nothing, so a
 * missing sentinel marks a probe Godot rejects.
 */
export const SENTINEL_BITS = 0xc0ffee01;

/** The precision words a type may follow, which leave the type's lanes as they are. */
const PRECISION = /\b(?:lowp|mediump|highp)\s+/g;

/** The return type, the parameter types and the parameter names of the probe's `probe` function. */
export function probeSignature(source) {
  const match = /^(\w+) probe\(([^)]*)\)/.exec(source.replace(PRECISION, ''));
  if (!match) throw new Error(`expected a probe source that starts with "<type> probe(", got ${source}`);
  const declarations =
    match[2].trim() === '' ? [] : match[2].split(',').map((parameter) => parameter.trim().split(/\s+/));
  const parameters = declarations.map(([type]) => type);
  const names = declarations.map(([, name]) => name);
  for (const type of [match[1], ...parameters]) {
    if (!(type in LANE_COUNT))
      throw new Error(`expected a probe type of ${Object.keys(LANE_COUNT).join(', ')}, got ${type}`);
  }
  return { returns: match[1], parameters, names };
}

/** The pixel count of a probe: one per result lane of each row, and the sentinel. */
export function probeWidth(probe) {
  return probe.inputs.length * LANE_COUNT[probeSignature(probe.source).returns] + 1;
}

/** The bits of each parameter's lanes, row after row: the uniform array the shader reads. */
export function parameterBits(probe) {
  const { parameters } = probeSignature(probe.source);
  return parameters.map((type, index) =>
    probe.inputs.flatMap((row) =>
      lanesOf(row[index]).map((value) => laneBits(PROBE_TYPES[type].scalar, value))
    )
  );
}

/** The shading language text of a probe's harness shader. */
export function probeShader(probe) {
  const { returns, parameters } = probeSignature(probe.source);
  const size = LANE_COUNT[returns];
  const uniforms = parameters.map(
    (type, index) => `uniform uint p${index}[${probe.inputs.length * LANE_COUNT[type]}];`
  );
  const argumentList = parameters.map((type, index) => readArgument(type, index)).join(', ');
  const lane = resultLane(returns);
  return `shader_type canvas_item;
render_mode blend_disabled;

${uniforms.join('\n')}

${probe.source}

void fragment() {
	int pixel = int(FRAGCOORD.x);
	int row = pixel / ${size};
	int lane = pixel % ${size};
	uint bits = ${SENTINEL_BITS}u;
	if (row < ${probe.inputs.length}) {
		${returns} result = probe(${argumentList});
		bits = ${BITS_OF[PROBE_TYPES[returns].scalar](lane)};
	}
	COLOR = vec4(uvec4(bits & 255u, (bits >> 8u) & 255u, (bits >> 16u) & 255u, bits >> 24u)) / 255.0;
}
`;
}

/** The shading language that reads a lane of each scalar kind from its uniform bits. */
const LANE_OF_BITS = {
  float: (bits) => `uintBitsToFloat(${bits})`,
  int: (bits) => `int(${bits})`,
  uint: (bits) => bits,
  bool: (bits) => `${bits} != 0u`,
};

/** The shading language that gives the bits of a lane of each scalar kind. */
const BITS_OF = {
  float: (lane) => `floatBitsToUint(${lane})`,
  int: (lane) => `uint(${lane})`,
  uint: (lane) => lane,
  bool: (lane) => `${lane} ? 1u : 0u`,
};

/** The lane of the result the pixel writes: a matrix's columns one after the other. */
function resultLane(type) {
  const { lanes, columns } = PROBE_TYPES[type];
  if (lanes === 1) return 'result';
  return columns === undefined ? 'result[lane]' : `result[lane / ${columns}][lane % ${columns}]`;
}

function readArgument(type, index) {
  const { scalar, lanes: size, columns } = PROBE_TYPES[type];
  const lanes = Array.from({ length: size }, (_, lane) =>
    LANE_OF_BITS[scalar](`p${index}[row * ${size} + ${lane}]`)
  );
  if (size === 1) return lanes[0];
  if (columns === undefined) return `${type}(${lanes.join(', ')})`;
  const columnVectors = Array.from(
    { length: columns },
    (_, column) => `vec${columns}(${lanes.slice(column * columns, (column + 1) * columns).join(', ')})`
  );
  return `${type}(${columnVectors.join(', ')})`;
}
