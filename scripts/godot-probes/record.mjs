/**
 * The record of Godot's answers to the probes, as a live run writes it: for each probe its
 * source, the bits of its inputs and the bits of each result lane, or Godot's reason when it
 * rejects it. The real-GL test compares the transpilation with this record.
 */

import { LANE_COUNT, SENTINEL_BITS, parameterBits, probeSignature, probeWidth } from './probeShader.mjs';

/** The reason a probe records when Godot draws nothing for it and no run read Godot's message. */
const NO_REASON = { message: 'Godot draws nothing, not even the sentinel' };

export const hex = (bits) => bits.toString(16).padStart(8, '0');

/**
 * The pixels a probe draws. Godot gives a SubViewport two rows at the least, and the probe draws
 * the top one, so these are the first `probeWidth` pixels.
 */
function drawnPixels(probe, viewportPixels) {
  if (viewportPixels === undefined)
    throw new Error(`expected Godot's pixels for probe ${probe.name}, found none`);
  return viewportPixels.slice(0, probeWidth(probe));
}

/** Whether Godot drew `probe`: its last pixel is the sentinel, which a shader that fails lacks. */
export const isDrawn = (probe, viewportPixels) => drawnPixels(probe, viewportPixels).at(-1) === SENTINEL_BITS;

/**
 * One probe's record entry from the pixels of its viewport, with `rejection`, Godot's stage,
 * message and line, for a probe Godot draws nothing for or that ends Godot, which has no pixels.
 */
export function recordEntry(probe, viewportPixels, rejection = NO_REASON) {
  const entry = { source: probe.source, inputs: parameterBits(probe).map((bits) => bits.map(hex)) };
  if (probe.endsGodot || !isDrawn(probe, viewportPixels)) return { ...entry, rejected: rejection };
  const pixels = drawnPixels(probe, viewportPixels);
  const size = LANE_COUNT[probeSignature(probe.source).returns];
  const results = probe.inputs.map((_, row) => pixels.slice(row * size, (row + 1) * size).map(hex));
  return { ...entry, results };
}

/**
 * The record of every probe, in probe order. `rejections` holds Godot's reason for each probe it
 * draws nothing for, by name.
 */
export function probeRecord({ godot, adapter, pixels }, probes, rejections) {
  const entries = Object.fromEntries(
    probes.map((probe) => [
      probe.name,
      recordEntry(probe, pixels.get(probe.name), rejections.get(probe.name)),
    ])
  );
  return { godot, adapter, probes: entries };
}

/** Whether `entry` holds another source or other inputs than `probe` has now. */
export function isStaleEntry(entry, probe) {
  const inputs = parameterBits(probe).map((bits) => bits.map(hex));
  return entry.source !== probe.source || JSON.stringify(entry.inputs) !== JSON.stringify(inputs);
}
