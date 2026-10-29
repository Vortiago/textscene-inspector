/**
 * The CPUParticles2D and CPUParticles3D parameter slot keys. Each parser reads `<prefix>_min`,
 * `_max` and `_curve` through a table (`properties[`${prefix}_min`]`), which the `properties.X`
 * scrape cannot see. Derived from the parsers' own table, so a renamed prefix or dropped slot moves
 * both sides at once.
 */

import { PARAM_SLOTS } from '../../../nodes/shared/cpuparticles/params.js';

export const PARTICLE_PARAM_KEYS: readonly string[] = PARAM_SLOTS.flatMap(({ prefix, curve }) => [
  `${prefix}_min`,
  `${prefix}_max`,
  ...(curve ? [`${prefix}_curve`] : []),
]);
