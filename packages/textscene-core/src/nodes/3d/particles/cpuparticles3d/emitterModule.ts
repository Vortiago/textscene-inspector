import { memoisedImport } from '../../../../resources/memoisedImport';

// Lazy: a static import puts the simulation and its draw on the web previewer's initial-paint path.
export const loadParticleEmitter = memoisedImport(() => import('./ParticleEmitter'));
