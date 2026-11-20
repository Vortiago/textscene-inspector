import { memoisedImport } from '../../../resources/memoisedImport';

// Lazy: a static import puts the simulation on the web previewer's initial-paint path.
export const loadSimulate = memoisedImport(() => import('./simulate'));
