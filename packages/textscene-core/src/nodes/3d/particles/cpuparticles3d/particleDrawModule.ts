/**
 * The one place the Component imports `particleDraw.ts`, and lazily: a static import puts the
 * simulation and the draw on the webview's initial-paint path for every scene, past its budget.
 */

import { memoisedImport } from '../../../../resources/useLazyModule';

export const loadParticleDraw = memoisedImport(() => import('./particleDraw'));
