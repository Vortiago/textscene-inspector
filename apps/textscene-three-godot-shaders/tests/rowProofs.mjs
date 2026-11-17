import { SKY_SCENES } from './e2e/skyScenes.mjs';
import { HEAD_CASES } from './heads/headCases.mjs';
import { PROBES } from './probes/probes.mjs';

/**
 * What proves a row transpiled: a probe, a sky scene, or a head case that names it. No probe runs a
 * sky shader or has a head, so a sky scene's showcase and a head case's verdict prove those rows.
 */
export const ROW_PROOFS = [
  ...PROBES,
  ...SKY_SCENES,
  ...HEAD_CASES.filter(({ rows }) => rows.length > 0).map(({ id, rows }) => ({
    name: `head-${id}`,
    rows,
    isVerdictCase: true,
  })),
];
