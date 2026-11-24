import { usePendingResourceCount } from '../resources/usePendingResourceCount.js';
import { usePendingWork } from '../resources/usePendingWork.js';
import { textureWork } from '../resources/textures/textureWork.js';
import { moduleWork } from '../resources/memoisedImport.js';
import { fontWork } from './controls/native/text/settledChannel.js';

/** Whether the resources, textures, fonts and code a scene draws with have arrived, shell or not. */
export function useSceneAssetsSettled(): boolean {
  // Every hook runs on every render, so React sees one hook order.
  const pendingResources = usePendingResourceCount();
  const pendingTextures = usePendingWork(textureWork);
  const pendingFontWork = usePendingWork(fontWork);
  const pendingModules = usePendingWork(moduleWork);
  return pendingResources === 0 && pendingTextures === 0 && pendingFontWork === 0 && pendingModules === 0;
}
