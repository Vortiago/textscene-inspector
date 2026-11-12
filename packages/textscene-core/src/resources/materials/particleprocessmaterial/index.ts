/**
 * ParticleProcessMaterial resource slice (ADR-0031): the routing claim and the decode surface. THREE-free,
 * so the linter can import it.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'particleprocessmaterial',
  kind: 'godot-text',
  typeNames: ['ParticleProcessMaterial'],
  busType: 'resource',
});

export { PARTICLE_PROCESS_MATERIAL, type ProcessMaterial } from './kind';
export type { ProcessSimulation, ParamRange } from './simulation';
