/**
 * The one place the Component imports `simulate.ts`, and lazily: a static import puts the
 * simulation on the webview's initial-paint path for every scene, past its budget.
 */

import { memoisedImport } from '../../../resources/useLazyModule';

export const loadSimulate = memoisedImport(() => import('./simulate'));
