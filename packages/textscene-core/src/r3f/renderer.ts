/**
 * The entry that `@textscene/renderer` bundles: the react-three-fiber renderer without the
 * previewer UI. It exports only the public API, since each name here is a promise to every
 * consumer of the package.
 */

// Every node-type component registers itself on first import.
import './nodes/index.js';

import type { Scene } from '../scene/openScene.js';
import { TscnCanvas as TscnCanvasInCore, type TscnCanvasProps } from './TscnCanvas.js';

export { openScene, type Scene } from '../scene/openScene.js';
export type { NodeHandle } from '../scene/nodeHandle.js';
export type { CameraState } from '../scene/viewportCameras.js';
export { variant, type SceneValue, type Variant } from '../scene/variant.js';
export { mountScene, type View, type ViewOptions } from './mountScene.js';
export type { ResourceProvider } from '../resources/ResourceProvider.js';

/** The entry gives no scene provider, so its canvas requires `scene`. */
export const TscnCanvas: (props: TscnCanvasProps & { scene: Scene }) => ReturnType<typeof TscnCanvasInCore> =
  TscnCanvasInCore;
