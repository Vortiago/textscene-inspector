/** Reads a `probe_data` Dictionary literal for the fields `_set_probe_data` requires. */

import { LIGHTMAP_PROBE_DATA_FIELDS } from '../../godot/scene/lightmapGi';

const PROBE_DATA_FIELD_KEYS = LIGHTMAP_PROBE_DATA_FIELDS.map((field) => ({
  field,
  key: new RegExp(`"${field}"\\s*:`),
}));

/** The first required field the literal has no key for, or null when it has them all. */
export function missingProbeDataField(probeData: string): string | null {
  return PROBE_DATA_FIELD_KEYS.find(({ key }) => !key.test(probeData))?.field ?? null;
}
