/** A LightmapGIData `probe_data` of one tetrahedron over four points, for tests of the capture probes. */

export const FOUR_POINTS = 'PackedVector3Array(0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1)';

/** The nine spherical harmonics colours of each of the four points. */
export const SH_OF_FOUR = `PackedColorArray(${Array(4 * 9 * 4)
  .fill(0)
  .join(', ')})`;
