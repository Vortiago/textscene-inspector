/**
 * The one place the Component imports `ParticleEmitter.tsx`, and lazily: a static import puts the
 * simulation and its draw on the webview's initial-paint path for every scene, past its budget.
 */

import { memoisedImport } from '../../../../resources/memoisedImport';

export const loadParticleEmitter = memoisedImport(() => import('./ParticleEmitter'));
