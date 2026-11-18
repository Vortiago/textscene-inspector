import { MESH_SCENES } from './e2e/meshScenes.mjs';
import { SKY_SCENES } from './e2e/skyScenes.mjs';
import { HEAD_CASES } from './heads/headCases.mjs';
import { PROBES } from './probes/probes.mjs';

/** A sky or mesh scene and a head case prove the rows no probe reaches: a template's and a head's. */
export const ROW_PROOFS = [
  ...PROBES,
  ...SKY_SCENES,
  ...MESH_SCENES,
  ...HEAD_CASES.filter(({ rows }) => rows.length > 0).map(({ id, rows }) => ({
    name: `head-${id}`,
    rows,
    isVerdictCase: true,
  })),
];
