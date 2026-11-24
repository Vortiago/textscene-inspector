import { LANE_COUNT, SENTINEL_BITS, parameterBits, probeSignature, probeWidth } from './probeShader.mjs';

/** The reason a probe records when Godot draws nothing for it and no run read Godot's message. */
const NO_REASON = { message: 'Godot draws nothing, not even the sentinel' };

export const hex = (bits) => bits.toString(16).padStart(8, '0');

/** Godot gives a SubViewport two rows at the least, and the probe draws the top one. */
function drawnPixels(probe, viewportPixels) {
  if (viewportPixels === undefined)
    throw new Error(`expected Godot's pixels for probe ${probe.name}, found none`);
  return viewportPixels.slice(0, probeWidth(probe));
}

/** Whether Godot drew `probe`: its last pixel is the sentinel, which a shader that fails lacks. */
export const isDrawn = (probe, viewportPixels) => drawnPixels(probe, viewportPixels).at(-1) === SENTINEL_BITS;

/** `rejection` for a probe without pixels: Godot's stage, message and line. */
export function recordEntry(probe, viewportPixels, rejection = NO_REASON, preprocessed = undefined) {
  const entry = {
    ...probeText(probe),
    inputs: parameterBits(probe).map((bits) => bits.map(hex)),
    ...(preprocessed === undefined ? {} : { preprocessed }),
  };
  if (probe.endsGodot || !isDrawn(probe, viewportPixels)) return { ...entry, rejected: rejection };
  const pixels = drawnPixels(probe, viewportPixels);
  const size = LANE_COUNT[probeSignature(probe.source).returns];
  const results = probe.inputs.map((_, row) => pixels.slice(row * size, (row + 1) * size).map(hex));
  return { ...entry, results };
}

/** `rejections` holds Godot's reason for each probe it draws nothing for, by name. */
export function probeRecord({ godot, adapter, pixels, preprocessed }, probes, rejections) {
  const entries = Object.fromEntries(
    probes.map((probe) => [
      probe.name,
      recordEntry(probe, pixels.get(probe.name), rejections.get(probe.name), preprocessed.get(probe.name)),
    ])
  );
  return { godot, adapter, probes: entries };
}

/** The text of a probe and what its material sets: an include, a value, a texture or an HDR 2D viewport. */
function probeText(probe) {
  return {
    source: probe.source,
    ...(probe.includes === undefined ? {} : { includes: probe.includes }),
    ...(probe.materialValues === undefined ? {} : { materialValues: probe.materialValues }),
    ...(probe.textures === undefined ? {} : { textures: probe.textures }),
    ...(probe.hdr2d ? { hdr2d: true } : {}),
  };
}

/** Whether `entry` holds another source or other inputs than `probe` has now. */
export function isStaleEntry(entry, probe) {
  const inputs = parameterBits(probe).map((bits) => bits.map(hex));
  const { source, includes, materialValues, textures, hdr2d } = probeText(probe);
  return (
    entry.source !== source ||
    JSON.stringify(entry.includes) !== JSON.stringify(includes) ||
    JSON.stringify(entry.materialValues) !== JSON.stringify(materialValues) ||
    JSON.stringify(entry.textures) !== JSON.stringify(textures) ||
    entry.hdr2d !== hdr2d ||
    JSON.stringify(entry.inputs) !== JSON.stringify(inputs)
  );
}
