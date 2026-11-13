/**
 * The Godot side of a probe: a `canvas_item` shader that runs the probe's function on each input
 * row and writes the bits of each result lane into one RGBA8 pixel. `scripts/godot-ref/` reads
 * 8-bit images only, and an 8-bit channel holds a byte exactly, so four channels hold a float's
 * 32 bits with no loss.
 */

import { floatBits, lanesOf } from '../../apps/textscene-three-godot-shaders/tests/probes/inputs.mjs';

/** The lane count of each type a probe passes or returns. */
export const LANE_COUNT = { float: 1, vec2: 2, vec3: 3, vec4: 4 };

/**
 * Written in the pixel after the last result. A shader that fails to compile draws nothing, so a
 * missing sentinel marks a probe Godot rejects.
 */
export const SENTINEL_BITS = 0xc0ffee01;

/** The return type and the parameter types of the probe's `probe` function. */
export function probeSignature(source) {
  const match = /^(\w+) probe\(([^)]*)\)/.exec(source);
  if (!match) throw new Error(`expected a probe source that starts with "<type> probe(", got ${source}`);
  const parameters =
    match[2].trim() === '' ? [] : match[2].split(',').map((parameter) => parameter.trim().split(/\s+/)[0]);
  for (const type of [match[1], ...parameters]) {
    if (!(type in LANE_COUNT))
      throw new Error(`expected a probe type of ${Object.keys(LANE_COUNT).join(', ')}, got ${type}`);
  }
  return { returns: match[1], parameters };
}

/** The pixel count of a probe: one per result lane of each row, and the sentinel. */
export function probeWidth(probe) {
  return probe.inputs.length * LANE_COUNT[probeSignature(probe.source).returns] + 1;
}

/** The bits of each parameter's lanes, row after row: the uniform array the shader reads. */
export function parameterBits(probe) {
  const { parameters } = probeSignature(probe.source);
  return parameters.map((_, index) => probe.inputs.flatMap((row) => lanesOf(row[index]).map(floatBits)));
}

/** The shading language text of a probe's harness shader. */
export function probeShader(probe) {
  const { returns, parameters } = probeSignature(probe.source);
  const size = LANE_COUNT[returns];
  const uniforms = parameters.map(
    (type, index) => `uniform uint p${index}[${probe.inputs.length * LANE_COUNT[type]}];`
  );
  const argumentList = parameters.map((type, index) => readArgument(type, index)).join(', ');
  const lane = size === 1 ? 'result' : 'result[lane]';
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
		bits = floatBitsToUint(${lane});
	}
	COLOR = vec4(uvec4(bits & 255u, (bits >> 8u) & 255u, (bits >> 16u) & 255u, bits >> 24u)) / 255.0;
}
`;
}

function readArgument(type, index) {
  const size = LANE_COUNT[type];
  const lanes = Array.from(
    { length: size },
    (_, lane) => `uintBitsToFloat(p${index}[row * ${size} + ${lane}])`
  );
  return size === 1 ? lanes[0] : `${type}(${lanes.join(', ')})`;
}
