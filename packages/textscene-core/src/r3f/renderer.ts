/**
 * The entry that `@textscene/renderer` bundles: the react-three-fiber renderer without the
 * previewer UI. It exports only the public API, since each name here is a promise to every
 * consumer of the package.
 */

// Every node-type component registers itself on first import.
import './nodes/index.js';

export { openScene, type Scene } from '../scene/openScene.js';
export type { NodeHandle } from '../scene/nodeHandle.js';
export type { CameraState } from '../scene/viewportCameras.js';
export { variant, type SceneValue, type Variant } from '../scene/variant.js';
export { TscnCanvas } from './TscnCanvas.js';
export { mountScene, type View, type ViewOptions } from './mountScene.js';
export type { ResourceProvider } from '../resources/ResourceProvider.js';
