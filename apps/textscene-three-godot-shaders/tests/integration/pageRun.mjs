import { parameterBits, PROBE_TYPES } from '../../../../scripts/godot-probes/probeShader.mjs';

/** `{ bits }` per result lane, or `{ error, isRefusal }`, laid out from the Godot harness's type table. */
export function runOnPage(page, probe) {
  const spec = {
    source: probe.source,
    includes: probe.includes ?? {},
    rows: probe.inputs.length,
    parameters: parameterBits(probe),
    shapes: PROBE_TYPES,
    materialValues: probe.materialValues ?? {},
    textures: probe.textures ?? {},
    hdr2d: probe.hdr2d === true,
  };
  return page.evaluate((each) => globalThis.runProbe(each), spec);
}
