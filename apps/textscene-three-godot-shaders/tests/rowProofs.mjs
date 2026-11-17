import { SKY_SCENES } from './e2e/skyScenes.mjs';
import { HEAD_CASES } from './heads/headCases.mjs';
import { PROBES } from './probes/probes.mjs';

/** A sky scene's showcase and a head case's verdict prove rows that no probe reaches: a sky and a head. */
export const ROW_PROOFS = [
  ...PROBES,
  ...SKY_SCENES,
  ...HEAD_CASES.filter(({ rows }) => rows.length > 0).map(({ id, rows }) => ({
    name: `head-${id}`,
    rows,
    isVerdictCase: true,
  })),
];
