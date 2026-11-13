/**
 * The record of Godot's answers to the probes: for each probe its source, the bits of its inputs
 * and the bits of each result lane, or the fact that Godot rejects it. The real-GL test compares
 * the translation with this checked-in record, so it runs without Godot.
 */

import { LANE_COUNT, SENTINEL_BITS, parameterBits, probeSignature, probeWidth } from './probeShader.mjs';

/** What a probe records when Godot draws nothing for it: its shader does not compile. */
const REJECTED = 'Godot rejects the shader: it draws nothing, not even the sentinel';

export const hex = (bits) => bits.toString(16).padStart(8, '0');

/**
 * One probe's record entry from the pixels of its viewport. Godot gives a SubViewport two rows at
 * the least, and the probe draws the top one, so the entry reads the first `probeWidth` pixels.
 */
export function recordEntry(probe, viewportPixels) {
  const entry = { source: probe.source, inputs: parameterBits(probe).map((bits) => bits.map(hex)) };
  if (viewportPixels === undefined)
    throw new Error(`expected Godot's pixels for probe ${probe.name}, found none`);
  const pixels = viewportPixels.slice(0, probeWidth(probe));
  if (pixels.at(-1) !== SENTINEL_BITS) return { ...entry, rejected: REJECTED };
  const size = LANE_COUNT[probeSignature(probe.source).returns];
  const results = probe.inputs.map((_, row) => pixels.slice(row * size, (row + 1) * size).map(hex));
  return { ...entry, results };
}

/** The record of every probe, in probe order, as the JSON text the file holds. */
export function renderRecord({ godot, adapter, pixels }, probes) {
  const entries = Object.fromEntries(
    probes.map((probe) => [probe.name, recordEntry(probe, pixels.get(probe.name))])
  );
  return `${JSON.stringify({ godot, adapter, probes: entries }, null, 1)}\n`;
}
