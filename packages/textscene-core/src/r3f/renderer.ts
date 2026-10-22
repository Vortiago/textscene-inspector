/**
 * The entry that `@textscene/renderer` bundles: the react-three-fiber renderer without the
 * previewer UI. It exports only the public API, since each name here is a promise to every
 * consumer of the package.
 */

// Every node-type component registers itself on first import.
import './nodes/index.js';

export { TscnCanvas } from './TscnCanvas.js';
export { TscnSceneProvider } from './TscnSceneProvider.js';
export type { ResourceProvider } from '../resources/ResourceProvider.js';
export { useSelection } from './contexts/SelectionContext.js';
